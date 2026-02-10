/**
 * GhostSats Relayer Service
 *
 * Submits ZK-private withdrawals on behalf of users so they don't
 * need to pay gas. The relayer takes a configurable fee (default 2%, max 5%).
 *
 * Usage:
 *   npm run relayer            — Start relayer server on port 3001
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
import { Account, RpcProvider, CallData, Contract, json } from "starknet";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

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
const rpcUrl = process.env.STARKNET_RPC_URL ?? "https://starknet-sepolia-rpc.publicnode.com";

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
// Server
// ---------------------------------------------------------------------------

async function main() {
  if (!privateKey || !accountAddress) {
    console.error("ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
    process.exit(1);
  }

  const poolAddress = getPoolAddress();
  console.log(`\nGhostSats Relayer`);
  console.log(`  Pool:    ${poolAddress}`);
  console.log(`  Relayer: ${accountAddress}`);
  console.log(`  Fee:     ${FEE_BPS} bps (${FEE_BPS / 100}%)`);
  console.log(`  RPC:     ${rpcUrl}`);
  console.log();

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey);

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

          // Submit withdrawal on behalf of user
          const calls = [
            {
              contractAddress: poolAddress,
              entrypoint: "withdraw_private_via_relayer",
              calldata: CallData.compile({
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
              }),
            },
          ];

          const result = await account.execute(calls);
          console.log(`[relay] tx: ${result.transaction_hash}`);

          await provider.waitForTransaction(result.transaction_hash);
          console.log(`[relay] Confirmed!`);

          response = {
            success: true,
            txHash: result.transaction_hash,
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
    console.log(`Relayer listening on http://localhost:${PORT}`);
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
