/**
 * Bitcoin wallet utilities for Veil Protocol.
 * Uses sats-connect (Xverse) to request message signatures
 * that cryptographically bind a Bitcoin identity to shielded deposits.
 */

import { hash } from "starknet";
import { isMainnet } from "@/utils/network";

/**
 * Sign the actual commitment hash with the Bitcoin wallet.
 * This creates a cryptographic proof that the BTC wallet holder
 * authorized this specific shielded deposit.
 */
export async function signCommitment(btcAddress: string, commitmentHash: string): Promise<string> {
  const { signMessage, BitcoinNetworkType } = await import("sats-connect");

  return new Promise<string>((resolve, reject) => {
    signMessage({
      payload: {
        address: btcAddress,
        message: `VeilProtocol:COMMIT:${commitmentHash}`,
        network: { type: isMainnet ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet4 },
      },
      onFinish: (signature) => {
        resolve(signature);
      },
      onCancel: () => {
        reject(new Error("User cancelled Bitcoin signature"));
      },
    });
  });
}

/**
 * Compute a Pedersen hash of the Bitcoin address.
 * This produces a felt252-compatible identity hash that gets stored on-chain
 * alongside the deposit commitment.
 */
export function computeBtcIdentityHash(btcAddress: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(btcAddress);
  // Split address into felt252-safe chunks (max 31 bytes each)
  const chunk1 = "0x" + Array.from(bytes.slice(0, 31)).map(b => b.toString(16).padStart(2, "0")).join("");
  const chunk2Bytes = bytes.slice(31);
  const chunk2 = chunk2Bytes.length > 0
    ? "0x" + Array.from(chunk2Bytes).map(b => b.toString(16).padStart(2, "0")).join("")
    : "0x0";
  // Pedersen chain: H(H(0, chunk1), chunk2)
  const step1 = hash.computePedersenHash("0x0", chunk1);
  return hash.computePedersenHash(step1, chunk2);
}

/**
 * Anchor the Starknet Merkle root via Bitcoin wallet signature.
 * The BTC wallet signs `GhostSats:ANCHOR:<merkleRoot>:<timestamp>`, creating
 * a verifiable cryptographic attestation that the privacy pool state existed
 * at this moment — signed by a Bitcoin identity.
 *
 * Returns the BTC signature string.
 */
export async function anchorMerkleRoot(
  btcAddress: string,
  merkleRoot: string,
): Promise<string> {
  const { signMessage, BitcoinNetworkType } = await import("sats-connect");

  const timestamp = Math.floor(Date.now() / 1000);
  const message = `VeilProtocol:ANCHOR:${merkleRoot}:${timestamp}`;

  return new Promise<string>((resolve, reject) => {
    signMessage({
      payload: {
        address: btcAddress,
        message,
        network: { type: isMainnet ? BitcoinNetworkType.Mainnet : BitcoinNetworkType.Testnet4 },
      },
      onFinish: (signature) => {
        resolve(signature);
      },
      onCancel: () => {
        reject(new Error("User cancelled Bitcoin anchor signature"));
      },
    });
  });
}

/**
 * Get stored anchor history from localStorage.
 */
export function getAnchorHistory(): Array<{ merkleRoot: string; signature: string; timestamp: number }> {
  try {
    const raw = localStorage.getItem("ghostsats_anchors");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save an anchor event to localStorage.
 */
export function saveAnchor(merkleRoot: string, signature: string): void {
  const history = getAnchorHistory();
  history.unshift({ merkleRoot, signature, timestamp: Date.now() });
  // Keep last 50
  localStorage.setItem("ghostsats_anchors", JSON.stringify(history.slice(0, 50)));
}

/**
 * Validate a Bitcoin address.
 * Supports P2PKH (1...), P2SH (3...), Bech32 (bc1q...), and Bech32m/Taproot (bc1p...).
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();

  // P2PKH: starts with 1, 25-34 chars, base58
  if (/^1[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(trimmed)) return true;

  // P2SH: starts with 3, 25-34 chars, base58
  if (/^3[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(trimmed)) return true;

  // Bech32 (P2WPKH/P2WSH): bc1q, 42 or 62 chars
  if (/^bc1q[a-z0-9]{38,58}$/.test(trimmed)) return true;

  // Bech32m (Taproot P2TR): bc1p, 62-63 chars total
  if (/^bc1p[a-z0-9]{58,59}$/.test(trimmed)) return true;

  return false;
}
