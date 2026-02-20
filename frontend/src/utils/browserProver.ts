/**
 * Browser-side ZK proof generation for Veil Protocol.
 *
 * Uses @noir-lang/noir_js (WASM) for witness generation and
 * @aztec/bb.js (WASM) for UltraKeccakZKHonk proof generation.
 *
 * Secrets (secret, blinder) NEVER leave the browser.
 * Only the proof binary (public data) is sent to the server
 * for garaga calldata conversion.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type NoirInstance = any;
type BackendInstance = any;

let noir: NoirInstance | null = null;
let backend: BackendInstance | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Lazily initialize noir_js and bb.js WASM modules.
 * Only called client-side when the user initiates a withdrawal.
 */
async function ensureInit(): Promise<void> {
  if (noir && backend) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Fetch compiled circuit from public/
      console.log("[zk] Loading circuit...");
      const circuitResp = await fetch("/circuits/ghostsats.json");
      if (!circuitResp.ok) throw new Error("Failed to load ZK circuit");
      const circuit = await circuitResp.json();
      console.log("[zk] Circuit loaded, importing WASM modules...");

      // Dynamic imports — ensures these only load client-side (no SSR)
      const { Noir } = await import("@noir-lang/noir_js");
      console.log("[zk] noir_js loaded");
      const { UltraHonkBackend } = await import("@aztec/bb.js");
      console.log("[zk] bb.js loaded");

      noir = new Noir(circuit);
      backend = new UltraHonkBackend(circuit.bytecode);
      console.log("[zk] ZK prover initialized");
    } catch (err) {
      // Reset so next attempt retries
      initPromise = null;
      noir = null;
      backend = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Generate a ZK proof entirely in the browser.
 *
 * @param secret - Private: the note secret (BN254 field element)
 * @param blinder - Private: the note blinder (BN254 field element)
 * @param denomination - Public: denomination tier (0, 1, 2, or 3)
 * @param zkCommitmentRaw - Public: raw BN254 Poseidon commitment (NOT reduced)
 * @param zkNullifierRaw - Public: raw BN254 Poseidon nullifier (NOT reduced)
 * @param recipient - Public: recipient Starknet address (prevents front-running)
 * @returns proof bytes and public inputs (hex strings)
 */
export async function generateProofInBrowser(params: {
  secret: bigint;
  blinder: bigint;
  denomination: bigint;
  zkCommitmentRaw: bigint;
  zkNullifierRaw: bigint;
  recipient: bigint;
}): Promise<{
  proofBytes: Uint8Array;
  publicInputs: string[];
}> {
  await ensureInit();

  // Pass all inputs (private + public) to noir_js
  // noir_js uses the circuit ABI to determine which are public/private
  const inputs = {
    secret: "0x" + params.secret.toString(16),
    blinder: "0x" + params.blinder.toString(16),
    zk_commitment: "0x" + params.zkCommitmentRaw.toString(16),
    nullifier_hash: "0x" + params.zkNullifierRaw.toString(16),
    denomination: "0x" + params.denomination.toString(16),
    recipient: "0x" + params.recipient.toString(16),
  };

  // Step 1: Generate witness (secret + blinder stay in WASM memory)
  const { witness } = await noir!.execute(inputs);

  // Step 2: Generate UltraKeccakZKHonk proof (matches Garaga verifier)
  // { keccakZK: true } = keccak oracle hash + ZK mode enabled
  const proof = await backend!.generateProof(witness, { keccakZK: true });

  return {
    proofBytes: proof.proof,       // Uint8Array — raw proof binary
    publicInputs: proof.publicInputs, // string[] — hex BN254 public inputs
  };
}

/**
 * Pre-load WASM modules so proof generation starts faster.
 * Call on page mount to shave 5-15 seconds off first withdrawal.
 */
export async function preloadProver(): Promise<void> {
  try {
    await ensureInit();
  } catch {
    // Silently fail — will retry when actually needed
  }
}

/**
 * Destroy the backend to free WASM memory.
 * Call when navigating away from the withdrawal page.
 */
export async function destroyProver(): Promise<void> {
  if (backend) {
    try { await backend.destroy(); } catch { /* ignore */ }
    backend = null;
  }
  noir = null;
  initPromise = null;
}
