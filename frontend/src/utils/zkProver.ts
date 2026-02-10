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
 * On-chain, the Garaga verifier validates these proofs.
 * When the verifier address is zero (dev/testnet), proof verification
 * is skipped — the ZK commitment mapping and nullifier tracking still work.
 */

import { poseidon2, poseidon3 } from "poseidon-lite";

/**
 * Compute a ZK commitment using Poseidon BN254 hash.
 * Matches: bn254::hash_3([secret, blinder, denomination])
 */
export function computeZKCommitment(
  secret: bigint,
  blinder: bigint,
  denomination: bigint,
): bigint {
  return poseidon3([secret, blinder, denomination]);
}

/**
 * Compute a ZK nullifier using Poseidon BN254 hash.
 * Matches: bn254::hash_2([secret, 1])
 */
export function computeZKNullifier(secret: bigint): bigint {
  return poseidon2([secret, 1n]);
}

/**
 * Convert a bigint to a hex string (felt252-compatible).
 */
export function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16);
}

/**
 * Generate a withdrawal proof for the on-chain verifier.
 *
 * In production, this would use NoirJS + Barretenberg WASM to generate
 * a real UltraKeccakHonk proof, then format it with Garaga calldata hints.
 *
 * For the hackathon testnet deployment (verifier = zero address),
 * proof verification is skipped on-chain, so we return an empty proof.
 * The ZK commitment mapping and nullifier tracking still provide privacy.
 *
 * Architecture for full integration:
 * 1. noir_js.execute(circuit, { secret, blinder, ... }) → witness
 * 2. bb.prove(witness) → UltraKeccakHonk proof
 * 3. garaga.calldata(proof, vk) → felt252[] with verification hints
 */
export function generateWithdrawalProof(params: {
  secret: bigint;
  blinder: bigint;
  denomination: bigint;
}): {
  proof: string[];
  zkCommitment: string;
  zkNullifier: string;
} {
  const { secret, blinder, denomination } = params;

  const zkCommitment = computeZKCommitment(secret, blinder, denomination);
  const zkNullifier = computeZKNullifier(secret);

  return {
    proof: [], // Empty proof — verifier skipped when address is zero
    zkCommitment: bigintToHex(zkCommitment),
    zkNullifier: bigintToHex(zkNullifier),
  };
}
