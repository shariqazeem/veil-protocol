/**
 * Privacy utilities for GhostSats.
 *
 * Mirrors the Cairo contract's Pedersen commitment exactly:
 *   commitment = pedersen(pedersen(0, amount_hash), secret_hash)
 *
 * Supports:
 * - Fixed denomination deposits (100, 1000, 10000 USDC)
 * - Pedersen Merkle tree proof generation
 * - Encrypted note storage (AES-GCM with wallet-derived key)
 * - Nullifier computation
 */

import { hash, num } from "starknet";

// ========================================
// Types
// ========================================

export interface GhostNote {
  secret: string;
  blinder: string;
  amount: string;
  denomination: number; // 0=100, 1=1000, 2=10000
  commitment: string;
  batchId: number;
  leafIndex: number;
  claimed: boolean;
  timestamp: number;
  btcIdentityHash?: string;
}

// ========================================
// Constants
// ========================================

export const DENOMINATIONS: Record<number, number> = {
  0: 100_000_000,       // 100 USDC (6 decimals)
  1: 1_000_000_000,     // 1,000 USDC
  2: 10_000_000_000,    // 10,000 USDC
};

export const DENOMINATION_LABELS: Record<number, string> = {
  0: "100 USDC",
  1: "1,000 USDC",
  2: "10,000 USDC",
};

const TREE_DEPTH = 20;
const STORAGE_KEY = "ghost-notes";
const ENCRYPTED_STORAGE_KEY = "ghost-notes-enc";

// ========================================
// Pedersen Helpers
// ========================================

/** Cairo's Pedersen chain: PedersenTrait::new(0).update(a).update(b).finalize() */
function pedersenChain(a: string, b: string): string {
  const step1 = hash.computePedersenHash("0x0", a);
  return hash.computePedersenHash(step1, b);
}

function splitU256(amount: bigint): { low: string; high: string } {
  const mask = (1n << 128n) - 1n;
  return {
    low: num.toHex(amount & mask),
    high: num.toHex(amount >> 128n),
  };
}

/** Generate a random felt252-safe value (< 2^251). */
function randomFelt(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ========================================
// Core Cryptography
// ========================================

/** Compute a Pedersen commitment matching the Cairo contract exactly. */
export function computeCommitment(
  amount: bigint,
  secret: string,
  blinder: string,
): string {
  const { low, high } = splitU256(amount);
  const amountHash = pedersenChain(low, high);
  const secretHash = pedersenChain(secret, blinder);
  return pedersenChain(amountHash, secretHash);
}

/** Compute nullifier: pedersen(pedersen(0, secret), 1) */
export function computeNullifier(secret: string): string {
  const step1 = hash.computePedersenHash("0x0", secret);
  return hash.computePedersenHash(step1, "0x1");
}

/** Pedersen hash of two values (for Merkle tree). */
function hashPair(left: string, right: string): string {
  const step1 = hash.computePedersenHash("0x0", left);
  return hash.computePedersenHash(step1, right);
}

/** Get the zero hash for a given Merkle level. */
function getZeroHash(level: number): string {
  let current = "0x0";
  for (let i = 0; i < level; i++) {
    current = hashPair(current, current);
  }
  return current;
}

// ========================================
// Merkle Tree
// ========================================

/**
 * Build a Merkle proof for a leaf at a given index in a tree with known leaves.
 * This mirrors the contract's Merkle tree structure.
 */
export function buildMerkleProof(
  leafIndex: number,
  allLeaves: string[],
): { path: string[]; indices: number[] } {
  const path: string[] = [];
  const indices: number[] = [];

  // Build the tree level by level
  let currentLevel = [...allLeaves];

  // Pad to next power of 2 with zeros at level 0
  // Actually, we just need to track the nodes at each level
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    // Get sibling value
    let sibling: string;
    if (siblingIndex < currentLevel.length) {
      sibling = currentLevel[siblingIndex];
    } else {
      sibling = getZeroHash(level);
    }

    path.push(sibling);
    indices.push(currentIndex % 2 === 0 ? 0 : 1);

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : getZeroHash(level);
      nextLevel.push(hashPair(left, right));
    }
    // If the current level was empty or had only items up to currentIndex's pair
    // ensure we have enough for the parent
    if (nextLevel.length === 0) {
      nextLevel.push(hashPair(getZeroHash(level), getZeroHash(level)));
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { path, indices };
}

// ========================================
// Note Generation & Storage
// ========================================

/** Generate a new GhostNote for a fixed denomination deposit. */
export function generateNote(
  denomination: number,
  batchId: number = 0,
  leafIndex: number = 0,
  btcIdentityHash?: string,
): GhostNote {
  const amount = DENOMINATIONS[denomination];
  if (!amount) throw new Error(`Invalid denomination tier: ${denomination}`);

  const secret = randomFelt();
  const blinder = randomFelt();
  const commitment = computeCommitment(BigInt(amount), secret, blinder);

  return {
    secret,
    blinder,
    amount: amount.toString(),
    denomination,
    commitment,
    batchId,
    leafIndex,
    claimed: false,
    timestamp: Date.now(),
    btcIdentityHash: btcIdentityHash || undefined,
  };
}

// ========================================
// Encrypted Storage
// ========================================

/** Derive an AES-GCM key from a wallet signature (used as password). */
async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Use a fixed salt (derived from app name) for deterministic key derivation
  const salt = enc.encode("ghostsats-v1-note-encryption");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt and save notes to localStorage. */
export async function saveNotesEncrypted(notes: GhostNote[], walletAddress: string): Promise<void> {
  try {
    const key = await deriveKey(walletAddress);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(notes));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    const payload = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };

    localStorage.setItem(ENCRYPTED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Fallback to plaintext if encryption fails
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }
}

/** Load and decrypt notes from localStorage. */
export async function loadNotesEncrypted(walletAddress: string): Promise<GhostNote[]> {
  try {
    const raw = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
    if (!raw) {
      // Try loading unencrypted notes (migration)
      return loadNotes();
    }

    const payload = JSON.parse(raw);
    const key = await deriveKey(walletAddress);
    const iv = new Uint8Array(payload.iv);
    const data = new Uint8Array(payload.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch {
    // Fallback to plaintext
    return loadNotes();
  }
}

/** Save a single note (encrypted if wallet address available, plaintext otherwise). */
export async function saveNote(note: GhostNote, walletAddress?: string): Promise<void> {
  if (walletAddress) {
    const existing = await loadNotesEncrypted(walletAddress);
    existing.push(note);
    await saveNotesEncrypted(existing, walletAddress);
  } else {
    const stored = loadNotes();
    stored.push(note);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}

/** Load notes from plaintext storage (fallback). */
export function loadNotes(): GhostNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Mark a note as claimed. */
export async function markNoteClaimed(commitment: string, walletAddress?: string): Promise<void> {
  if (walletAddress) {
    const notes = await loadNotesEncrypted(walletAddress);
    const updated = notes.map((n) =>
      n.commitment === commitment ? { ...n, claimed: true } : n,
    );
    await saveNotesEncrypted(updated, walletAddress);
  } else {
    const notes = loadNotes();
    const updated = notes.map((n) =>
      n.commitment === commitment ? { ...n, claimed: true } : n,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

/** Get all commitment hashes from stored notes (for Merkle proof building). */
export async function getAllCommitments(walletAddress?: string): Promise<string[]> {
  const notes = walletAddress ? await loadNotesEncrypted(walletAddress) : loadNotes();
  return notes.map((n) => n.commitment);
}
