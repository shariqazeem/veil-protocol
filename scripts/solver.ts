/**
 * Veil Protocol Solver — Bitcoin Intent Settlement Bot
 *
 * Watches for IntentCreated events on the ShieldedPool contract,
 * auto-claims intents as solver, and auto-confirms as oracle.
 *
 * In production, the solver would:
 *   1. Watch for IntentCreated events
 *   2. Send real BTC to the specified address
 *   3. Wait for Bitcoin network confirmation
 *   4. Submit confirm_btc_payment as oracle
 *
 * For the hackathon demo, steps 2-3 are simulated — the solver
 * auto-confirms immediately after claiming (1-of-1 oracle model).
 *
 * Usage:
 *   npx tsx solver.ts              # Run once
 *   npx tsx solver.ts --loop       # Run continuously
 *   npx tsx solver.ts --dry-run    # Check state without executing
 *
 * Environment:
 *   PRIVATE_KEY       - Solver/Oracle account private key (must be pool owner for oracle)
 *   ACCOUNT_ADDRESS   - Solver/Oracle account address
 *   STARKNET_RPC_URL  - (optional) RPC endpoint
 *   POOL_ADDRESS      - ShieldedPool contract address
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
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDeploymentManifest(): { network?: string; contracts?: Record<string, string> } {
  try {
    const manifestPath = path.resolve(__dirname, "deployment.json");
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  } catch { /* fall through */ }
  return {};
}

const deploymentManifest = loadDeploymentManifest();
const deployedNetwork = deploymentManifest.network ?? "sepolia";

function loadDeploymentAddresses(): Record<string, string> {
  return deploymentManifest.contracts ?? {}; // already loaded above
  return {};
}

const deployedAddresses = loadDeploymentAddresses();

const POOL_ADDRESS =
  process.env.POOL_ADDRESS ??
  deployedAddresses.shieldedPool ??
  "";

// Bot webhook for push notifications
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

// Loop interval (30 seconds — faster than keeper since intents are time-sensitive)
const LOOP_INTERVAL_MS = 30 * 1000;

// Delay between claim and confirm (simulates BTC send time)
const CONFIRM_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// ABI (minimal — only solver-relevant functions)
// ---------------------------------------------------------------------------

