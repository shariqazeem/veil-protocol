/**
 * Veil Protocol - Starknet Sepolia Deployment Script
 *
 * Modes:
 *   npm run deploy          — Deploy with mock tokens + mock Avnu router (dev/test)
 *   npm run deploy:live     — Deploy ShieldedPool only, using real Sepolia tokens + Avnu
 *
 * Declares and deploys:
 *   Dev mode:
 *     1. MockERC20      (USDC mock)
 *     2. MockERC20      (WBTC mock)
 *     3. MockAvnuRouter
 *     4. ShieldedPool
 *
 *   Live mode:
 *     1. ShieldedPool only (uses real USDC, WBTC, Avnu addresses)
 *
 * Prerequisites:
 *   1. Build the contracts:  cd contracts && scarb build
 *   2. Copy .env.example to .env and fill in PRIVATE_KEY and ACCOUNT_ADDRESS.
 *   3. Install dependencies: cd scripts && npm install
 *   4. Run: npm run deploy (or npm run deploy:live)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  Account,
  RpcProvider,
  CallData,
  json,
  constants,
  type DeclareContractPayload,
} from "starknet";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Live Sepolia Addresses
// ---------------------------------------------------------------------------

const LIVE_ADDRESSES = {
  usdc: "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080",
  wbtc: "0x00452bd5c0512a61df7c7be8cfea5e4f893cb40e126bdc40aee6054db955129e",
  avnuRouter:
    "0x02c56e8b00dbe2a71e57472685378fc8988bba947e9a99b26a00fade2b4fe7c2",
};

// ---------------------------------------------------------------------------
// Mainnet Addresses
// ---------------------------------------------------------------------------

const MAINNET_ADDRESSES = {
  usdc: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  wbtc: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
  avnuRouter:
    "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function artifactPath(filename: string): string {
  return path.resolve(__dirname, "..", "contracts", "target", "dev", filename);
}

function verifierArtifactPath(filename: string): string {
  return path.resolve(__dirname, "..", "circuits", "ghostsats", "zk_verifier", "target", "dev", filename);
}

function loadArtifact(filename: string): any {
  const fullPath = artifactPath(filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Artifact not found: ${fullPath}\n` +
        `Make sure you have run "scarb build" in the contracts/ directory ` +
        `with casm = true in Scarb.toml.`
    );
  }
  return json.parse(fs.readFileSync(fullPath).toString("ascii"));
}

async function declareContract(
  account: Account,
  provider: RpcProvider,
  sierraFilename: string,
  casmFilename: string
): Promise<string> {
  const compiledSierra = loadArtifact(sierraFilename);
  const compiledCasm = loadArtifact(casmFilename);

  const payload: DeclareContractPayload = {
    contract: compiledSierra,
    casm: compiledCasm,
  };

  try {
    console.log(`  Declaring ${sierraFilename} ...`);
    const declareResponse = await account.declare(payload);
    console.log(`  tx: ${declareResponse.transaction_hash}`);
    console.log(`  Waiting for transaction ...`);
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log(`  Class hash: ${declareResponse.class_hash}`);
    return declareResponse.class_hash;
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    const data: string = JSON.stringify(err?.baseError?.data ?? {});
    console.log(`  Declare error msg: ${msg.slice(0, 200)}`);
    console.log(`  Declare error data: ${data.slice(0, 200)}`);
    if (
      msg.includes("already declared") ||
      msg.includes("class already declared")
    ) {
      const { hash } = await import("starknet");
      const classHash = hash.computeContractClassHash(compiledSierra);
      console.log(`  Already declared. Class hash: ${classHash}`);
      return classHash;
    }
    // Handle CASM hash mismatch: extract expected hash and retry
    const mismatchMatch = (data + msg).match(/Expected:\s*(0x[0-9a-fA-F]+)/);
    if (mismatchMatch && msg.includes("Mismatch compiled class hash")) {
      const expectedCasmHash = mismatchMatch[1];
      console.log(`  CASM hash mismatch — retrying with expected hash: ${expectedCasmHash}`);
      const retryPayload: DeclareContractPayload = {
        contract: compiledSierra,
        casm: compiledCasm,
        compiledClassHash: expectedCasmHash,
      };
      try {
        const retryResponse = await account.declare(retryPayload);
        console.log(`  tx: ${retryResponse.transaction_hash}`);
        console.log(`  Waiting for transaction ...`);
        await provider.waitForTransaction(retryResponse.transaction_hash);
        console.log(`  Class hash: ${retryResponse.class_hash}`);
        return retryResponse.class_hash;
      } catch (retryErr: any) {
        const retryMsg: string = retryErr?.message ?? String(retryErr);
        if (retryMsg.includes("already declared") || retryMsg.includes("class already declared")) {
          const { hash } = await import("starknet");
          const classHash = hash.computeContractClassHash(compiledSierra);
          console.log(`  Already declared. Class hash: ${classHash}`);
          return classHash;
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

async function deployContract(
  account: Account,
  provider: RpcProvider,
  classHash: string,
  constructorCalldata: any[] = []
): Promise<string> {
  console.log(`  Deploying class ${classHash} ...`);
  const deployResponse = await account.deployContract({
    classHash,
    constructorCalldata,
  });
  console.log(`  tx: ${deployResponse.transaction_hash}`);
  console.log(`  Waiting for transaction ...`);
  await provider.waitForTransaction(deployResponse.transaction_hash);
  console.log(`  Contract address: ${deployResponse.contract_address}`);
  return deployResponse.contract_address;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isLive = process.argv.includes("--live");
  const isMainnet = process.argv.includes("--mainnet");

  // Safety: mainnet requires --confirm flag
  if (isMainnet && !process.argv.includes("--confirm")) {
    console.error(
      "\n  ⚠️  DEPLOYING TO MAINNET ⚠️\n" +
        "  This will deploy contracts to Starknet MAINNET using real funds.\n" +
        "  Add --confirm to proceed:\n\n" +
        "    npm run deploy:mainnet -- --confirm\n"
    );
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const defaultRpc = isMainnet
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com";
  const rpcUrl = process.env.STARKNET_RPC_URL ?? defaultRpc;
  const networkName = isMainnet ? "Mainnet" : "Sepolia";
  const explorerBase = isMainnet
    ? "https://voyager.online/contract/"
    : "https://sepolia.voyager.online/contract/";

  if (!privateKey || !accountAddress) {
    console.error(
      "ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set.\n" +
        "Copy .env.example to .env and fill in the values."
    );
    process.exit(1);
  }

  console.log(`\nConnecting to Starknet ${networkName} at ${rpcUrl} ...`);
  const modeLabel = isMainnet
    ? "MAINNET (real tokens + Avnu)"
    : isLive
      ? "LIVE (real Sepolia tokens + Avnu)"
      : "DEV (mock tokens + mock router)";
  console.log(`Mode: ${modeLabel}\n`);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  // Use V1 (ETH gas) with --eth-gas flag, otherwise V3 (STRK gas)
  const useEthGas = process.argv.includes("--eth-gas");
  const txVersion = useEthGas
    ? constants.TRANSACTION_VERSION.V1
    : constants.TRANSACTION_VERSION.V3;
  console.log(`Gas token: ${useEthGas ? "ETH (V1)" : "STRK (V3)"}`);
  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, txVersion,
  );
  const chainId = await provider.getChainId();
  console.log(`Chain ID: ${chainId}\n`);

  let usdcAddress: string;
  let wbtcAddress: string;
  let routerAddress: string;
  let mockERC20ClassHash = "";
  let mockAvnuRouterClassHash = "";

  if (isMainnet) {
    // =====================================================================
    // MAINNET MODE: Use real mainnet tokens + Avnu
    // =====================================================================
    usdcAddress = MAINNET_ADDRESSES.usdc;
    wbtcAddress = MAINNET_ADDRESSES.wbtc;
    routerAddress = MAINNET_ADDRESSES.avnuRouter;

    console.log("Using MAINNET addresses:");
    console.log(`  USDC:        ${usdcAddress}`);
    console.log(`  WBTC:        ${wbtcAddress}`);
    console.log(`  Avnu Router: ${routerAddress}`);
    console.log();
  } else if (isLive) {
    // =====================================================================
    // LIVE MODE: Use real Sepolia tokens + Avnu
    // =====================================================================
    usdcAddress = LIVE_ADDRESSES.usdc;
    wbtcAddress = LIVE_ADDRESSES.wbtc;
    routerAddress = LIVE_ADDRESSES.avnuRouter;

    console.log("Using live Sepolia addresses:");
    console.log(`  USDC:        ${usdcAddress}`);
    console.log(`  WBTC:        ${wbtcAddress}`);
    console.log(`  Avnu Router: ${routerAddress}`);
    console.log();
  } else {
    // =====================================================================
    // DEV MODE: Deploy mock tokens + mock router
    // =====================================================================

    console.log("========================================");
    console.log("Step 1 - Declare MockERC20");
    console.log("========================================");
    mockERC20ClassHash = await declareContract(
      account,
      provider,
      "ghost_sats_MockERC20.contract_class.json",
      "ghost_sats_MockERC20.compiled_contract_class.json"
    );

    console.log("\n========================================");
    console.log("Step 2 - Declare MockAvnuRouter");
    console.log("========================================");
    mockAvnuRouterClassHash = await declareContract(
      account,
      provider,
      "ghost_sats_MockAvnuRouter.contract_class.json",
      "ghost_sats_MockAvnuRouter.compiled_contract_class.json"
    );

    console.log("\n========================================");
    console.log("Step 3 - Deploy MockERC20 as USDC");
    console.log("========================================");
    const erc20Sierra = loadArtifact("ghost_sats_MockERC20.contract_class.json");
    const erc20CallData = new CallData(erc20Sierra.abi);
    const usdcConstructor = erc20CallData.compile("constructor", {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
    });
    usdcAddress = await deployContract(account, provider, mockERC20ClassHash, usdcConstructor);

    console.log("\n========================================");
    console.log("Step 4 - Deploy MockERC20 as WBTC");
    console.log("========================================");
    const wbtcConstructor = erc20CallData.compile("constructor", {
      name: "Wrapped BTC",
      symbol: "WBTC",
      decimals: 8,
    });
    wbtcAddress = await deployContract(account, provider, mockERC20ClassHash, wbtcConstructor);

    console.log("\n========================================");
    console.log("Step 5 - Deploy MockAvnuRouter");
    console.log("========================================");
    const routerSierra = loadArtifact("ghost_sats_MockAvnuRouter.contract_class.json");
    const routerCallData = new CallData(routerSierra.abi);
    const routerConstructor = routerCallData.compile("constructor", {
      rate_numerator: { low: 1n, high: 0n },
      rate_denominator: { low: 1n, high: 0n },
    });

    routerAddress = await deployContract(
      account,
      provider,
      mockAvnuRouterClassHash,
      routerConstructor
    );
  }

  // =====================================================================
  // Deploy ShieldedPool (both modes)
  // =====================================================================

  const stepNum = isLive ? 1 : 6;
  console.log(`\n========================================`);
  console.log(`Step ${stepNum} - Declare ShieldedPool`);
  console.log("========================================");
  const shieldedPoolClassHash = await declareContract(
    account,
    provider,
    "ghost_sats_ShieldedPool.contract_class.json",
    "ghost_sats_ShieldedPool.compiled_contract_class.json"
  );

  console.log(`\n========================================`);
  console.log(`Step ${stepNum + 1} - Deploy ShieldedPool`);
  console.log("========================================");
  const poolSierra = loadArtifact("ghost_sats_ShieldedPool.contract_class.json");
  const poolCallData = new CallData(poolSierra.abi);
  // ZK verifier — deploy Garaga verifier or use existing address
  let zkVerifierAddress = process.env.ZK_VERIFIER_ADDRESS;
  if (!zkVerifierAddress || zkVerifierAddress === "0x0") {
    // Auto-deploy the Garaga UltraKeccakZKHonk verifier
    const verifierSierraPath = verifierArtifactPath("zk_verifier_UltraKeccakZKHonkVerifier.contract_class.json");
    const verifierCasmPath = verifierArtifactPath("zk_verifier_UltraKeccakZKHonkVerifier.compiled_contract_class.json");
    if (!fs.existsSync(verifierSierraPath) || !fs.existsSync(verifierCasmPath)) {
      console.error("\n  ❌ ZK_VERIFIER_ADDRESS not set and Garaga verifier artifacts not found.\n" +
        "  Either set ZK_VERIFIER_ADDRESS in .env or build the verifier:\n" +
        "    cd circuits/ghostsats/zk_verifier && scarb build\n");
      process.exit(1);
    }

    console.log(`\n========================================`);
    console.log(`Step ${stepNum} - Declare Garaga ZK Verifier`);
    console.log("========================================");
    const verifierSierra = json.parse(fs.readFileSync(verifierSierraPath).toString("ascii"));
    const verifierCasm = json.parse(fs.readFileSync(verifierCasmPath).toString("ascii"));
    const verifierPayload: DeclareContractPayload = { contract: verifierSierra, casm: verifierCasm };
    let verifierClassHash: string;
    try {
      console.log("  Declaring Garaga verifier ...");
      const declareRes = await account.declare(verifierPayload);
      console.log(`  tx: ${declareRes.transaction_hash}`);
      await provider.waitForTransaction(declareRes.transaction_hash);
      verifierClassHash = declareRes.class_hash;
      console.log(`  Class hash: ${verifierClassHash}`);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("already declared") || msg.includes("class already declared")) {
        const { hash } = await import("starknet");
        verifierClassHash = hash.computeContractClassHash(verifierSierra);
        console.log(`  Already declared. Class hash: ${verifierClassHash}`);
      } else {
        throw err;
      }
    }

    console.log(`\n========================================`);
    console.log(`Step ${stepNum + 1} - Deploy Garaga ZK Verifier`);
    console.log("========================================");
    zkVerifierAddress = await deployContract(account, provider, verifierClassHash, []);
  } else {
    console.log(`\n  Using existing ZK Verifier: ${zkVerifierAddress}`);
  }
  const poolConstructor = poolCallData.compile("constructor", {
    usdc_token: usdcAddress,
    wbtc_token: wbtcAddress,
    owner: accountAddress,
    avnu_router: routerAddress,
    zk_verifier: zkVerifierAddress,
  });

  const shieldedPoolAddress = await deployContract(
    account,
    provider,
    shieldedPoolClassHash,
    poolConstructor
  );

  // =====================================================================
  // Summary
  // =====================================================================

  console.log("\n");
  console.log("=".repeat(60));
  console.log(`  DEPLOYMENT COMPLETE (${isMainnet ? "MAINNET" : isLive ? "LIVE" : "DEV"})`);
  console.log("=".repeat(60));
  console.log();
  console.log("  Contract Addresses:");
  console.log(`    USDC            : ${usdcAddress}`);
  console.log(`    WBTC            : ${wbtcAddress}`);
  console.log(`    Router (Avnu)   : ${routerAddress}`);
  console.log(`    ZK Verifier     : ${zkVerifierAddress}`);
  console.log(`    ShieldedPool    : ${shieldedPoolAddress}`);
  console.log();
  console.log("  View on Voyager:");
  console.log(`    ${explorerBase}${shieldedPoolAddress}`);
  console.log();

  // Write deployment manifest
  const deployment: Record<string, any> = {
    network: isMainnet ? "mainnet" : "sepolia",
    mode: isMainnet ? "mainnet" : isLive ? "live" : "dev",
    chainId,
    deployer: accountAddress,
    contracts: {
      usdc: usdcAddress,
      wbtc: wbtcAddress,
      avnuRouter: routerAddress,
      shieldedPool: shieldedPoolAddress,
      garagaVerifier: zkVerifierAddress,
    },
    classHashes: {
      ShieldedPool: shieldedPoolClassHash,
      ...(isLive
        ? {}
        : {
            MockERC20: mockERC20ClassHash,
            MockAvnuRouter: mockAvnuRouterClassHash,
          }),
    },
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.resolve(__dirname, "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`  Deployment manifest written to: ${outPath}`);

  // Also update the frontend addresses
  const frontendAddresses = {
    network: isMainnet ? "mainnet" : "sepolia",
    contracts: {
      usdc: usdcAddress,
      wbtc: wbtcAddress,
      avnuRouter: routerAddress,
      shieldedPool: shieldedPoolAddress,
      garagaVerifier: zkVerifierAddress,
    },
    deployer: accountAddress,
    classHashes: deployment.classHashes,
  };

  const frontendPath = path.resolve(
    __dirname,
    "..",
    "frontend",
    "src",
    "contracts",
    "addresses.json"
  );
  fs.writeFileSync(frontendPath, JSON.stringify(frontendAddresses, null, 2));
  console.log(`  Frontend addresses written to: ${frontendPath}`);
  console.log();
}

main().catch((err) => {
  console.error("\nDeployment failed:\n", err);
  process.exit(1);
});
