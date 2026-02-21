/**
 * Veil Protocol Keeper — Automated Batch Executor
 *
 * This script monitors the ShieldedPool contract and executes batches
 * when sufficient USDC has accumulated. It fetches optimal swap routes
 * from the Avnu API and calls execute_batch with the route data.
 *
 * Usage:
 *   npx ts-node --esm keeper.ts                    # Run once
 *   npx ts-node --esm keeper.ts --loop              # Run continuously
 *   npx ts-node --esm keeper.ts --dry-run            # Check state without executing
 *
 * Environment:
 *   PRIVATE_KEY       - Keeper account private key (must be pool owner)
 *   ACCOUNT_ADDRESS   - Keeper account address
 *   STARKNET_RPC_URL  - (optional) RPC endpoint
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  Account,
  RpcProvider,
  Contract,
  constants,
  type Abi,
} from "starknet";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Config — reads from deployment.json or env vars
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentManifest {
  network?: string;
  contracts?: Record<string, string>;
}

function loadDeploymentManifest(): DeploymentManifest {
  try {
    const manifestPath = path.resolve(__dirname, "deployment.json");
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  } catch { /* fall through to defaults */ }
  return {};
}

const deploymentManifest = loadDeploymentManifest();
const deployedAddresses = deploymentManifest.contracts ?? {};
const deployedNetwork = deploymentManifest.network ?? "sepolia";

const POOL_ADDRESS =
  process.env.POOL_ADDRESS ??
  deployedAddresses.shieldedPool ??
  "0x05cfde7ac8b3db24e843f373585ee3b164945f5db19095803cbe77db92fda2b2";

const USDC_ADDRESS =
  process.env.USDC_ADDRESS ??
  deployedAddresses.usdc ??
  "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";

const WBTC_ADDRESS =
  process.env.WBTC_ADDRESS ??
  deployedAddresses.wbtc ??
  "0x00452bd5c0512a61df7c7be8cfea5e4f893cb40e126bdc40aee6054db955129e";

const ROUTER_ADDRESS =
  process.env.ROUTER_ADDRESS ??
  deployedAddresses.avnuRouter ??
  "0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647";

const AVNU_API_BASE =
  process.env.AVNU_API_BASE ??
  (deployedNetwork === "mainnet"
    ? "https://starknet.api.avnu.fi"
    : "https://sepolia.api.avnu.fi");

// Minimum pending USDC before triggering a batch (in 6-decimal token units)
// Mainnet: $1 minimum (real liquidity), Testnet: $10 minimum (mock tokens are free)
const DEFAULT_MIN_PENDING = deployedNetwork === "mainnet" ? "1000000" : "10000000";
const MIN_PENDING = BigInt(process.env.MIN_PENDING ?? DEFAULT_MIN_PENDING);

// Bot webhook for push notifications
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

// Loop interval in milliseconds (5 minutes)
const LOOP_INTERVAL_MS = 5 * 60 * 1000;

// Slippage tolerance: 1% for mainnet, 5% for testnet
const SLIPPAGE_BPS = deployedNetwork === "mainnet" ? 100 : 500;

// ---------------------------------------------------------------------------
// ABI (minimal — only the functions the keeper needs)
// ---------------------------------------------------------------------------

