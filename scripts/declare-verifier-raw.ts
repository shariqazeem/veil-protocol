/**
 * Declare Garaga ZK Verifier on Starknet mainnet.
 * Patches global fetch to gzip-compress large payloads, bypassing free RPC body limits.
 *
 * Usage: cd scripts && npx ts-node --esm declare-verifier-raw.ts
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POOL_ADDRESS = "0x3fe6c90b13d29826bc3c75f368c17719a475c2abbc3d9ebb7b2225ddadd5e21";
const RPC_URL = process.env.STARKNET_RPC_URL ?? "https://starknet-rpc.publicnode.com";
// No gzip patch — Alchemy supports 2.5MB raw payloads

// ============================================================================
// Now import starknet.js (after fetch is patched)
// ============================================================================
const { Account, RpcProvider, json, constants, CallData, hash: snHash } = await import("starknet");

function verifierPath(fn: string): string {
  return path.resolve(__dirname, "..", "circuits", "ghostsats", "zk_verifier", "target", "dev", fn);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const accountAddress = process.env.ACCOUNT_ADDRESS!;

  if (!privateKey || !accountAddress) {
    console.error("ERROR: Set PRIVATE_KEY and ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }

  console.log(`RPC: ${RPC_URL}`);
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, accountAddress, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
  const chainId = await provider.getChainId();
  console.log(`Chain: ${chainId}  Account: ${accountAddress}\n`);

  // Load artifacts
  const sierra = json.parse(fs.readFileSync(verifierPath("zk_verifier_UltraKeccakZKHonkVerifier.contract_class.json")).toString("ascii"));
  const casm = json.parse(fs.readFileSync(verifierPath("zk_verifier_UltraKeccakZKHonkVerifier.compiled_contract_class.json")).toString("ascii"));

  const sierraClassHash = snHash.computeContractClassHash(sierra);
  const compiledClassHash = snHash.computeCompiledClassHash(casm);
  console.log(`Sierra class hash:   ${sierraClassHash}`);
  console.log(`Compiled class hash: ${compiledClassHash}`);

  // Check if already declared
  let alreadyDeclared = false;
  try {
    await provider.getClass(sierraClassHash);
    console.log("\nAlready declared on-chain! Skipping to deploy.\n");
    alreadyDeclared = true;
  } catch {
    console.log("\nNot yet declared. Declaring...\n");
  }

  if (!alreadyDeclared) {
    const resourceBounds = {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: "0x1E8480", max_price_per_unit: "0x174876E800" },
      l1_data_gas: { max_amount: "0x186A0", max_price_per_unit: "0x174876E800" },
    };

    try {
      console.log("  Declaring (letting Alchemy estimate fees)...");
      const declareRes = await account.declare(
        { contract: sierra, casm },
      );
      console.log(`  TX: ${declareRes.transaction_hash}`);
      console.log(`  Class: ${declareRes.class_hash}`);
      console.log("  Waiting for confirmation...");
      await provider.waitForTransaction(declareRes.transaction_hash);
      console.log("  Declared!\n");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const data = JSON.stringify(err?.baseError?.data ?? {});
      // Extract just the error code/message, not the full sierra dump
      const codeMatch = msg.match(/(-?\d+): (.+?)(?:\n|$)/);
      const rpcErrMsg = err?.baseError?.message ?? (codeMatch ? `code ${codeMatch[1]}: ${codeMatch[2]}` : msg.slice(0, 200));
      console.log(`  RPC Error: ${rpcErrMsg}`);
      console.log(`  Error code: ${err?.baseError?.code}`);
      console.log(`  Data: ${data.slice(0, 1000)}`);

      // Handle CASM hash mismatch
      const mismatchMatch = (data + msg).match(/Expected:\s*(0x[0-9a-fA-F]+)/);
      if (mismatchMatch && (msg.includes("Mismatch") || msg.includes("mismatch"))) {
        const expectedHash = mismatchMatch[1];
        console.log(`\n  CASM mismatch. Retrying with expected: ${expectedHash}`);
        // Use manual resource bounds — auto-estimation overestimates wildly for large contracts
        const retryBounds = {
          l1_gas: { max_amount: "0x0", max_price_per_unit: "0x5AF3107A4000" },  // 0 amount, price 100T Fri (>= actual ~46T)
          l2_gas: { max_amount: "0x12A05F200", max_price_per_unit: "0x6FC23AC00" },  // 5B units @ 30 gwei = 150 STRK max
          l1_data_gas: { max_amount: "0x200", max_price_per_unit: "0x4A817C800" },  // 512 units @ 20 gwei
        };
        try {
          const retryRes = await account.declare(
            { contract: sierra, casm, compiledClassHash: expectedHash },
            { resourceBounds: retryBounds, skipValidate: true },
          );
          console.log(`  TX: ${retryRes.transaction_hash}`);
          console.log("  Waiting...");
          await provider.waitForTransaction(retryRes.transaction_hash);
          console.log("  Declared!\n");
        } catch (retryErr: any) {
          const retryMsg = retryErr?.baseError?.message ?? retryErr?.message ?? String(retryErr);
          const retryData = JSON.stringify(retryErr?.baseError?.data ?? {});
          console.log(`  Retry error: ${retryMsg.slice(0, 500)}`);
          console.log(`  Retry data: ${retryData.slice(0, 500)}`);
          if (retryMsg.includes("already declared") || retryMsg.includes("class already declared")) {
            console.log("  Already declared!\n");
          } else {
            throw retryErr;
          }
        }
      } else if (msg.includes("already declared") || msg.includes("class already declared")) {
        console.log("  Already declared!\n");
      } else {
        throw err;
      }
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
  // Summary
  // =========================================================================
  console.log("=".repeat(60));
  console.log("  VERIFIER DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  ZK Verifier:  ${verifierAddress}`);
  console.log(`  ShieldedPool: ${POOL_ADDRESS}`);
  console.log(`  Voyager: https://voyager.online/contract/${verifierAddress}\n`);

  const addrPath = path.resolve(__dirname, "..", "frontend", "src", "contracts", "addresses.json");
  const addrs = JSON.parse(fs.readFileSync(addrPath, "utf-8"));
  addrs.contracts.garagaVerifier = verifierAddress;
  fs.writeFileSync(addrPath, JSON.stringify(addrs, null, 2) + "\n");
  console.log("  Updated addresses.json");

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
