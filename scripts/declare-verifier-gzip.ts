/**
 * Declare Garaga ZK Verifier on mainnet using gzip-compressed HTTP request
 * to bypass RPC payload size limits.
 *
 * Usage: npx ts-node --esm scripts/declare-verifier-gzip.ts
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as http from "http";
import * as https from "https";
import { fileURLToPath } from "url";
import { Account, RpcProvider, json, constants, CallData, hash as snHash, ec, encode } from "starknet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POOL_ADDRESS = "0x3fe6c90b13d29826bc3c75f368c17719a475c2abbc3d9ebb7b2225ddadd5e21";
const RPC_URL = process.env.STARKNET_RPC_URL ?? "https://starknet-rpc.publicnode.com";

function verifierPath(filename: string): string {
  return path.resolve(__dirname, "..", "circuits", "ghostsats", "zk_verifier", "target", "dev", filename);
}

/** Send a JSON-RPC request with gzip Content-Encoding */
async function gzipRpc(url: string, body: object): Promise<any> {
  const jsonStr = JSON.stringify(body);
  const compressed = zlib.gzipSync(Buffer.from(jsonStr));
  console.log(`  Payload: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB raw → ${(compressed.length / 1024).toFixed(0)} KB gzipped`);

  const parsed = new URL(url);
  const mod = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
          "Content-Length": compressed.length,
          "Accept-Encoding": "gzip",
        },
        timeout: 120_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          let data = Buffer.concat(chunks);
          if (res.headers["content-encoding"] === "gzip") {
            data = zlib.gunzipSync(data);
          }
          const text = data.toString("utf-8");
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error(`Non-JSON response (${res.statusCode}): ${text.slice(0, 500)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(compressed);
    req.end();
  });
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const accountAddress = process.env.ACCOUNT_ADDRESS!;

  if (!privateKey || !accountAddress) {
    console.error("ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
    process.exit(1);
  }

  console.log(`\nRPC: ${RPC_URL}`);
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, accountAddress, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
  const chainId = await provider.getChainId();
  console.log(`Chain: ${chainId}  Account: ${accountAddress}\n`);

  // Load artifacts
  const sierraPath = verifierPath("zk_verifier_UltraKeccakZKHonkVerifier.contract_class.json");
  const casmPath = verifierPath("zk_verifier_UltraKeccakZKHonkVerifier.compiled_contract_class.json");
  const sierra = json.parse(fs.readFileSync(sierraPath).toString("ascii"));
  const casm = json.parse(fs.readFileSync(casmPath).toString("ascii"));

  // Compute hashes
  const sierraClassHash = snHash.computeContractClassHash(sierra);
  const compiledClassHash = snHash.computeCompiledClassHash(casm);
  console.log(`Sierra class hash:   ${sierraClassHash}`);
  console.log(`Compiled class hash: ${compiledClassHash}`);

  // Check if already declared
  try {
    await provider.getClass(sierraClassHash);
    console.log("\nClass already declared on-chain! Skipping to deploy...\n");
  } catch {
    console.log("\nClass not yet declared. Declaring...\n");

    // Get nonce
    const nonce = await provider.getNonceForAddress(accountAddress);
    console.log(`Nonce: ${nonce}`);

    // Resource bounds (generous for large declare)
    const resourceBounds = {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: "0x1E8480", max_price_per_unit: "0x174876E800" },  // 2M units @ 100 gwei
      l1_data_gas: { max_amount: "0x186A0", max_price_per_unit: "0x174876E800" },  // 100K units @ 100 gwei
    };

    // Build the declare V3 transaction
    // We need to sign it ourselves since we're bypassing starknet.js's RPC layer
    const declarePayload = {
      contract: sierra,
      casm: casm,
      compiledClassHash: compiledClassHash,
    };

    // Use starknet.js to build + sign the declare tx, then intercept and send via gzip
    // Actually, let's use account.declare but with a patched provider
    // Simpler approach: use account.buildDeclarePayload

    // Let's try the simplest possible approach: just use account.declare with manual resource bounds
    // but patch the provider's fetchEndpoint to use gzip
    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (input: any, init: any) => {
      const url = typeof input === "string" ? input : input.url;
      // Only intercept RPC calls to our endpoint
      if (url.includes(new URL(RPC_URL).hostname) && init?.body) {
        const body = typeof init.body === "string" ? init.body : await init.body;
        const bodyStr = typeof body === "string" ? body : new TextDecoder().decode(body);

        // Check if this is a large request (declare tx)
        if (bodyStr.length > 500_000) {
          console.log("  [gzip] Intercepting large RPC request...");
          try {
            const result = await gzipRpc(RPC_URL, JSON.parse(bodyStr));
            // Return a fake Response object
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (err: any) {
            console.log(`  [gzip] Error: ${err.message}`);
            throw err;
          }
        }
      }
      return origFetch(input, init);
    };

    try {
      console.log("  Declaring with gzip-compressed payload...");
      const declareRes = await account.declare(declarePayload, {
        resourceBounds,
        skipValidate: true,
      });
      console.log(`  TX: ${declareRes.transaction_hash}`);
      console.log(`  Class hash: ${declareRes.class_hash}`);
      console.log("  Waiting for confirmation...");
      await provider.waitForTransaction(declareRes.transaction_hash);
      console.log("  Declared!\n");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const data = JSON.stringify(err?.baseError?.data ?? {});
      console.log(`  Error: ${msg.slice(0, 400)}`);
      console.log(`  Data: ${data.slice(0, 400)}`);

      // Handle CASM hash mismatch
      const mismatchMatch = (data + msg).match(/Expected:\s*(0x[0-9a-fA-F]+)/);
      if (mismatchMatch && (msg.includes("Mismatch") || msg.includes("mismatch"))) {
        const expectedHash = mismatchMatch[1];
        console.log(`\n  CASM mismatch. Retrying with expected hash: ${expectedHash}`);
        const retryRes = await account.declare(
          { contract: sierra, casm, compiledClassHash: expectedHash },
          { resourceBounds, skipValidate: true }
        );
        console.log(`  TX: ${retryRes.transaction_hash}`);
        console.log("  Waiting for confirmation...");
        await provider.waitForTransaction(retryRes.transaction_hash);
        console.log("  Declared!\n");
      } else if (msg.includes("already declared") || msg.includes("class already declared")) {
        console.log("  Already declared!\n");
      } else {
        throw err;
      }
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }

  // =========================================================================
  // Step 2: Deploy
  // =========================================================================
  console.log("========================================");
  console.log("Step 2 — Deploy Garaga ZK Verifier");
  console.log("========================================");

  const deployRes = await account.deployContract({ classHash: sierraClassHash, constructorCalldata: [] });
  console.log(`  TX: ${deployRes.transaction_hash}`);
  console.log("  Waiting...");
  await provider.waitForTransaction(deployRes.transaction_hash);
  const verifierAddress = deployRes.contract_address;
  console.log(`  Deployed at: ${verifierAddress}\n`);

  // =========================================================================
  // Step 3: set_zk_verifier
  // =========================================================================
  console.log("========================================");
  console.log("Step 3 — Update ShieldedPool zk_verifier");
  console.log("========================================");

  const invokeRes = await account.execute([{
    contractAddress: POOL_ADDRESS,
    entrypoint: "set_zk_verifier",
    calldata: CallData.compile({ verifier: verifierAddress }),
  }]);
  console.log(`  TX: ${invokeRes.transaction_hash}`);
  console.log("  Waiting...");
  await provider.waitForTransaction(invokeRes.transaction_hash);
  console.log("  Updated!\n");

  // =========================================================================
  // Summary + file updates
  // =========================================================================
  console.log("=".repeat(60));
  console.log("  VERIFIER DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  ZK Verifier:  ${verifierAddress}`);
  console.log(`  ShieldedPool: ${POOL_ADDRESS}`);
  console.log(`  Voyager: https://voyager.online/contract/${verifierAddress}\n`);

  // Update addresses.json
  const addrPath = path.resolve(__dirname, "..", "frontend", "src", "contracts", "addresses.json");
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
  addrs.contracts.garagaVerifier = verifierAddress;
  fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2) + "\n");
  console.log("  Updated addresses.json");

  // Update .env
  const envPath = path.resolve(__dirname, ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(/^ZK_VERIFIER_ADDRESS=.*/m, `ZK_VERIFIER_ADDRESS=${verifierAddress}`);
  fs.writeFileSync(envPath, envContent);
  console.log("  Updated .env");
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