const POOL_ABI: Abi = [
  {
    type: "function",
    name: "get_pending_usdc",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_batch_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_current_batch_id",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "execute_batch",
    inputs: [
      { name: "min_wbtc_out", type: "core::integer::u256" },
      {
        name: "routes",
        type: "core::array::Array::<ghost_sats::avnu_interface::Route>",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
];

// ---------------------------------------------------------------------------
// Avnu API Types
// ---------------------------------------------------------------------------

interface AvnuQuote {
  quoteId: string;
  sellTokenAddress: string;
  sellAmount: string;
  buyTokenAddress: string;
  buyAmount: string;
  routes: AvnuRoute[];
}

interface AvnuRoute {
  name: string;
  address: string;
  percent: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
  routes: AvnuSubRoute[];
}

interface AvnuSubRoute {
  name: string;
  address: string;
  percent: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
  additionalSwapParams: string[];
}

interface AvnuBuildResult {
  calldata: string[];
}

// ---------------------------------------------------------------------------
// Avnu API Helpers
// ---------------------------------------------------------------------------

async function fetchAvnuQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: bigint,
  takerAddress: string
): Promise<AvnuQuote | null> {
  const params = new URLSearchParams({
    sellTokenAddress: sellToken,
    buyTokenAddress: buyToken,
    sellAmount: `0x${sellAmount.toString(16)}`,
    takerAddress,
    size: "1",
    integratorName: "VeilProtocol",
  });

  const url = `${AVNU_API_BASE}/swap/v2/quotes?${params}`;
  console.log(`  Fetching Avnu quote...`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Avnu API error: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(`  Body: ${body}`);
    return null;
  }

  const quotes: AvnuQuote[] = await res.json();
  if (!quotes || quotes.length === 0) {
    console.error("  No quotes available for this pair/amount");
    return null;
  }

  return quotes[0];
}

async function buildAvnuSwap(
  quoteId: string,
  takerAddress: string,
  slippageBps: number
): Promise<AvnuBuildResult | null> {
  const url = `${AVNU_API_BASE}/swap/v2/build`;
  console.log(`  Building swap transaction...`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      takerAddress,
      slippage: slippageBps / 10_000,
    }),
  });

  if (!res.ok) {
    console.error(`  Avnu build error: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(`  Body: ${body}`);
    return null;
  }

  return await res.json();
}

/**
 * Convert Avnu API route data into the on-chain Route struct format.
 * Each Route = { token_from, token_to, exchange_address, percent, additional_swap_params }
 */
function buildOnChainRoutes(quote: AvnuQuote): object[] {
  const routes: object[] = [];

  for (const route of quote.routes) {
    for (const sub of route.routes) {
      routes.push({
        token_from: sub.sellTokenAddress,
        token_to: sub.buyTokenAddress,
        exchange_address: sub.address,
        percent: Math.floor(sub.percent * 100),
        additional_swap_params: sub.additionalSwapParams ?? [],
      });
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Main Keeper Logic
// ---------------------------------------------------------------------------

async function runKeeper(dryRun: boolean): Promise<boolean> {
  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const defaultRpc = deployedNetwork === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com";
  const rpcUrl = process.env.STARKNET_RPC_URL ?? defaultRpc;

  if (!privateKey || !accountAddress) {
    console.error(
      "ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set.\n" +
        "Copy .env.example to .env and fill in the values."
    );
    process.exit(1);
  }

  // Connect (use "latest" block — some RPCs don't support "pending")
  const provider = new RpcProvider({ nodeUrl: rpcUrl, blockIdentifier: "latest" as any });
  // Use V1 (ETH gas) with --eth-gas flag, otherwise V3 (STRK gas)
  const useEthGas = process.argv.includes("--eth-gas");
  const txVersion = useEthGas
    ? constants.TRANSACTION_VERSION.V1
    : constants.TRANSACTION_VERSION.V3;
  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, txVersion,
  );
  const pool = new Contract(POOL_ABI, POOL_ADDRESS, provider);

  console.log("\n========================================");
  console.log("  Veil Protocol Keeper");
  console.log("========================================");
  console.log(`  Pool:    ${POOL_ADDRESS}`);
  console.log(`  Keeper:  ${accountAddress}`);
  console.log(`  Mode:    ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log();

  // Read pool state
  const pendingUsdc = await pool.get_pending_usdc();
  const batchCount = await pool.get_batch_count();
  const currentBatchId = await pool.get_current_batch_id();

  const pendingBigInt = BigInt(pendingUsdc.toString());

  console.log(`  Pending USDC:    ${pendingBigInt}`);
  console.log(`  Deposits:        ${batchCount}`);
  console.log(`  Current Batch:   ${currentBatchId}`);
  console.log();

  // Check threshold
  if (pendingBigInt < MIN_PENDING) {
    console.log(
      `  Below threshold (${MIN_PENDING}). Skipping batch execution.`
    );
    return false;
  }

  console.log(`  Threshold met! Preparing batch execution...`);

  if (dryRun) {
    console.log("  [DRY RUN] Would execute batch. Exiting.");
    return false;
  }

  // Try AVNU quote first (works on mainnet with real tokens)
  let quote: AvnuQuote | null = null;
  let minOut = 0n;
  let onChainRoutes: any[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    quote = await fetchAvnuQuote(
      USDC_ADDRESS,
      WBTC_ADDRESS,
      pendingBigInt,
      POOL_ADDRESS
    );
    if (quote) break;
    if (attempt < 3) {
      const delay = attempt * 5_000;
      console.log(`  Retry ${attempt}/3 in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (quote) {
    const buyAmount = BigInt(quote.buyAmount);
    minOut = (buyAmount * BigInt(10_000 - SLIPPAGE_BPS)) / BigInt(10_000);
    onChainRoutes = buildOnChainRoutes(quote);
    console.log(`  Expected WBTC:   ${buyAmount}`);
    console.log(`  Min WBTC out:    ${minOut} (${SLIPPAGE_BPS / 100}% slippage)`);
    console.log(`  Routes: ${onChainRoutes.length} hop(s)`);
  } else if (deployedNetwork !== "mainnet") {
    // Testnet mock router fallback — fetch live BTC price and set rate
    console.log(`  No AVNU quote — using mock router with live BTC price...`);
    try {
      const priceRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
      );
      const priceData = await priceRes.json();
      const btcPrice = Math.round(priceData.bitcoin.usd);
      console.log(`  Live BTC price: $${btcPrice}`);

      // Set mock router rate: numerator=100, denominator=btcPrice
      // USDC 6 decimals, WBTC 8 decimals → wbtc = usdc * 100 / btcPrice
      const { CallData } = await import("starknet");
      const setRateTx = await account.execute([{
        contractAddress: ROUTER_ADDRESS,
        entrypoint: "set_rate",
        calldata: CallData.compile({
          rate_numerator: { low: 100, high: 0 },
          rate_denominator: { low: btcPrice, high: 0 },
        }),
      }]);
      await provider.waitForTransaction(setRateTx.transaction_hash);
      console.log(`  Rate updated: 100/${btcPrice} (tx: ${setRateTx.transaction_hash})`);
    } catch (priceErr: any) {
      console.warn(`  Price fetch/rate update failed: ${priceErr?.message}. Using existing rate.`);
    }
    // Execute with empty routes (mock router handles swap internally)
    minOut = 0n;
    onChainRoutes = [];
  } else {
    console.error(`  No AVNU quote after 3 attempts — skipping this cycle.`);
    return false;
  }

  // Execute batch
  console.log();
  console.log(`  Calling execute_batch...`);

  try {
    pool.connect(account);
    const tx = await pool.execute_batch(
      { low: minOut, high: 0n },
      onChainRoutes
    );
    console.log(`  tx: ${tx.transaction_hash}`);
    console.log(`  Waiting for confirmation...`);
    await provider.waitForTransaction(tx.transaction_hash);

    console.log(`  Batch executed successfully!`);

    // Push batch event to bot webhook
    if (BOT_WEBHOOK_URL) {
      await fetch(`${BOT_WEBHOOK_URL}/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BOT_WEBHOOK_SECRET ? { Authorization: `Bearer ${BOT_WEBHOOK_SECRET}` } : {}),
        },
        body: JSON.stringify({
          type: "batch_executed",
          data: {
            batch_count: Number(batchCount) + 1,
            usdc_in: pendingBigInt.toString(),
            wbtc_out: minOut.toString(),
            tx_hash: tx.transaction_hash,
          },
        }),
      }).catch((err) => console.warn(`  [webhook] Failed to notify bot: ${err.message}`));
    }

    console.log();
    return true;
  } catch (err: any) {
    console.error(`  Batch execution failed:`);
    console.error(`  ${err?.message ?? err}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const loop = args.includes("--loop");

async function main() {
  if (loop) {
    console.log(`Starting keeper loop (interval: ${LOOP_INTERVAL_MS / 1000}s)`);
    while (true) {
      try {
        await runKeeper(dryRun);
      } catch (err) {
        console.error("Keeper error:", err);
      }
      console.log(
        `\nSleeping ${LOOP_INTERVAL_MS / 1000}s until next check...\n`
      );
      await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MS));
    }
  } else {
    await runKeeper(dryRun);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