const POOL_ABI: Abi = [
  {
    type: "function",
    name: "get_intent_count",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_intent",
    inputs: [{ name: "intent_id", type: "core::integer::u64" }],
    outputs: [
      {
        type: "ghost_sats::IntentLock",
      },
    ],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "claim_intent",
    inputs: [{ name: "intent_id", type: "core::integer::u64" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "confirm_btc_payment",
    inputs: [{ name: "intent_id", type: "core::integer::u64" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "is_oracle",
    inputs: [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_oracle_threshold",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_intent_timeout",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
];

// IntentLock struct type for ABI
const INTENT_LOCK_TYPE = {
  type: "struct",
  name: "ghost_sats::IntentLock",
  members: [
    { name: "amount", type: "core::integer::u256" },
    { name: "btc_address_hash", type: "core::felt252" },
    { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
    { name: "solver", type: "core::starknet::contract_address::ContractAddress" },
    { name: "timestamp", type: "core::integer::u64" },
    { name: "status", type: "core::integer::u8" },
  ],
};

// Status constants
const STATUS = {
  CREATED: 0n,
  CLAIMED: 1n,
  SETTLED: 2n,
  EXPIRED: 3n,
} as const;

const STATUS_LABELS: Record<string, string> = {
  "0": "CREATED",
  "1": "CLAIMED",
  "2": "SETTLED",
  "3": "EXPIRED",
};

// ---------------------------------------------------------------------------
// Main Solver Logic
// ---------------------------------------------------------------------------

async function runSolver(dryRun: boolean): Promise<boolean> {
  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const defaultRpc = deployedNetwork === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com";
  const rpcUrl = process.env.STARKNET_RPC_URL ?? defaultRpc;

  if (!privateKey || !accountAddress) {
    console.error(
      "ERROR: PRIVATE_KEY and ACCOUNT_ADDRESS must be set.\n" +
        "The solver account must also be an oracle signer on the pool."
    );
    process.exit(1);
  }

  if (!POOL_ADDRESS) {
    console.error("ERROR: POOL_ADDRESS must be set.");
    process.exit(1);
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl, blockIdentifier: "latest" as any });
  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, constants.TRANSACTION_VERSION.V3,
  );
  const pool = new Contract([...POOL_ABI, INTENT_LOCK_TYPE], POOL_ADDRESS, provider);

  console.log("\n========================================");
  console.log("  Veil Protocol Solver");
  console.log("========================================");
  console.log(`  Pool:    ${POOL_ADDRESS}`);
  console.log(`  Solver:  ${accountAddress}`);
  console.log(`  Mode:    ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log();

  // Check oracle status
  const isOracle = await pool.is_oracle(accountAddress);
  const threshold = await pool.get_oracle_threshold();
  const timeout = await pool.get_intent_timeout();
  console.log(`  Oracle:  ${isOracle ? "YES" : "NO"}`);
  console.log(`  Threshold: ${threshold}`);
  console.log(`  Timeout: ${timeout}s`);
  console.log();

  if (!isOracle) {
    console.warn("  WARNING: This account is NOT an oracle signer.");
    console.warn("  It can claim intents but cannot confirm BTC payments.");
    console.warn("  The pool owner must call set_oracle_config to add this account.");
    console.log();
  }

  // Read all intents
  const intentCount = Number(await pool.get_intent_count());
  console.log(`  Total intents: ${intentCount}`);

  if (intentCount === 0) {
    console.log("  No intents to process.");
    return false;
  }

  let acted = false;

  for (let i = 0; i < intentCount; i++) {
    const intent = await pool.get_intent(i);
    const status = BigInt(intent.status.toString());
    const amount = BigInt(intent.amount.toString());
    const statusLabel = STATUS_LABELS[status.toString()] ?? "UNKNOWN";

    console.log(`\n  Intent #${i}: ${statusLabel} | ${amount} WBTC | recipient: ${intent.recipient}`);

    if (status === STATUS.CREATED) {
      // Unclaimed intent — claim it
      console.log(`  → Claiming intent #${i}...`);

      if (dryRun) {
        console.log("    [DRY RUN] Would claim.");
        continue;
      }

      try {
        pool.connect(account);
        const claimTx = await pool.claim_intent(i);
        console.log(`    tx: ${claimTx.transaction_hash}`);
        await provider.waitForTransaction(claimTx.transaction_hash);
        console.log("    Claimed!");

        // Push intent_claimed event to bot webhook
        if (BOT_WEBHOOK_URL) {
          await fetch(`${BOT_WEBHOOK_URL}/notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(BOT_WEBHOOK_SECRET ? { Authorization: `Bearer ${BOT_WEBHOOK_SECRET}` } : {}),
            },
            body: JSON.stringify({
              type: "intent_claimed",
              data: { intent_id: i, amount: amount.toString(), solver: accountAddress },
            }),
          }).catch((err) => console.warn(`    [webhook] Failed to notify bot: ${err.message}`));
        }

        // Simulate BTC send delay
        console.log(`    Simulating BTC send (${CONFIRM_DELAY_MS / 1000}s)...`);
        await new Promise((r) => setTimeout(r, CONFIRM_DELAY_MS));

        // Auto-confirm as oracle
        if (isOracle) {
          console.log(`  → Confirming BTC payment for intent #${i}...`);
          const confirmTx = await pool.confirm_btc_payment(i);
          console.log(`    tx: ${confirmTx.transaction_hash}`);
          await provider.waitForTransaction(confirmTx.transaction_hash);
          console.log("    Confirmed + WBTC released to solver!");

          // Push intent_settled event to bot webhook
          if (BOT_WEBHOOK_URL) {
            await fetch(`${BOT_WEBHOOK_URL}/notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(BOT_WEBHOOK_SECRET ? { Authorization: `Bearer ${BOT_WEBHOOK_SECRET}` } : {}),
              },
              body: JSON.stringify({
                type: "intent_settled",
                data: { intent_id: i, amount: amount.toString() },
              }),
            }).catch((err) => console.warn(`    [webhook] Failed to notify bot: ${err.message}`));
          }
        } else {
          console.log("    Cannot confirm — not an oracle. Waiting for oracle confirmation.");
        }

        acted = true;
      } catch (err: any) {
        console.error(`    Error: ${err?.message ?? err}`);
      }
    } else if (status === STATUS.CLAIMED) {
      // Claimed but not yet confirmed — check if we're the solver
      const solver = intent.solver?.toString?.() ?? "";
      const isOurClaim = solver.toLowerCase() === accountAddress.toLowerCase();

      if (isOurClaim && isOracle) {
        console.log(`  → Confirming BTC payment for our claim #${i}...`);

        if (dryRun) {
          console.log("    [DRY RUN] Would confirm.");
          continue;
        }

        try {
          pool.connect(account);
          const confirmTx = await pool.confirm_btc_payment(i);
          console.log(`    tx: ${confirmTx.transaction_hash}`);
          await provider.waitForTransaction(confirmTx.transaction_hash);
          console.log("    Confirmed + WBTC released!");

          // Push intent_settled event to bot webhook
          if (BOT_WEBHOOK_URL) {
            await fetch(`${BOT_WEBHOOK_URL}/notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(BOT_WEBHOOK_SECRET ? { Authorization: `Bearer ${BOT_WEBHOOK_SECRET}` } : {}),
              },
              body: JSON.stringify({
                type: "intent_settled",
                data: { intent_id: i, amount: amount.toString() },
              }),
            }).catch((err) => console.warn(`    [webhook] Failed to notify bot: ${err.message}`));
          }

          acted = true;
        } catch (err: any) {
          console.error(`    Error: ${err?.message ?? err}`);
        }
      } else {
        console.log(`    Solver: ${solver} (${isOurClaim ? "ours" : "not ours"})`);
      }
    } else {
      // SETTLED or EXPIRED — nothing to do
      console.log(`    (no action needed)`);
    }
  }

  return acted;
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const loop = args.includes("--loop");

async function main() {
  if (loop) {
    console.log(`Starting solver loop (interval: ${LOOP_INTERVAL_MS / 1000}s)`);
    while (true) {
      try {
        await runSolver(dryRun);
      } catch (err) {
        console.error("Solver error:", err);
      }
      console.log(
        `\nSleeping ${LOOP_INTERVAL_MS / 1000}s until next check...\n`
      );
      await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MS));
    }
  } else {
    await runSolver(dryRun);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
