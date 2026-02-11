/**
 * GhostSats Relayer + Prover Service
 *
 * Endpoints:
 *   POST /prove   — Generate a ZK proof (nargo → bb → garaga calldata)
 *   POST /relay   — Submit a gasless withdrawal on-chain
 *   GET  /health  — Health check
 *   GET  /info    — Relayer info
 *
 * Usage:
 *   npm run relayer            — Start server on port 3001
 *
 * Environment:
 *   PRIVATE_KEY        — Relayer's Starknet account private key
 *   ACCOUNT_ADDRESS    — Relayer's Starknet account address
 *   STARKNET_RPC_URL   — RPC endpoint (default: publicnode)
 *   POOL_ADDRESS       — ShieldedPool contract address
 *   RELAYER_PORT       — Server port (default: 3001)
 *   RELAYER_FEE_BPS    — Fee in basis points (default: 200 = 2%)
 */

import * as http from "http";
import { CallData } from "starknet";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import "dotenv/config";
import { poseidon2, poseidon3 } from "poseidon-lite";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.RELAYER_PORT ?? 3001);
const FEE_BPS = Number(process.env.RELAYER_FEE_BPS ?? 200); // 2%
const MAX_FEE_BPS = 500; // 5% enforced on-chain

const privateKey = process.env.PRIVATE_KEY;
const accountAddress = process.env.ACCOUNT_ADDRESS;


// Load pool address from deployment manifest or env
function getPoolAddress(): string {
  if (process.env.POOL_ADDRESS) return process.env.POOL_ADDRESS;

  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "deployment.json"), "utf-8"),
    );
    return manifest.contracts.shieldedPool;
  } catch {
    // Try frontend addresses
    try {
      const addrs = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, "..", "frontend", "src", "contracts", "addresses.json"),
          "utf-8",
        ),
      );
      return addrs.contracts.shieldedPool;
    } catch {
      throw new Error("POOL_ADDRESS not set and no deployment manifest found");
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelayRequest {
  denomination: number;
  zk_nullifier: string;
  zk_commitment: string;
  proof: string[];
  merkle_path: string[];
  path_indices: number[];
  recipient: string;
  btc_recipient_hash: string;
}

interface RelayResponse {
  success: boolean;
  txHash?: string;
  fee_bps?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRequest(body: unknown): RelayRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const req = body as Record<string, unknown>;

  if (typeof req.denomination !== "number" || req.denomination < 0 || req.denomination > 2) {
    throw new Error("Invalid denomination (must be 0, 1, or 2)");
  }
  if (typeof req.zk_nullifier !== "string" || !req.zk_nullifier.startsWith("0x")) {
    throw new Error("Invalid zk_nullifier");
  }
  if (typeof req.zk_commitment !== "string" || !req.zk_commitment.startsWith("0x")) {
    throw new Error("Invalid zk_commitment");
  }
  if (!Array.isArray(req.proof)) {
    throw new Error("Invalid proof (must be array)");
  }
  if (!Array.isArray(req.merkle_path) || req.merkle_path.length !== 20) {
    throw new Error("Invalid merkle_path (must be array of length 20)");
  }
  if (!Array.isArray(req.path_indices) || req.path_indices.length !== 20) {
    throw new Error("Invalid path_indices (must be array of length 20)");
  }
  if (typeof req.recipient !== "string" || !req.recipient.startsWith("0x")) {
    throw new Error("Invalid recipient address");
  }

  return {
    denomination: req.denomination,
    zk_nullifier: req.zk_nullifier,
    zk_commitment: req.zk_commitment,
    proof: req.proof as string[],
    merkle_path: req.merkle_path as string[],
    path_indices: req.path_indices as number[],
    recipient: req.recipient,
    btc_recipient_hash: (req.btc_recipient_hash as string) ?? "0x0",
  };
}

// ---------------------------------------------------------------------------
// ZK Proof Generation (nargo → bb → garaga)
// ---------------------------------------------------------------------------

const CIRCUITS_DIR = path.resolve(__dirname, "..", "circuits", "ghostsats");
const NARGO_BIN = path.join(os.homedir(), ".nargo", "bin", "nargo");
const BB_BIN = path.join(os.homedir(), ".bb", "bb");
const GARAGA_BIN = "/opt/homebrew/bin/garaga";

// BN254 Poseidon outputs (~2^254) can exceed felt252 max (~2^251).
// Reduce modulo STARK_PRIME so values fit in felt252 for on-chain storage.
// Must match the frontend's computeZKCommitment/computeZKNullifier.
const STARK_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16);
}

let proveLock = false;

