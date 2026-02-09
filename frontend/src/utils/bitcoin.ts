/**
 * Bitcoin wallet utilities for GhostSats.
 * Uses sats-connect (Xverse) to request message signatures
 * that cryptographically bind a Bitcoin identity to shielded deposits.
 */

import { hash } from "starknet";

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
        message: `GhostSats:COMMIT:${commitmentHash}`,
        network: { type: BitcoinNetworkType.Testnet4 },
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
