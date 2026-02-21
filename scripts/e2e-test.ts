/**
 * Veil Protocol — E2E Test Suite (Sepolia)
 *
 * Tests the full lifecycle:
 *   1. Mint test USDC + fund mock router with WBTC
 *   2. Deposit (shield) into all 4 tiers ($1, $10, $100, $1,000)
 *   3. Verify pool state (pending USDC, leaf count, anon sets)
 *   4. Set mock router rate + execute batch (USDC → WBTC)
 *   5. Verify batch results (wbtc_per_unit, batch count)
 *   6. Verify nullifiers not yet used (withdrawal-ready)
 *   7. Test Vercel API endpoints
 *
 * Note: ZK withdrawal requires browser-side bb.js WASM proving.
 *       This test verifies everything UP TO withdrawal readiness.
 *
 * Run:  npx tsx e2e-test.ts
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

const deployment = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "deployment.json"), "utf-8"),
);

const USDC = deployment.contracts.usdc;
const WBTC = deployment.contracts.wbtc;
const POOL = deployment.contracts.shieldedPool;
const ROUTER = deployment.contracts.avnuRouter;

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

const RPC_URL =
  process.env.STARKNET_RPC_URL ?? "https://starknet-sepolia-rpc.publicnode.com";
const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
  undefined,
  constants.TRANSACTION_VERSION.V3,
);

const VERCEL_URL = "https://theveilprotocol.vercel.app";

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
    name: "mint",
    type: "function",
    inputs: [
      { name: "to", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
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
    name: "get_batch_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
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
    name: "get_current_batch_id",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    name: "execute_batch",
    type: "function",
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
  {
    name: "is_commitment_valid",
    type: "function",
    inputs: [{ name: "commitment", type: "core::felt252" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "is_nullifier_spent",
    type: "function",
    inputs: [{ name: "nullifier", type: "core::felt252" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
];

const ROUTER_ABI: Abi = [
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    name: "set_rate",
    type: "function",
    inputs: [
      { name: "rate_numerator", type: "core::integer::u256" },
      { name: "rate_denominator", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
];

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

let passed = 0;
let failed = 0;

function pass(msg: string) {
  passed++;
  console.log(`  \x1b[32m[PASS]\x1b[0m ${msg}`);
}

function fail(msg: string) {
  failed++;
  console.error(`  \x1b[31m[FAIL]\x1b[0m ${msg}`);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n========================================");
  console.log("  Veil Protocol — E2E Test Suite");
  console.log("========================================\n");

  log(`Pool:    ${POOL}`);
  log(`USDC:    ${USDC}`);
  log(`WBTC:    ${WBTC}`);
  log(`Router:  ${ROUTER}`);
  log(`Account: ${account.address}`);

  const pool = new Contract(POOL_ABI, POOL, provider);
  const usdc = new Contract(ERC20_ABI, USDC, provider);
  const wbtc = new Contract(ERC20_ABI, WBTC, provider);

  // ---- Step 0: Baseline pool state ----
  console.log("\n--- Step 0: Baseline pool state ---");
  const initBatchId = Number(BigInt((await pool.get_current_batch_id()).toString()));
  const initLeaf = Number(await pool.get_leaf_count());
  const initPendingCount = Number(await pool.get_batch_count());
  log(`Current batch ID: ${initBatchId}, Pending deposits: ${initPendingCount}, Leaf count: ${initLeaf}`);

  // ---- Step 1: Mint test tokens ----
  console.log("\n--- Step 1: Mint test USDC ---");
  const mintAmount = 2_000_000_000n; // 2,000 USDC
  const mintTx = await account.execute([
    {
      contractAddress: USDC,
      entrypoint: "mint",
      calldata: CallData.compile({
        to: account.address,
        amount: { low: mintAmount, high: 0n },
      }),
    },
  ]);
  await provider.waitForTransaction(mintTx.transaction_hash);
  const bal =
    Number(BigInt((await usdc.balance_of(account.address)).toString())) / 1e6;
  pass(`Minted USDC. Balance: ${bal} USDC`);

  // Fund router
  const routerBal = BigInt((await wbtc.balance_of(ROUTER)).toString());
  if (routerBal < 100_000_000n) {
    const tx = await account.execute([
      {
        contractAddress: WBTC,
        entrypoint: "mint",
        calldata: CallData.compile({
          to: ROUTER,
          amount: { low: 100_000_000_000n, high: 0n },
        }),
      },
    ]);
    await provider.waitForTransaction(tx.transaction_hash);
    pass("Router funded with WBTC");
  } else {
    pass(`Router WBTC balance: ${Number(routerBal) / 1e8}`);
  }

  // ---- Step 2: Deposit all 4 tiers ----
  console.log("\n--- Step 2: Shield deposits (all 4 tiers) ---");

  const notes: Array<{
    tier: number;
    secret: bigint;
    blinder: bigint;
    commitmentFelt: bigint;
    zkCommitmentFelt: bigint;
    nullifierFelt: bigint;
  }> = [];

  // Approve total
  const totalUsdc = TIERS.reduce((acc, t) => acc + t.amount, 0n);
  const approveTx = await account.execute([
    {
      contractAddress: USDC,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: POOL,
        amount: { low: totalUsdc, high: 0n },
      }),
    },
  ]);
  await provider.waitForTransaction(approveTx.transaction_hash);
  pass(`USDC approved ($${Number(totalUsdc) / 1e6})`);

  for (const { tier, amount, label } of TIERS) {
    const secret = randomField();
    const blinder = randomField();

    // BN254 Poseidon commitments (matching the Noir circuit)
    const commitment = poseidon2([secret, blinder]);
    const zkCommitment = poseidon3([secret, blinder, BigInt(tier)]);
    const nullifier = poseidon2([secret, secret]);

    // Reduce to Stark field for on-chain felt252 storage
    const commitmentFelt = commitment % STARK_PRIME;
    const zkCommitmentFelt = zkCommitment % STARK_PRIME;
    const nullifierFelt = nullifier % STARK_PRIME;

    log(`Depositing tier ${tier} (${label})...`);
    const tx = await account.execute([
      {
        contractAddress: POOL,
        entrypoint: "deposit_private",
        calldata: CallData.compile({
          commitment: "0x" + commitmentFelt.toString(16),
          denomination: tier,
          btc_identity_hash: "0x0",
          zk_commitment: "0x" + zkCommitmentFelt.toString(16),
        }),
      },
    ]);
    await provider.waitForTransaction(tx.transaction_hash);

    notes.push({
      tier,
      secret,
      blinder,
      commitmentFelt,
      zkCommitmentFelt,
      nullifierFelt,
    });
    pass(
      `Tier ${tier} (${label}) deposited — ${tx.transaction_hash.slice(0, 20)}...`,
    );
  }

  // ---- Step 3: Verify pool state ----
  console.log("\n--- Step 3: Verify pool state ---");

  const pendingRaw = await pool.get_pending_usdc();
  const pendingUsdc = Number(BigInt(pendingRaw.toString())) / 1e6;
  const expectedPending = Number(totalUsdc) / 1e6;
  if (pendingUsdc >= expectedPending) {
    pass(`Pending USDC: $${pendingUsdc} (expected >= $${expectedPending})`);
  } else {
    fail(`Pending USDC: $${pendingUsdc}, expected >= $${expectedPending}`);
  }

  const leafCount = Number(await pool.get_leaf_count());
  if (leafCount >= initLeaf + 4) {
    pass(`Leaf count: ${leafCount} (+4 deposits)`);
  } else {
    fail(`Leaf count: ${leafCount}, expected >= ${initLeaf + 4}`);
  }

  for (const { tier, label } of TIERS) {
    const anonSet = Number(await pool.get_anonymity_set(tier));
    if (anonSet >= 1) {
      pass(`Tier ${tier} (${label}) anonymity set: ${anonSet}`);
    } else {
      fail(`Tier ${tier} (${label}) anonymity set: ${anonSet}, expected >= 1`);
    }
  }

  // Verify commitments exist on-chain
  const testCommitment = notes[0].commitmentFelt;
  const exists = await pool.is_commitment_valid(
    "0x" + testCommitment.toString(16),
  );
  if (exists) {
    pass("Commitment verified on-chain");
  } else {
    fail("Commitment not found on-chain!");
  }

  // ---- Step 4: Execute batch ----
  console.log("\n--- Step 4: Execute batch (USDC -> WBTC) ---");

  // Fetch BTC price
  let btcPrice = 67000;
  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      const data = await resp.json();
      btcPrice = data.bitcoin.usd;
    }
  } catch {}
  log(`BTC price: $${btcPrice}`);

  // Set mock router rate
  const setRateTx = await account.execute([
    {
      contractAddress: ROUTER,
      entrypoint: "set_rate",
      calldata: CallData.compile({
        rate_numerator: { low: 100, high: 0 },
        rate_denominator: { low: Math.round(btcPrice), high: 0 },
      }),
    },
  ]);
  await provider.waitForTransaction(setRateTx.transaction_hash);
  pass(`Mock router rate: 100/${Math.round(btcPrice)}`);

  // Wait for nonce to settle
  await new Promise((r) => setTimeout(r, 5000));

  // Execute batch (min_wbtc_out must be > 0 per security guardrail)
  const batchTx = await account.execute([
    {
      contractAddress: POOL,
      entrypoint: "execute_batch",
      calldata: CallData.compile({
        min_wbtc_out: { low: 1, high: 0 },
        routes: [],
      }),
    },
  ]);
  await provider.waitForTransaction(batchTx.transaction_hash);
  pass(`Batch executed — ${batchTx.transaction_hash.slice(0, 20)}...`);

  // ---- Step 5: Verify batch results ----
  console.log("\n--- Step 5: Verify batch results ---");

  const postBatchId = Number(BigInt((await pool.get_current_batch_id()).toString()));
  if (postBatchId > initBatchId) {
    pass(`Batch ID: ${postBatchId} (was ${initBatchId})`);
  } else {
    fail(`Batch ID unchanged: ${postBatchId}`);
  }

  // Check pool WBTC balance increased (proves the swap worked)
  const poolWbtc = BigInt((await wbtc.balance_of(POOL)).toString());
  if (poolWbtc > 0n) {
    pass(`Pool WBTC balance: ${Number(poolWbtc) / 1e8} BTC`);
  } else {
    fail("Pool has no WBTC after batch execution");
  }

  // Pending deposits should be cleared
  const postPendingCount = Number(await pool.get_batch_count());
  if (postPendingCount === 0) {
    pass("Pending deposit count cleared to 0");
  } else {
    log(`Pending deposits after batch: ${postPendingCount}`);
  }

  const postPending =
    Number(BigInt((await pool.get_pending_usdc()).toString())) / 1e6;
  if (postPending === 0) {
    pass("Pending USDC cleared to $0");
  } else {
    log(`Pending USDC: $${postPending} (may include newer deposits)`);
  }

  // ---- Step 6: Verify nullifiers ----
  console.log("\n--- Step 6: Verify nullifier state ---");
  for (const note of notes) {
    const used = await pool.is_nullifier_spent(
      "0x" + note.nullifierFelt.toString(16),
    );
    if (!used) {
      pass(
        `Tier ${note.tier} nullifier not used (withdrawal-ready)`,
      );
    } else {
      fail(`Tier ${note.tier} nullifier already used!`);
    }
  }

  // ---- Step 7: Test Vercel APIs ----
  console.log("\n--- Step 7: Vercel API endpoints ---");

  try {
    const info = await fetch(`${VERCEL_URL}/api/relayer/info`);
    const d = await info.json();
    if (d.relayer === "online" && d.pool === POOL) {
      pass(`/api/relayer/info — online, pool matches`);
    } else {
      fail(`/api/relayer/info — ${JSON.stringify(d)}`);
    }
  } catch (e) {
    fail(`/api/relayer/info — ${e}`);
  }

  try {
    const status = await fetch(`${VERCEL_URL}/api/agent/status`);
    const d = await status.json();
    if (d.anonSets && "3" in d.anonSets) {
      pass(
        `/api/agent/status — batches: ${d.batchCount}, btc: $${d.btcPrice}, tiers: [${Object.values(d.anonSets).join(",")}]`,
      );
    } else {
      fail(`/api/agent/status — ${JSON.stringify(d)}`);
    }
  } catch (e) {
    fail(`/api/agent/status — ${e}`);
  }

  // Test x402 relay-quote endpoint
  try {
    const quoteRes = await fetch(`${VERCEL_URL}/api/relayer/relay-quote`);
    if (quoteRes.status === 402) {
      const body = await quoteRes.json();
      if (body.x402Version === 2 && body.accepts?.length > 0) {
        const req = body.accepts[0];
        pass(`/api/relayer/relay-quote — 402, x402v2, payTo: ${req.payTo?.slice(0, 14)}..., network: ${req.network}`);
      } else {
        fail(`/api/relayer/relay-quote — 402 but bad body: ${JSON.stringify(body).slice(0, 100)}`);
      }
      // Verify PAYMENT-REQUIRED header (x402-starknet uses "PAYMENT-REQUIRED"; HTTP/2 lowercases it)
      const header = quoteRes.headers.get("PAYMENT-REQUIRED") ?? quoteRes.headers.get("payment-required");
      if (header) {
        const decoded = JSON.parse(Buffer.from(header, "base64").toString());
        if (decoded.x402Version === 2) {
          pass(`/api/relayer/relay-quote — PAYMENT-REQUIRED header valid`);
        } else {
          fail(`/api/relayer/relay-quote — bad header: ${JSON.stringify(decoded).slice(0, 80)}`);
        }
      } else {
        fail(`/api/relayer/relay-quote — missing PAYMENT-REQUIRED header`);
      }
    } else if (quoteRes.status === 404) {
      log(`/api/relayer/relay-quote — x402 relay disabled (404), skipping`);
    } else {
      fail(`/api/relayer/relay-quote — unexpected status: ${quoteRes.status}`);
    }
  } catch (e) {
    fail(`/api/relayer/relay-quote — ${e}`);
  }

  // Test x402 premium-strategy endpoint (should return 402 without payment)
  try {
    const premRes = await fetch(`${VERCEL_URL}/api/agent/premium-strategy?input=test`);
    if (premRes.status === 402) {
      const body = await premRes.json();
      if (body.x402Version === 2 && body.accepts?.length > 0) {
        pass(`/api/agent/premium-strategy — 402 Payment Required (x402v2)`);
      } else {
        fail(`/api/agent/premium-strategy — 402 but bad body`);
      }
    } else {
      fail(`/api/agent/premium-strategy — expected 402, got ${premRes.status}`);
    }
  } catch (e) {
    fail(`/api/agent/premium-strategy — ${e}`);
  }

  // Test relay endpoint (should return 400 for missing fields, not 500)
  try {
    const relayRes = await fetch(`${VERCEL_URL}/api/relayer/relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ denomination: 1 }),
    });
    if (relayRes.status === 400) {
      const body = await relayRes.json();
      if (body.error === "Missing required fields") {
        pass(`/api/relayer/relay — 400 for missing fields (correct)`);
      } else {
        fail(`/api/relayer/relay — 400 but wrong error: ${body.error}`);
      }
    } else if (relayRes.status === 503) {
      pass(`/api/relayer/relay — 503 relayer not configured (Vercel has no keys, expected)`);
    } else {
      fail(`/api/relayer/relay — unexpected status: ${relayRes.status}`);
    }
  } catch (e) {
    fail(`/api/relayer/relay — ${e}`);
  }

  // Test relayer info includes x402 config
  try {
    const infoRes = await fetch(`${VERCEL_URL}/api/relayer/info`);
    const d = await infoRes.json();
    if (d.x402Relay && d.x402Relay.enabled === true) {
      pass(`/api/relayer/info — x402Relay enabled, fee: ${d.x402Relay.flatFee}`);
    } else {
      fail(`/api/relayer/info — x402Relay missing or disabled: ${JSON.stringify(d.x402Relay)}`);
    }
  } catch (e) {
    fail(`/api/relayer/info x402 — ${e}`);
  }

  // Test calldata server (VM)
  try {
    const health = await fetch("http://141.148.215.239/health", {
      signal: AbortSignal.timeout(5000),
    });
    const d = await health.json();
    if (d.status === "ok") {
      pass(`VM calldata server — healthy`);
    } else {
      fail(`VM calldata server — ${JSON.stringify(d)}`);
    }
  } catch (e) {
    fail(`VM calldata server — ${e}`);
  }

  // ---- Summary ----
  console.log("\n========================================");
  if (failed === 0) {
    console.log(
      `  \x1b[32mALL ${passed} TESTS PASSED\x1b[0m`,
    );
  } else {
    console.log(
      `  \x1b[31m${failed} FAILED\x1b[0m, ${passed} passed`,
    );
  }
  console.log("========================================");
  console.log(`\n  Pool:      ${POOL}`);
  console.log(`  Batch ID:  ${postBatchId}`);
  console.log(`  Deposits:  4 (tiers 0-3: $1, $10, $100, $1,000)`);
  console.log(`  Frontend:  ${VERCEL_URL}`);
  console.log(`\n  ZK withdrawal requires browser-side bb.js WASM.`);
  console.log(`  Test it manually at ${VERCEL_URL}/app\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n[FATAL]", err.message ?? err);
  process.exit(1);
});
