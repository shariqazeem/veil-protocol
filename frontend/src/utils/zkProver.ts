/**
 * ZK Prover utilities for GhostSats.
 *
 * Computes BN254 Poseidon commitments and nullifiers that match
 * the Noir circuit (circuits/ghostsats/src/main.nr).
 *
 * The Noir circuit uses:
 *   zk_commitment = Poseidon_BN254(secret, blinder, denomination)
 *   nullifier      = Poseidon_BN254(secret, 1)
 *
 * Proof generation pipeline:
 *   1. Client computes commitment/nullifier (Poseidon BN254 via poseidon-lite)
 *   2. Prover service generates witness (nargo) → proof (bb) → calldata (garaga)
 *   3. On-chain, the Garaga verifier validates the UltraKeccakZKHonk proof
 *
 * Secret and blinder NEVER appear in on-chain calldata — only the proof does.
 */

import { poseidon2, poseidon3 } from "poseidon-lite";

const PROVER_URL = process.env.NEXT_PUBLIC_PROVER_URL ?? "http://localhost:3001";

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
 * Convert a bigint to a hex string (felt252-compatible).
 */
export function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16);
}

/**
 * Generate a withdrawal proof via the prover service.
 *
 * Pipeline: nargo execute → bb prove → garaga calldata
 * Returns ~2835 felt252 calldata elements for the Garaga verifier.
 *
 * The prover service sees the secrets temporarily (in-memory only).
 * In production, this would run entirely in the browser via noir_js + bb.js WASM.
 * The critical guarantee: secrets NEVER appear in on-chain calldata.
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

  const resp = await fetch(`${PROVER_URL}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: secret.toString(),
      blinder: blinder.toString(),
      denomination: Number(denomination),
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Proof generation failed: ${errText}`);
  }

  return resp.json();
}
