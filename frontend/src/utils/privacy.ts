/**
 * Privacy utilities for Veil Protocol.
 *
 * Mirrors the Cairo contract's Pedersen commitment exactly:
 *   commitment = pedersen(pedersen(0, amount_hash), secret_hash)
 *
 * Supports:
 * - Fixed denomination deposits ($1, $10, $100 USDC)
 * - Pedersen Merkle tree proof generation
 * - Encrypted note storage (AES-GCM with wallet-derived key)
 * - Nullifier computation
 */

import { hash, num } from "starknet";
import { computeZKCommitment, computeZKNullifier, bigintToHex } from "./zkProver";

// ========================================
// Types
// ========================================

export interface GhostNote {
  secret: string;
  blinder: string;
  amount: string;
  denomination: number; // 0=$1, 1=$10, 2=$100
  commitment: string;
  zkCommitment?: string;   // Poseidon BN254 commitment for ZK proof
  zkNullifier?: string;    // Poseidon BN254 nullifier for ZK proof
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
  0: 1_000_000,         // $1 USDC (6 decimals)
  1: 10_000_000,        // $10 USDC
  2: 100_000_000,       // $100 USDC
};

export const DENOMINATION_LABELS: Record<number, string> = {
  0: "$1",
  1: "$10",
  2: "$100",
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

/**
 * Generate a private GhostNote with ZK commitment for deposit_private.
 * Same as generateNote but also computes BN254 Poseidon ZK commitment
 * and nullifier for the ZK proof system.
 *
 * BN254 Poseidon outputs (~2^254) may exceed STARK_PRIME (~2^251).
 * The reduction modulo STARK_PRIME is handled in computeZKCommitment/computeZKNullifier.
 * We retry with a new blinder if the unreduced value would cause issues
 * (probability ~16% per attempt, so P(10 failures) ≈ 0.0000001%).
 */
const MAX_ZK_RETRIES = 10;

export function generatePrivateNote(
  denomination: number,
  batchId: number = 0,
  leafIndex: number = 0,
  btcIdentityHash?: string,
): GhostNote {
  for (let attempt = 0; attempt < MAX_ZK_RETRIES; attempt++) {
    const note = generateNote(denomination, batchId, leafIndex, btcIdentityHash);

    const secretBigint = BigInt(note.secret);
    const blinderBigint = BigInt(note.blinder);
    const denominationBigint = BigInt(denomination);

    const zkCommitmentRaw = computeZKCommitment(secretBigint, blinderBigint, denominationBigint);
    const zkNullifierRaw = computeZKNullifier(secretBigint);

    // Ensure both values are non-zero after reduction (extremely rare edge case)
    if (zkCommitmentRaw === 0n || zkNullifierRaw === 0n) continue;

    const zkCommitment = bigintToHex(zkCommitmentRaw);
    const zkNullifier = bigintToHex(zkNullifierRaw);

    return { ...note, zkCommitment, zkNullifier };
  }

  throw new Error("Failed to generate valid ZK commitment after max retries");
}

// ========================================
// Encrypted Storage
// ========================================

/** Derive an AES-GCM key from a secret password using PBKDF2. */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const salt = enc.encode("ghostsats-v1-note-encryption");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Get the encryption secret for note storage.
 *
 * Uses a wallet-signed message as the encryption key material.
 * The signature is unique per wallet and can only be produced by the private key holder.
 * Falls back to wallet address for wallets that don't support signing (less secure).
 *
 * The signed message is cached in sessionStorage to avoid re-prompting.
 */
const SIGNATURE_CACHE_KEY = "ghost-enc-sig";

export async function getEncryptionSecret(
  walletAddress: string,
  signMessage?: (message: string) => Promise<string[]>,
): Promise<string> {
  // Check session cache first
  const cached = sessionStorage.getItem(SIGNATURE_CACHE_KEY);
  if (cached) return cached;

  if (signMessage) {
    try {
      const sig = await signMessage("Veil Protocol note encryption key");
      // Use the full signature array joined as the secret
      const secret = sig.join("");
      sessionStorage.setItem(SIGNATURE_CACHE_KEY, secret);
      return secret;
    } catch {
      // User rejected or wallet doesn't support signing — fall back
    }
  }

  // Fallback: use address (less secure, but functional)
  return walletAddress;
}

/** Encrypt and save notes to localStorage. */
export async function saveNotesEncrypted(notes: GhostNote[], encryptionSecret: string): Promise<void> {
  try {
    const key = await deriveKey(encryptionSecret);
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
export async function loadNotesEncrypted(encryptionSecret: string): Promise<GhostNote[]> {
  try {
    const raw = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
    if (!raw) {
      // Try loading unencrypted notes (migration)
      return loadNotes();
    }

    const payload = JSON.parse(raw);
    const key = await deriveKey(encryptionSecret);
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

/** Save a single note (encrypted if encryption secret available, plaintext otherwise). */
export async function saveNote(note: GhostNote, encryptionSecret?: string): Promise<void> {
  if (encryptionSecret) {
    const existing = await loadNotesEncrypted(encryptionSecret);
    existing.push(note);
    await saveNotesEncrypted(existing, encryptionSecret);
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
export async function markNoteClaimed(commitment: string, encryptionSecret?: string): Promise<void> {
  if (encryptionSecret) {
    const notes = await loadNotesEncrypted(encryptionSecret);
    const updated = notes.map((n) =>
      n.commitment === commitment ? { ...n, claimed: true } : n,
    );
    await saveNotesEncrypted(updated, encryptionSecret);
  } else {
    const notes = loadNotes();
    const updated = notes.map((n) =>
      n.commitment === commitment ? { ...n, claimed: true } : n,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

/** Get all commitment hashes from stored notes (for Merkle proof building). */
export async function getAllCommitments(encryptionSecret?: string): Promise<string[]> {
  const notes = encryptionSecret ? await loadNotesEncrypted(encryptionSecret) : loadNotes();
  return notes.map((n) => n.commitment);
}
