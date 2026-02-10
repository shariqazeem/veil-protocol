/**
 * Ghost Sats - Starknet Sepolia Deployment Script
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
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function artifactPath(filename: string): string {
  return path.resolve(__dirname, "..", "contracts", "target", "dev", filename);
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
    if (msg.includes("already declared") || msg.includes("class already declared")) {
      const { hash } = await import("starknet");
      const classHash = hash.computeContractClassHash(compiledSierra);
      console.log(`  Already declared. Class hash: ${classHash}`);
      return classHash;
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

  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const rpcUrl =
    process.env.STARKNET_RPC_URL ??
    "https://starknet-sepolia-rpc.publicnode.com";

  if (!privateKey || !accountAddress) {
    console.error(
      "ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set.\n" +
        "Copy .env.example to .env and fill in the values."
    );
    process.exit(1);
  }

  console.log(`\nConnecting to Starknet Sepolia at ${rpcUrl} ...`);
  console.log(`Mode: ${isLive ? "LIVE (real tokens + Avnu)" : "DEV (mock tokens + mock router)"}\n`);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey);
  const chainId = await provider.getChainId();
  console.log(`Chain ID: ${chainId}\n`);

  let usdcAddress: string;
  let wbtcAddress: string;
  let routerAddress: string;
  let mockERC20ClassHash = "";
  let mockAvnuRouterClassHash = "";

  if (isLive) {
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
      decimals: 0,
    });
    usdcAddress = await deployContract(account, provider, mockERC20ClassHash, usdcConstructor);

    console.log("\n========================================");
    console.log("Step 4 - Deploy MockERC20 as WBTC");
    console.log("========================================");
    const wbtcConstructor = erc20CallData.compile("constructor", {
      name: "Wrapped BTC",
      symbol: "WBTC",
      decimals: 0,
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
  // ZK verifier: zero address for now (proof verification skipped)
  // Deploy the Garaga verifier separately and update this address for full ZK
  const zkVerifierAddress = process.env.ZK_VERIFIER_ADDRESS ?? "0x0";
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
  console.log(`  DEPLOYMENT COMPLETE (${isLive ? "LIVE" : "DEV"})`);
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
  console.log(`    https://sepolia.voyager.online/contract/${shieldedPoolAddress}`);
  console.log();

  // Write deployment manifest
  const deployment: Record<string, any> = {
    network: "sepolia",
    mode: isLive ? "live" : "dev",
    chainId,
    deployer: accountAddress,
    contracts: {
      usdc: usdcAddress,
      wbtc: wbtcAddress,
      avnuRouter: routerAddress,
      shieldedPool: shieldedPoolAddress,
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
    network: "sepolia",
    contracts: {
      usdc: usdcAddress,
      wbtc: wbtcAddress,
      avnuRouter: routerAddress,
      shieldedPool: shieldedPoolAddress,
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
