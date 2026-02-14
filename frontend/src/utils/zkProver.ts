/**
 * ZK Prover utilities for Veil Protocol.
 *
 * Computes BN254 Poseidon commitments and nullifiers that match
 * the Noir circuit (circuits/ghostsats/src/main.nr).
 *
 * The Noir circuit uses:
 *   zk_commitment = Poseidon_BN254(secret, blinder, denomination)
 *   nullifier      = Poseidon_BN254(secret, 1)
 *
 * Proof generation pipeline (browser-side, secrets never leave the browser):
 *   1. Client computes commitment/nullifier (Poseidon BN254 via poseidon-lite)
 *   2. Client generates witness (noir_js WASM) + proof (bb.js WASM) in browser
 *   3. Client sends ONLY the proof binary to server for garaga calldata conversion
 *   4. On-chain, the Garaga verifier validates the UltraKeccakZKHonk proof
 *
 * Secret and blinder NEVER appear in on-chain calldata or server requests.
 */

import { poseidon2, poseidon3 } from "poseidon-lite";
import { generateProofInBrowser } from "./browserProver";

const CALLDATA_URL = process.env.NEXT_PUBLIC_PROVER_URL ?? "/api/relayer";

// BN254 Poseidon outputs (~2^254) can exceed felt252 max (~2^251).
// Reduce modulo STARK_PRIME so values fit in felt252 for on-chain storage.
// Deposit and withdrawal both apply the same reduction, keeping them consistent.
const STARK_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

/**
 * Compute a ZK commitment using Poseidon BN254 hash, reduced to felt252.
 * Matches: bn254::hash_3([secret, blinder, denomination]) % STARK_PRIME
 */
export function computeZKCommitment(
  secret: bigint,
  blinder: bigint,
  denomination: bigint,
): bigint {
  return poseidon3([secret, blinder, denomination]) % STARK_PRIME;
}

/**
 * Compute a ZK nullifier using Poseidon BN254 hash, reduced to felt252.
 * Matches: bn254::hash_2([secret, 1]) % STARK_PRIME
 */
export function computeZKNullifier(secret: bigint): bigint {
  return poseidon2([secret, 1n]) % STARK_PRIME;
}

/**
 * Compute RAW BN254 Poseidon commitment (not reduced).
 * Used as circuit input — the Noir circuit operates on BN254 field.
 */
export function computeZKCommitmentRaw(
  secret: bigint,
  blinder: bigint,
  denomination: bigint,
): bigint {
  return poseidon3([secret, blinder, denomination]);
}

/**
 * Compute RAW BN254 Poseidon nullifier (not reduced).
 * Used as circuit input — the Noir circuit operates on BN254 field.
 */
export function computeZKNullifierRaw(secret: bigint): bigint {
  return poseidon2([secret, 1n]);
}

/**
 * Convert a bigint to a hex string (felt252-compatible).
 */
export function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16);
}

export { preloadProver as preloadZKProver } from "./browserProver";

/**
 * Generate a withdrawal proof using browser-side ZK proving.
 *
 * Pipeline:
 *   1. Browser: noir_js generates witness from private inputs (WASM)
 *   2. Browser: bb.js generates UltraKeccakZKHonk proof (WASM)
 *   3. Server: receives ONLY proof binary → garaga calldata → ~2835 felt252 values
 *
 * Secrets NEVER leave the browser. The server only converts proof format.
 */
export async function generateWithdrawalProof(params: {
  secret: bigint;
  blinder: bigint;
  denomination: bigint;
}): Promise<{
  proof: string[];
  zkCommitment: string;
  zkNullifier: string;
}> {
  const { secret, blinder, denomination } = params;

  // Compute raw BN254 values (for circuit) and reduced felt252 values (for on-chain)
  const zkCommitmentRaw = computeZKCommitmentRaw(secret, blinder, denomination);
  const zkNullifierRaw = computeZKNullifierRaw(secret);
  const zkCommitment = zkCommitmentRaw % STARK_PRIME;
  const zkNullifier = zkNullifierRaw % STARK_PRIME;

  // Step 1+2: Generate proof in browser (secrets stay in WASM memory)
  const { proofBytes, publicInputs } = await generateProofInBrowser({
    secret,
    blinder,
    denomination,
    zkCommitmentRaw,
    zkNullifierRaw,
  });

  // Step 3: Send ONLY proof binary to server for garaga calldata conversion
  // Note: proofBytes is the proof, publicInputs are BN254 public inputs
  // The server NEVER sees secret or blinder
  const resp = await fetch(`${CALLDATA_URL}/calldata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proof: Array.from(proofBytes),
      publicInputs,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Calldata generation failed: ${errText}`);
  }

  const { calldata } = await resp.json();

  return {
    proof: calldata,
    zkCommitment: bigintToHex(zkCommitment),
    zkNullifier: bigintToHex(zkNullifier),
  };
}
