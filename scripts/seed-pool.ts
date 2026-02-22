/**
 * Veil Protocol — Pool Seeding Script (Mainnet)
 *
 * Seeds the shielded pool with deposits across tiers to create a real
 * anonymity set for the hackathon demo. Uses the deployer wallet.
 *
 * Flow:
 *   1. Check USDC balance — if insufficient, swap STRK → USDC via AVNU
 *   2. Approve pool to spend USDC
 *   3. Create deposits across tiers (configurable)
 *   4. Verify on-chain pool state after seeding
 *   5. Save note secrets to seed-notes.json (for later withdrawal)
 *
 * Usage:
 *   npx tsx seed-pool.ts                    # dry-run: show what would happen
 *   npx tsx seed-pool.ts --execute          # actually send transactions
 *   npx tsx seed-pool.ts --execute --swap   # swap STRK→USDC first, then deposit
 *
 * Environment: reads from .env (same as other scripts)
 */

import {
  Account,
  RpcProvider,
  Contract,
  CallData,
  constants,
  type Abi,
} from "starknet";
import { poseidon2, poseidon3 } from "poseidon-lite";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const addresses = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../frontend/src/contracts/addresses.json"),
    "utf-8",
  ),
);

const POOL = addresses.contracts.shieldedPool;
const USDC_ADDR = addresses.contracts.usdc;
const STRK_ADDR =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const RPC_URL =
  process.env.STARKNET_RPC_URL ?? "https://rpc.starknet.lava.build";

const STARK_PRIME =
  3618502788666131213697322783095070105623107215331596699973092056135872020481n;
const BN254_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const TIERS = [
  { tier: 0, amount: 1_000_000n, label: "$1" },
  { tier: 1, amount: 10_000_000n, label: "$10" },
  { tier: 2, amount: 100_000_000n, label: "$100" },
  { tier: 3, amount: 1_000_000_000n, label: "$1,000" },
];

// Seeding plan — how many deposits per tier
// Adjust based on available USDC. Default: affordable demo set.
const SEED_PLAN = [
  { tier: 0, count: 5 }, // 5x $1  = $5
  { tier: 1, count: 3 }, // 3x $10 = $30
  { tier: 2, count: 1 }, // 1x $100 = $100
  // tier 3 ($1K) omitted — too expensive for hackathon demo
];

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const SWAP_FIRST = args.includes("--swap");

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------