async function generateZKProof(
  secret: bigint,
  blinder: bigint,
  denomination: bigint,
): Promise<{ proof: string[]; zkCommitment: string; zkNullifier: string }> {
  // Simple lock to prevent concurrent proof generation
  if (proveLock) throw new Error("Proof generation in progress, try again");
  proveLock = true;

  try {
    // 1. Compute public inputs using BN254 Poseidon (matches Noir circuit)
    const zkCommitment = poseidon3([secret, blinder, denomination]);
    const zkNullifier = poseidon2([secret, 1n]);

    console.log(`[prove] commitment: ${bigintToHex(zkCommitment)}`);
    console.log(`[prove] nullifier:  ${bigintToHex(zkNullifier)}`);

    // 2. Write Prover.toml with inputs
    const proverToml = [
      `secret = "${secret}"`,
      `blinder = "${blinder}"`,
      `zk_commitment = "${bigintToHex(zkCommitment)}"`,
      `nullifier_hash = "${bigintToHex(zkNullifier)}"`,
      `denomination = "${denomination}"`,
    ].join("\n") + "\n";

    const proverPath = path.join(CIRCUITS_DIR, "Prover.toml");
    fs.writeFileSync(proverPath, proverToml);

    // 3. Run nargo execute → generates witness
    console.log(`[prove] Running nargo execute...`);
    await execFileAsync(NARGO_BIN, ["execute"], {
      cwd: CIRCUITS_DIR,
      timeout: 30000,
    });

    // 4. Create temp dir for bb output (bb can't overwrite existing dirs)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ghostsats-proof-"));

    try {
      // 5. Run bb prove → generates proof + public_inputs
      console.log(`[prove] Running bb prove...`);
      const proofDir = path.join(tmpDir, "output");
      await execFileAsync(BB_BIN, [
        "prove",
        "-s", "ultra_honk",
        "--oracle_hash", "keccak",
        "-b", path.join(CIRCUITS_DIR, "target", "ghostsats.json"),
        "-w", path.join(CIRCUITS_DIR, "target", "ghostsats.gz"),
        "-k", path.join(CIRCUITS_DIR, "target", "vk", "vk"),
        "-o", proofDir,
      ], { timeout: 60000 });

      // 6. Run garaga calldata → generates formatted felt252 array
      console.log(`[prove] Running garaga calldata...`);
      const { stdout } = await execFileAsync(GARAGA_BIN, [
        "calldata",
        "--system", "ultra_keccak_zk_honk",
        "--proof", path.join(proofDir, "proof"),
        "--vk", path.join(CIRCUITS_DIR, "target", "vk", "vk"),
        "--public-inputs", path.join(proofDir, "public_inputs"),
        "--format", "array",
      ], { timeout: 30000 });

      // 7. Parse garaga output: [3, 94516880..., 58809484..., ...]
      // Cannot use JSON.parse — JS numbers lose precision for values > 2^53.
      // Extract numbers as strings using regex instead.
      const rawOutput = stdout.trim();
      const numberStrings = rawOutput.match(/\d+/g) ?? [];
      const proof = numberStrings.map((s) => bigintToHex(BigInt(s)));

      // Reduce to felt252 range for on-chain storage (matches frontend)
      const zkCommitmentReduced = zkCommitment % STARK_PRIME;
      const zkNullifierReduced = zkNullifier % STARK_PRIME;

      console.log(`[prove] Success! ${proof.length} calldata elements`);
      console.log(`[prove] commitment (reduced): ${bigintToHex(zkCommitmentReduced)}`);
      console.log(`[prove] nullifier  (reduced): ${bigintToHex(zkNullifierReduced)}`);
      return {
        proof,
        zkCommitment: bigintToHex(zkCommitmentReduced),
        zkNullifier: bigintToHex(zkNullifierReduced),
      };
    } finally {
      // Cleanup temp dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } finally {
    proveLock = false;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function main() {
  if (!privateKey || !accountAddress) {
    console.error("ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
    process.exit(1);
  }

  const poolAddress = getPoolAddress();
  // sncast works reliably with Cartridge RPC for transaction submission,
  // while starknet.js has spec version mismatches with available Sepolia RPCs.
  const SNCAST_RPC = "https://api.cartridge.gg/x/starknet/sepolia";

  console.log(`\nGhostSats Relayer`);
  console.log(`  Pool:    ${poolAddress}`);
  console.log(`  Relayer: ${accountAddress}`);
  console.log(`  Fee:     ${FEE_BPS} bps (${FEE_BPS / 100}%)`);
  console.log(`  RPC:     ${SNCAST_RPC}`);
  console.log();

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", fee_bps: FEE_BPS }));
      return;
    }

    // Info endpoint
    if (req.method === "GET" && req.url === "/info") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          pool: poolAddress,
          relayer: accountAddress,
          fee_bps: FEE_BPS,
          max_fee_bps: MAX_FEE_BPS,
        }),
      );
      return;
    }

    // Prove endpoint — generate ZK proof via nargo → bb → garaga
    if (req.method === "POST" && req.url === "/prove") {
      let body = "";
      req.on("data", (chunk: string) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          const { secret, blinder, denomination } = parsed;

          if (!secret || !blinder || denomination === undefined) {
            throw new Error("Missing required fields: secret, blinder, denomination");
          }

          console.log(`[prove] Generating ZK proof for denomination=${denomination}...`);
          const result = await generateZKProof(
            BigInt(secret),
            BigInt(blinder),
            BigInt(denomination),
          );

          console.log(`[prove] Proof generated: ${result.proof.length} calldata elements`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[prove] Error: ${msg}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: msg }));
        }
      });
      return;
    }

    // Relay endpoint
    if (req.method === "POST" && req.url === "/relay") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        let response: RelayResponse;
        try {
          const parsed = JSON.parse(body);
          const relayReq = validateRequest(parsed);

          console.log(`[relay] Received request:`);
          console.log(`  denomination: ${relayReq.denomination}`);
          console.log(`  recipient:    ${relayReq.recipient}`);
          console.log(`  zk_nullifier: ${relayReq.zk_nullifier.slice(0, 12)}...`);

          // Build calldata for sncast (each felt252 as a separate CLI arg)
          const calldata = CallData.compile({
            denomination: relayReq.denomination,
            zk_nullifier: relayReq.zk_nullifier,
            zk_commitment: relayReq.zk_commitment,
            proof: relayReq.proof,
            merkle_path: relayReq.merkle_path,
            path_indices: relayReq.path_indices,
            recipient: relayReq.recipient,
            relayer: accountAddress,
            fee_bps: { low: BigInt(FEE_BPS), high: 0n },
            btc_recipient_hash: relayReq.btc_recipient_hash,
          });

          // Submit via sncast (reliable with Cartridge RPC, handles signing correctly,
          // while starknet.js has spec version mismatches with available Sepolia RPCs).
          // --calldata takes variadic args: each felt252 as a separate CLI argument.
          console.log(`[relay] Submitting via sncast (${calldata.length} calldata elements)...`);
          const sncastArgs = [
            "--account", "ghostsats-deployer",
            "--json",
            "invoke",
            "--url", SNCAST_RPC,
            "--contract-address", poolAddress,
            "--function", "withdraw_private_via_relayer",
            "--calldata",
            ...calldata,  // spread each felt252 as a separate arg
          ];
          const { stdout } = await execFileAsync("sncast", sncastArgs, {
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024,  // 10MB for large calldata output
          });

          // Parse JSON output — sncast --json emits one JSON object per line:
          // {"command":"invoke","transaction_hash":"0x...","type":"response"}
          const lines = stdout.trim().split("\n");
          let txHash: string | undefined;
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj.transaction_hash) {
                txHash = obj.transaction_hash;
              }
            } catch { /* skip non-JSON lines */ }
          }
          if (!txHash) {
            throw new Error(`sncast invoke failed: ${stdout.slice(0, 500)}`);
          }
          console.log(`[relay] tx: ${txHash}`);

          // Wait for confirmation via sncast tx-status (hash is positional arg)
          console.log(`[relay] Waiting for confirmation...`);
          let confirmed = false;
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const { stdout: statusOut } = await execFileAsync("sncast", [
                "--json",
                "tx-status",
                "--url", SNCAST_RPC,
                txHash,
              ], { timeout: 15000 });
              if (statusOut.includes("AcceptedOnL2") || statusOut.includes("AcceptedOnL1")) {
                confirmed = true;
                break;
              }
              if (statusOut.includes("Rejected")) {
                throw new Error("Transaction rejected");
              }
            } catch { /* retry */ }
          }
          console.log(`[relay] ${confirmed ? "Confirmed!" : "Timed out waiting"}`);

          response = {
            success: true,
            txHash,
            fee_bps: FEE_BPS,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[relay] Error: ${msg}`);
          response = { success: false, error: msg };
        }

        res.writeHead(response.success ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(response));
      });
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(PORT, () => {
    console.log(`Relayer + Prover listening on http://localhost:${PORT}`);
    console.log(`  POST /prove   — Generate a ZK proof (nargo → bb → garaga)`);
    console.log(`  POST /relay   — Submit a gasless withdrawal`);
    console.log(`  GET  /health  — Health check`);
    console.log(`  GET  /info    — Relayer info`);
    console.log();
  });
}

main().catch((err) => {
  console.error("Relayer startup failed:", err);
  process.exit(1);
});
