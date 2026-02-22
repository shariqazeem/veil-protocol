/**
 * Deploy Garaga ZK Verifier to mainnet and update ShieldedPool's zk_verifier address.
 *
 * Usage:
 *   npx ts-node --esm scripts/deploy-verifier-mainnet.ts
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Account, RpcProvider, json, constants, CallData, hash, stark, ec } from "starknet";
import type { DeclareContractPayload, UniversalDetails } from "starknet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POOL_ADDRESS = "0x3fe6c90b13d29826bc3c75f368c17719a475c2abbc3d9ebb7b2225ddadd5e21";

function verifierArtifactPath(filename: string): string {
  return path.resolve(__dirname, "..", "circuits", "ghostsats", "zk_verifier", "target", "dev", filename);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const accountAddress = process.env.ACCOUNT_ADDRESS!;
  const rpcUrl = process.env.STARKNET_RPC_URL ?? "https://rpc.starknet.lava.build";

  if (!privateKey || !accountAddress) {
    console.error("ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set in .env");
    process.exit(1);
  }

  console.log(`\nConnecting to Starknet Mainnet at ${rpcUrl} ...`);
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
  const chainId = await provider.getChainId();
  console.log(`Chain ID: ${chainId}`);
  console.log(`Account: ${accountAddress}\n`);

  // =========================================================================
  // Step 1: Declare Garaga ZK Verifier
  // =========================================================================
  console.log("========================================");
  console.log("Step 1 — Declare Garaga ZK Verifier");
  console.log("========================================");

  const sierraPath = verifierArtifactPath("zk_verifier_UltraKeccakZKHonkVerifier.contract_class.json");
  const casmPath = verifierArtifactPath("zk_verifier_UltraKeccakZKHonkVerifier.compiled_contract_class.json");

  if (!fs.existsSync(sierraPath) || !fs.existsSync(casmPath)) {
    console.error("Verifier artifacts not found. Run: cd circuits/ghostsats/zk_verifier && scarb build");
    process.exit(1);
  }

  const sierra = json.parse(fs.readFileSync(sierraPath).toString("ascii"));
  const casm = json.parse(fs.readFileSync(casmPath).toString("ascii"));

  // Manually set high resource bounds to skip fee estimation (free RPCs reject
  // the enormous estimateFee payload for this ~1.7MB contract).
  // ShieldedPool (1.36MB) cost ~31 STRK. Budget 50 STRK for the larger verifier.
  const declareDetails: UniversalDetails = {
    resourceBounds: {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: "0x1E8480", max_price_per_unit: "0x174876E800" },
      l1_data_gas: { max_amount: "0x186A0", max_price_per_unit: "0x174876E800" },
    },
    skipValidate: true,
  };

  let classHash: string;
  const payload: DeclareContractPayload = { contract: sierra, casm };

  try {
    console.log("  Declaring (with manual resource bounds, skipping estimation) ...");
    const declareRes = await account.declare(payload, declareDetails);
    console.log(`  tx: ${declareRes.transaction_hash}`);
    console.log("  Waiting for confirmation ...");
    await provider.waitForTransaction(declareRes.transaction_hash);
    classHash = declareRes.class_hash;
    console.log(`  Class hash: ${classHash}\n`);
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    const data: string = JSON.stringify(err?.baseError?.data ?? {});
    console.log(`  Error msg: ${msg.slice(0, 300)}`);
    console.log(`  Error data: ${data.slice(0, 300)}`);

    if (msg.includes("already declared") || msg.includes("class already declared")) {
      classHash = hash.computeContractClassHash(sierra);
      console.log(`  Already declared. Class hash: ${classHash}\n`);
    } else {
      // Handle CASM hash mismatch
      const mismatchMatch = (data + msg).match(/Expected:\s*(0x[0-9a-fA-F]+)/);
      if (mismatchMatch && (msg.includes("Mismatch compiled class hash") || msg.includes("mismatch"))) {
        const expectedCasmHash = mismatchMatch[1];
        console.log(`  CASM hash mismatch — retrying with expected hash: ${expectedCasmHash}`);
        const retryPayload: DeclareContractPayload = { contract: sierra, casm, compiledClassHash: expectedCasmHash };
        try {
          const retryRes = await account.declare(retryPayload, declareDetails);
          console.log(`  tx: ${retryRes.transaction_hash}`);
          console.log("  Waiting for confirmation ...");
          await provider.waitForTransaction(retryRes.transaction_hash);
          classHash = retryRes.class_hash;
          console.log(`  Class hash: ${classHash}\n`);
        } catch (retryErr: any) {
          const retryMsg: string = retryErr?.message ?? String(retryErr);
          if (retryMsg.includes("already declared") || retryMsg.includes("class already declared")) {
            classHash = hash.computeContractClassHash(sierra);
            console.log(`  Already declared. Class hash: ${classHash}\n`);
          } else {
            throw retryErr;
          }
        }
      } else {
        throw err;
      }
    }
  }

  // =========================================================================
  // Step 2: Deploy Garaga ZK Verifier
  // =========================================================================
  console.log("========================================");
  console.log("Step 2 — Deploy Garaga ZK Verifier");
  console.log("========================================");

  console.log(`  Deploying class ${classHash!} ...`);
  const deployRes = await account.deployContract({ classHash: classHash!, constructorCalldata: [] });
  console.log(`  tx: ${deployRes.transaction_hash}`);
  console.log("  Waiting for confirmation ...");
  await provider.waitForTransaction(deployRes.transaction_hash);
  const verifierAddress = deployRes.contract_address;
  console.log(`  Verifier deployed at: ${verifierAddress}\n`);

  // =========================================================================
  // Step 3: Call set_zk_verifier on ShieldedPool
  // =========================================================================
  console.log("========================================");
  console.log("Step 3 — Update ShieldedPool zk_verifier");
  console.log("========================================");

  console.log(`  Pool: ${POOL_ADDRESS}`);
  console.log(`  New verifier: ${verifierAddress}`);

  console.log("  Sending set_zk_verifier tx ...");
  const invokeRes = await account.execute([
    {
      contractAddress: POOL_ADDRESS,
      entrypoint: "set_zk_verifier",
      calldata: CallData.compile({ verifier: verifierAddress }),
    },
  ]);
  console.log(`  tx: ${invokeRes.transaction_hash}`);
  console.log("  Waiting for confirmation ...");
  await provider.waitForTransaction(invokeRes.transaction_hash);
  console.log("  ShieldedPool zk_verifier updated!\n");

  // =========================================================================
  // Step 4: Summary
  // =========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("  VERIFIER DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  ZK Verifier: ${verifierAddress}`);
  console.log(`  ShieldedPool: ${POOL_ADDRESS}`);
  console.log(`  View: https://voyager.online/contract/${verifierAddress}`);
  console.log();

  // Update addresses.json
  const addressesPath = path.resolve(__dirname, "..", "frontend", "src", "contracts", "addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
  addresses.contracts.garagaVerifier = verifierAddress;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2) + "\n");
  console.log(`  Updated addresses.json with new verifier address.`);

  // Update .env
  const envPath = path.resolve(__dirname, ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(
    /^ZK_VERIFIER_ADDRESS=.*/m,
    `ZK_VERIFIER_ADDRESS=${verifierAddress}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`  Updated .env with new ZK_VERIFIER_ADDRESS.`);
}

main().catch((err) => {
  console.error("\nDeployment failed:", err);
  process.exit(1);
});