const ERC20_ABI: Abi = [
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    name: "balance_of",
    type: "function",
    inputs: [
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      {
        name: "spender",
        type: "core::starknet::contract_address::ContractAddress",
      },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
];

const POOL_ABI: Abi = [
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    name: "deposit_private",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      { name: "denomination", type: "core::integer::u8" },
      { name: "btc_identity_hash", type: "core::felt252" },
      { name: "zk_commitment", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_pending_usdc",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "get_leaf_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_anonymity_set",
    type: "function",
    inputs: [{ name: "tier", type: "core::integer::u8" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "is_commitment_valid",
    type: "function",
    inputs: [{ name: "commitment", type: "core::felt252" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "get_batch_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_total_batches_executed",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
];

// ---------------------------------------------------------------------------
// Provider & Account
// ---------------------------------------------------------------------------

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
  undefined,
  constants.TRANSACTION_VERSION.V3,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomField(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let val = 0n;
  for (const b of bytes) val = (val << 8n) + BigInt(b);
  return val % BN254_PRIME;
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function ok(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

function warn(msg: string) {
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
}

function err(msg: string) {
  console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
}

// ---------------------------------------------------------------------------
// AVNU Swap (STRK → USDC)
// ---------------------------------------------------------------------------

const AVNU_API = "https://starknet.api.avnu.fi";

interface AvnuQuote {
  quoteId: string;
  sellAmount: string;
  buyAmount: string;
  routes: unknown[];
}

async function getAvnuQuote(
  sellAmount: bigint,
): Promise<AvnuQuote | null> {
  try {
    const params = new URLSearchParams({
      sellTokenAddress: STRK_ADDR,
      buyTokenAddress: USDC_ADDR,
      sellAmount: "0x" + sellAmount.toString(16),
      takerAddress: account.address,
      size: "1",
      integratorName: "VeilProtocol",
    });

    const res = await fetch(`${AVNU_API}/swap/v2/quotes?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      warn(`AVNU quote failed: ${res.status} — ${text.slice(0, 200)}`);
      return null;
    }

    const quotes = await res.json();
    if (!Array.isArray(quotes) || quotes.length === 0) {
      warn("No AVNU quotes returned");
      return null;
    }
    return quotes[0];
  } catch (e) {
    warn(`AVNU quote error: ${e}`);
    return null;
  }
}

async function executeAvnuSwap(quoteId: string): Promise<string | null> {
  try {
    const res = await fetch(`${AVNU_API}/swap/v2/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId,
        takerAddress: account.address,
        slippage: 0.05, // 5% slippage for small amounts
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      warn(`AVNU build failed: ${res.status} — ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const { contractAddress, entrypoint, calldata } = data;

    // Execute the swap
    const tx = await account.execute([
      { contractAddress, entrypoint, calldata },
    ]);
    await provider.waitForTransaction(tx.transaction_hash);
    return tx.transaction_hash;
  } catch (e) {
    warn(`AVNU swap error: ${e}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n========================================");
  console.log("  Veil Protocol — Pool Seeder");
  console.log("========================================\n");

  log(`Network:  ${addresses.network}`);
  log(`Pool:     ${POOL}`);
  log(`USDC:     ${USDC_ADDR}`);
  log(`Account:  ${account.address}`);
  log(`Mode:     ${EXECUTE ? "\x1b[31mLIVE\x1b[0m" : "\x1b[33mDRY RUN\x1b[0m"}`);
  log(`Swap:     ${SWAP_FIRST ? "yes" : "no"}`);

  const usdc = new Contract(ERC20_ABI, USDC_ADDR, provider);
  const strk = new Contract(ERC20_ABI, STRK_ADDR, provider);
  const pool = new Contract(POOL_ABI, POOL, provider);

  // ---- Step 0: Check balances ----
  console.log("\n--- Balances ---");

  const [usdcBal, strkBal] = await Promise.all([
    usdc.balance_of(account.address),
    strk.balance_of(account.address),
  ]);

  let usdcBalance = BigInt(usdcBal.toString());
  const strkBalance = BigInt(strkBal.toString());

  log(`STRK: ${(Number(strkBalance) / 1e18).toFixed(4)}`);
  log(`USDC: ${(Number(usdcBalance) / 1e6).toFixed(2)}`);

  // ---- Step 0.5: Current pool state ----
  console.log("\n--- Current Pool State ---");

  const [initLeaves, a0, a1, a2, a3, pending, batchCount] = await Promise.all([
    pool.get_leaf_count(),
    pool.get_anonymity_set(0),
    pool.get_anonymity_set(1),
    pool.get_anonymity_set(2),
    pool.get_anonymity_set(3),
    pool.get_pending_usdc(),
    pool.get_batch_count(),
  ]);

  const initAnonSets = [Number(a0), Number(a1), Number(a2), Number(a3)];
  log(`Leaf count:     ${Number(initLeaves)}`);
  log(`Pending USDC:   $${Number(BigInt(pending.toString())) / 1e6}`);
  log(`Batch queue:    ${Number(batchCount)}`);
  log(`Anon sets:      [$1: ${initAnonSets[0]}, $10: ${initAnonSets[1]}, $100: ${initAnonSets[2]}, $1K: ${initAnonSets[3]}]`);

  // ---- Step 1: Calculate needed USDC ----
  console.log("\n--- Seed Plan ---");

  const totalUsdcNeeded = SEED_PLAN.reduce((acc, { tier, count }) => {
    return acc + TIERS[tier].amount * BigInt(count);
  }, 0n);

  for (const { tier, count } of SEED_PLAN) {
    const t = TIERS[tier];
    log(`Tier ${tier} (${t.label}): ${count} deposits = $${Number(t.amount * BigInt(count)) / 1e6}`);
  }
  log(`Total USDC needed: $${Number(totalUsdcNeeded) / 1e6}`);
  log(`Current USDC:      $${Number(usdcBalance) / 1e6}`);

  const deficit = totalUsdcNeeded - usdcBalance;

  if (deficit > 0n) {
    warn(`Need $${(Number(deficit) / 1e6).toFixed(2)} more USDC`);

    if (SWAP_FIRST && EXECUTE) {
      console.log("\n--- STRK → USDC Swap via AVNU ---");

      // Add 20% buffer for slippage + gas
      const swapStrkAmount = (strkBalance * 80n) / 100n; // Use 80% of STRK (keep 20% for gas)

      if (swapStrkAmount <= 0n) {
        err("Not enough STRK to swap");
        process.exit(1);
      }

      log(`Swapping ${(Number(swapStrkAmount) / 1e18).toFixed(4)} STRK for USDC...`);

      const quote = await getAvnuQuote(swapStrkAmount);
      if (!quote) {
        err("Failed to get swap quote from AVNU");
        process.exit(1);
      }

      const expectedUsdc = Number(BigInt(quote.buyAmount)) / 1e6;
      log(`Quote: ~$${expectedUsdc.toFixed(2)} USDC`);

      const txHash = await executeAvnuSwap(quote.quoteId);
      if (!txHash) {
        err("Swap failed");
        process.exit(1);
      }

      ok(`Swapped! TX: ${txHash.slice(0, 20)}...`);

      // Refresh USDC balance
      const newBal = await usdc.balance_of(account.address);
      usdcBalance = BigInt(newBal.toString());
      log(`New USDC balance: $${(Number(usdcBalance) / 1e6).toFixed(2)}`);
    } else if (SWAP_FIRST) {
      warn("Dry run — would swap STRK → USDC via AVNU");
    } else {
      warn("Pass --swap to auto-swap STRK → USDC");
    }
  } else {
    ok(`Sufficient USDC balance`);
  }

  // ---- Recalculate plan based on actual USDC ----
  // If we still don't have enough, reduce the plan
  let actualPlan = [...SEED_PLAN];
  let totalActual = actualPlan.reduce(
    (acc, { tier, count }) => acc + TIERS[tier].amount * BigInt(count),
    0n,
  );

  if (totalActual > usdcBalance) {
    warn("Insufficient USDC — reducing plan to fit available balance");
    actualPlan = [];
    let remaining = usdcBalance;

    // Prioritize: multiple tier-0 deposits first, then tier-1, etc.
    for (const { tier, count } of SEED_PLAN) {
      const tierAmount = TIERS[tier].amount;
      const maxAffordable = Number(remaining / tierAmount);
      const actualCount = Math.min(count, maxAffordable);
      if (actualCount > 0) {
        actualPlan.push({ tier, count: actualCount });
        remaining -= tierAmount * BigInt(actualCount);
      }
    }

    totalActual = actualPlan.reduce(
      (acc, { tier, count }) => acc + TIERS[tier].amount * BigInt(count),
      0n,
    );

    console.log("\n--- Adjusted Plan ---");
    for (const { tier, count } of actualPlan) {
      const t = TIERS[tier];
      log(`Tier ${tier} (${t.label}): ${count} deposits`);
    }
    log(`Total: $${Number(totalActual) / 1e6}`);
  }

  const totalDeposits = actualPlan.reduce((acc, { count }) => acc + count, 0);
  if (totalDeposits === 0) {
    err("No deposits possible with current USDC balance.");
    err("Fund the deployer with USDC, or pass --swap to convert STRK → USDC");
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log("\n--- DRY RUN COMPLETE ---");
    log(`Would create ${totalDeposits} deposits using $${Number(totalActual) / 1e6} USDC`);
    log("Run with --execute to send real transactions");
    log("Run with --execute --swap to also swap STRK → USDC first");
    process.exit(0);
  }

  // ---- Step 2: Approve USDC ----
  console.log("\n--- Approve USDC ---");

  const approveTx = await account.execute([
    {
      contractAddress: USDC_ADDR,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: POOL,
        amount: { low: totalActual, high: 0n },
      }),
    },
  ]);
  await provider.waitForTransaction(approveTx.transaction_hash);
  ok(`Approved $${Number(totalActual) / 1e6} USDC for pool`);

  // ---- Step 3: Deposit ----
  console.log("\n--- Depositing ---");

  interface SeedNote {
    tier: number;
    label: string;
    secret: string;
    blinder: string;
    commitment: string;
    zkCommitment: string;
    nullifier: string;
    txHash: string;
    timestamp: number;
  }

  const notes: SeedNote[] = [];

  for (const { tier, count } of actualPlan) {
    const tierInfo = TIERS[tier];

    for (let i = 0; i < count; i++) {
      const secret = randomField();
      const blinder = randomField();

      const commitment = poseidon2([secret, blinder]) % STARK_PRIME;
      const zkCommitment =
        poseidon3([secret, blinder, BigInt(tier)]) % STARK_PRIME;
      const nullifier = poseidon2([secret, secret]) % STARK_PRIME;

      log(
        `Tier ${tier} (${tierInfo.label}) [${i + 1}/${count}] depositing...`,
      );

      const tx = await account.execute([
        {
          contractAddress: POOL,
          entrypoint: "deposit_private",
          calldata: CallData.compile({
            commitment: "0x" + commitment.toString(16),
            denomination: tier,
            btc_identity_hash: "0x0",
            zk_commitment: "0x" + zkCommitment.toString(16),
          }),
        },
      ]);
      await provider.waitForTransaction(tx.transaction_hash);

      notes.push({
        tier,
        label: tierInfo.label,
        secret: "0x" + secret.toString(16),
        blinder: "0x" + blinder.toString(16),
        commitment: "0x" + commitment.toString(16),
        zkCommitment: "0x" + zkCommitment.toString(16),
        nullifier: "0x" + nullifier.toString(16),
        txHash: tx.transaction_hash,
        timestamp: Date.now(),
      });

      ok(
        `Deposited ${tierInfo.label} — ${tx.transaction_hash.slice(0, 20)}...`,
      );

      // Small delay between deposits for nonce settlement
      if (i < count - 1 || tier < actualPlan[actualPlan.length - 1].tier) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  // ---- Step 4: Save notes ----
  console.log("\n--- Save Notes ---");

  const notesPath = path.resolve(__dirname, "seed-notes.json");

  // Append to existing notes if file exists
  let existingNotes: SeedNote[] = [];
  try {
    existingNotes = JSON.parse(fs.readFileSync(notesPath, "utf-8"));
  } catch {
    /* first run */
  }

  const allNotes = [...existingNotes, ...notes];
  fs.writeFileSync(notesPath, JSON.stringify(allNotes, null, 2));
  ok(`Saved ${notes.length} new notes (${allNotes.length} total) → seed-notes.json`);

  // ---- Step 5: Verify pool state ----
  console.log("\n--- Post-Seed Pool State ---");

  const [postLeaves, pa0, pa1, pa2, pa3, postPending] = await Promise.all([
    pool.get_leaf_count(),
    pool.get_anonymity_set(0),
    pool.get_anonymity_set(1),
    pool.get_anonymity_set(2),
    pool.get_anonymity_set(3),
    pool.get_pending_usdc(),
  ]);

  const postAnonSets = [Number(pa0), Number(pa1), Number(pa2), Number(pa3)];
  log(`Leaf count:   ${Number(postLeaves)} (was ${Number(initLeaves)})`);
  log(`Pending USDC: $${Number(BigInt(postPending.toString())) / 1e6}`);
  log(`Anon sets:    [$1: ${postAnonSets[0]}, $10: ${postAnonSets[1]}, $100: ${postAnonSets[2]}, $1K: ${postAnonSets[3]}]`);

  // Verify one commitment
  const testCommitment = notes[0].commitment;
  const exists = await pool.is_commitment_valid(testCommitment);
  if (exists) {
    ok("First commitment verified on-chain");
  } else {
    err("Commitment verification failed!");
  }

  // ---- Summary ----
  console.log("\n========================================");
  console.log(`  \x1b[32mSeeded ${notes.length} deposits\x1b[0m`);
  console.log("========================================");
  for (const { tier, count } of actualPlan) {
    log(`Tier ${tier} (${TIERS[tier].label}): +${count} deposits → anon set: ${postAnonSets[tier]}`);
  }
  log(`\nSecrets saved to: ${notesPath}`);
  log("IMPORTANT: Keep seed-notes.json safe — needed for withdrawals\n");
}

main().catch((e) => {
  console.error("\n[FATAL]", e.message ?? e);
  process.exit(1);
});
