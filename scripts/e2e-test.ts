/**
 * Veil Protocol E2E Test — Full Shield → Batch → Unveil flow
 *
 * Tests the complete lifecycle on Sepolia testnet:
 *   1. Mint test USDC
 *   2. Approve + deposit_private (shield)
 *   3. Execute batch (swap USDC→WBTC)
 *   4. Wait for privacy cooldown (60s)
 *   5. Generate ZK proof via /prove
 *   6. Withdraw via /relay (gasless) or direct withdraw_private
 *
 * Usage:
 *   npx ts-node --esm e2e-test.ts
 *
 * Requires:
 *   - .env with PRIVATE_KEY and ACCOUNT_ADDRESS
 *   - Relayer running on localhost:3001 (npm run relayer)
 */

import {
  Account,
  RpcProvider,
  Contract,
  CallData,
  constants,
  num,
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

const RELAYER_URL = "http://localhost:3001";
const STARK_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

function loadAddresses(): Record<string, string> {
  try {
    const p = path.resolve(__dirname, "..", "frontend", "src", "contracts", "addresses.json");
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data.contracts;
  } catch {
    const p = path.resolve(__dirname, "deployment.json");
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    return data.contracts;
  }
}

const addresses = loadAddresses();
const POOL = addresses.shieldedPool;
const USDC = addresses.usdc;
const WBTC = addresses.wbtc;
const ROUTER = addresses.avnuRouter;

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
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    name: "balance_of",
    type: "function",
    inputs: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
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
    name: "execute_batch",
    type: "function",
    inputs: [
      { name: "min_wbtc_out", type: "core::integer::u256" },
      { name: "routes", type: "core::array::Array::<ghost_sats::avnu_interface::Route>" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "withdraw_private",
    type: "function",
    inputs: [
      { name: "denomination", type: "core::integer::u8" },
      { name: "zk_nullifier", type: "core::felt252" },
      { name: "zk_commitment", type: "core::felt252" },
      { name: "proof", type: "core::array::Array::<core::felt252>" },
      { name: "merkle_path", type: "core::array::Array::<core::felt252>" },
      { name: "path_indices", type: "core::array::Array::<core::integer::u8>" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "btc_recipient_hash", type: "core::felt252" },
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
    name: "get_leaf",
    type: "function",
    inputs: [
      { name: "index", type: "core::integer::u32" },
    ],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    name: "get_batch_result",
    type: "function",
    inputs: [
      { name: "batch_id", type: "core::integer::u64" },
    ],
    outputs: [{ type: "ghost_sats::BatchResult" }],
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
    name: "is_commitment_valid",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "is_zk_nullifier_spent",
    type: "function",
    inputs: [
      { name: "zk_nullifier", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
];

// ---------------------------------------------------------------------------
// Pedersen commitment (matches Cairo contract)
// ---------------------------------------------------------------------------

import { hash } from "starknet";

function pedersenChain(a: string, b: string): string {
  const step1 = hash.computePedersenHash("0x0", a);
  return hash.computePedersenHash(step1, b);
}

function splitU256(amount: bigint): { low: string; high: string } {
  const mask = (1n << 128n) - 1n;
  return {
    low: num.toHex(amount & mask),
    high: num.toHex(amount >> 128n),
  };
}

function computeCommitment(amount: bigint, secret: string, blinder: string): string {
  const { low, high } = splitU256(amount);
  const amountHash = pedersenChain(low, high);
  const secretHash = pedersenChain(secret, blinder);
  return pedersenChain(amountHash, secretHash);
}

function randomFelt(): string {
  const bytes = new Uint8Array(31);
  globalThis.crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16);
}

// ---------------------------------------------------------------------------
// Merkle proof (mirrors frontend/utils/privacy.ts)
// ---------------------------------------------------------------------------

function hashPair(left: string, right: string): string {
  const step1 = hash.computePedersenHash("0x0", left);
  return hash.computePedersenHash(step1, right);
}

function getZeroHash(level: number): string {
  let current = "0x0";
  for (let i = 0; i < level; i++) {
    current = hashPair(current, current);
  }
  return current;
}

function buildMerkleProof(
  leafIndex: number,
  allLeaves: string[],
): { path: string[]; indices: number[] } {
  const TREE_DEPTH = 20;
  const path: string[] = [];
  const indices: number[] = [];
  let currentLevel = [...allLeaves];
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    let sibling: string;
    if (siblingIndex < currentLevel.length) {
      sibling = currentLevel[siblingIndex];
    } else {
      sibling = getZeroHash(level);
    }
    path.push(sibling);
    indices.push(currentIndex % 2 === 0 ? 0 : 1);

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : getZeroHash(level);
      nextLevel.push(hashPair(left, right));
    }
    if (nextLevel.length === 0) {
      nextLevel.push(hashPair(getZeroHash(level), getZeroHash(level)));
    }
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  return { path, indices };
}

// ---------------------------------------------------------------------------
// Main E2E Test
// ---------------------------------------------------------------------------

const DENOMINATIONS: Record<number, bigint> = {
  0: 100_000_000n,       // 100 USDC
  1: 1_000_000_000n,     // 1,000 USDC
  2: 10_000_000_000n,    // 10,000 USDC
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function info(msg: string) { console.log(`  → ${msg}`); }
function fail(msg: string) { console.error(`  ✗ ${msg}`); }

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const rpcUrl = process.env.STARKNET_RPC_URL ?? "https://rpc.starknet-testnet.lava.build";

  if (!privateKey || !accountAddress) {
    console.error("Set PRIVATE_KEY and ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }

  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║     Veil Protocol E2E Test (Sepolia)       ║");
  console.log("╚════════════════════════════════════════════╝\n");

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, constants.TRANSACTION_VERSION.V3,
  );

  const usdc = new Contract(ERC20_ABI, USDC, provider);
  const wbtc = new Contract(ERC20_ABI, WBTC, provider);
  const pool = new Contract(POOL_ABI, POOL, provider);

  console.log(`Pool:    ${POOL}`);
  console.log(`USDC:    ${USDC}`);
  console.log(`WBTC:    ${WBTC}`);
  console.log(`Account: ${accountAddress}\n`);

  // Use denomination 0 (100 USDC) for cheapest test
  const denomination = 0;
  const rawAmount = DENOMINATIONS[denomination];
  info(`Testing denomination ${denomination} (${Number(rawAmount) / 1e6} USDC)\n`);

  // ───────────────────────────────────────
  // Step 1: Mint USDC
  // ───────────────────────────────────────
  console.log("Step 1: Mint test USDC");
  const usdcBal = await usdc.balance_of(accountAddress);
  info(`Current USDC balance: ${Number(usdcBal) / 1e6}`);

  if (BigInt(usdcBal.toString()) < rawAmount) {
    info("Minting USDC...");
    const mintTx = await account.execute([{
      contractAddress: USDC,
      entrypoint: "mint",
      calldata: CallData.compile({
        to: accountAddress,
        amount: { low: 100_000_000_000n, high: 0n },
      }),
    }]);
    await provider.waitForTransaction(mintTx.transaction_hash);
    ok("Minted 100K USDC");
  } else {
    ok("Sufficient USDC balance");
  }

  // Also ensure MockAvnuRouter has WBTC to give out
  const routerWbtc = await wbtc.balance_of(ROUTER);
  if (BigInt(routerWbtc.toString()) < 1_000_000n) {
    info("Minting WBTC to MockAvnuRouter...");
    const mintWbtcTx = await account.execute([{
      contractAddress: WBTC,
      entrypoint: "mint",
      calldata: CallData.compile({
        to: ROUTER,
        amount: { low: 100_000_000_000n, high: 0n },
      }),
    }]);
    await provider.waitForTransaction(mintWbtcTx.transaction_hash);
    ok("Minted WBTC to router");
  }

  // ───────────────────────────────────────
  // Step 2: Generate note + deposit_private
  // ───────────────────────────────────────
  console.log("\nStep 2: Shield (deposit_private)");
  const secret = randomFelt();
  const blinder = randomFelt();
  const commitment = computeCommitment(rawAmount, secret, blinder);
  info(`Secret:     ${secret.slice(0, 14)}...`);
  info(`Blinder:    ${blinder.slice(0, 14)}...`);
  info(`Commitment: ${commitment.slice(0, 14)}...`);

  // Compute ZK commitment (BN254 Poseidon)
  const secretBigint = BigInt(secret);
  const blinderBigint = BigInt(blinder);
  const zkCommitmentRaw = poseidon3([secretBigint, blinderBigint, BigInt(denomination)]);
  const zkNullifierRaw = poseidon2([secretBigint, 1n]);
  const zkCommitment = bigintToHex(zkCommitmentRaw % STARK_PRIME);
  const zkNullifier = bigintToHex(zkNullifierRaw % STARK_PRIME);
  info(`ZK Commit:  ${zkCommitment.slice(0, 14)}...`);
  info(`ZK Nullif:  ${zkNullifier.slice(0, 14)}...`);

  const leafCountBefore = Number(await pool.get_leaf_count());
  info(`Leaf count before: ${leafCountBefore}`);

  info("Approving USDC + depositing...");
  const shieldTx = await account.execute([
    {
      contractAddress: USDC,
      entrypoint: "approve",
      calldata: CallData.compile({
        spender: POOL,
        amount: { low: rawAmount, high: 0n },
      }),
    },
    {
      contractAddress: POOL,
      entrypoint: "deposit_private",
      calldata: CallData.compile({
        commitment,
        denomination,
        btc_identity_hash: "0x0",
        zk_commitment: zkCommitment,
      }),
    },
  ]);
  await provider.waitForTransaction(shieldTx.transaction_hash);
  ok(`Shield tx: ${shieldTx.transaction_hash}`);

  // Verify commitment is on-chain
  const isValid = await pool.is_commitment_valid(commitment);
  if (!isValid) {
    fail("Commitment not found on-chain!");
    process.exit(1);
  }
  ok("Commitment verified on-chain");

  const leafCountAfter = Number(await pool.get_leaf_count());
  const leafIndex = leafCountAfter - 1;
  ok(`Leaf index: ${leafIndex}`);

  // ───────────────────────────────────────
  // Step 3: Execute batch
  // ───────────────────────────────────────
  console.log("\nStep 3: Execute batch (USDC → WBTC swap)");
  const pendingBefore = Number(await pool.get_pending_usdc());
  info(`Pending USDC: ${pendingBefore / 1e6}`);

  info("Executing batch...");
  const batchTx = await account.execute([{
    contractAddress: POOL,
    entrypoint: "execute_batch",
    calldata: CallData.compile({
      min_wbtc_out: { low: 0n, high: 0n },
      routes: [],
    }),
  }]);
  await provider.waitForTransaction(batchTx.transaction_hash);
  ok(`Batch tx: ${batchTx.transaction_hash}`);

  const pendingAfter = Number(await pool.get_pending_usdc());
  ok(`Pending USDC after: ${pendingAfter / 1e6}`);

  // ───────────────────────────────────────
  // Step 4: Wait for privacy cooldown
  // ───────────────────────────────────────
  console.log("\nStep 4: Privacy cooldown (60s)");
  for (let i = 60; i > 0; i -= 10) {
    info(`${i}s remaining...`);
    await sleep(10_000);
  }
  ok("Cooldown complete");

  // ───────────────────────────────────────
  // Step 5: Build Merkle proof + generate ZK proof
  // ───────────────────────────────────────
  console.log("\nStep 5: Generate ZK proof");
  const onChainLeafCount = Number(await pool.get_leaf_count());
  info(`On-chain leaf count: ${onChainLeafCount}`);

  const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
    pool.get_leaf(i).then((leaf: any) => num.toHex(leaf as bigint))
  );
  const allLeaves = await Promise.all(leafPromises);
  info(`Fetched ${allLeaves.length} leaves`);

  // Find our leaf
  const foundIndex = allLeaves.indexOf(commitment);
  if (foundIndex === -1) {
    fail("Commitment not found in leaves!");
    process.exit(1);
  }
  ok(`Found commitment at leaf index ${foundIndex}`);

  const { path: merklePath, indices: pathIndices } = buildMerkleProof(foundIndex, allLeaves);
  ok(`Merkle proof built (${merklePath.length} elements)`);

  // Call /prove endpoint
  info("Calling /prove endpoint...");
  const proveStart = Date.now();
  const proveRes = await fetch(`${RELAYER_URL}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: secretBigint.toString(),
      blinder: blinderBigint.toString(),
      denomination,
    }),
  });

  if (!proveRes.ok) {
    const errText = await proveRes.text();
    fail(`/prove failed: ${errText}`);
    process.exit(1);
  }

  const proveData = await proveRes.json();
  const proofDuration = ((Date.now() - proveStart) / 1000).toFixed(1);
  ok(`ZK proof generated in ${proofDuration}s (${proveData.proof.length} calldata elements)`);

  // ───────────────────────────────────────
  // Step 6: Withdraw (direct, not via relayer — to test both paths)
  // ───────────────────────────────────────
  console.log("\nStep 6: Withdraw (direct withdraw_private)");
  const wbtcBefore = await wbtc.balance_of(accountAddress);
  info(`WBTC balance before: ${Number(wbtcBefore) / 1e8}`);

  info("Submitting withdraw_private...");
  const withdrawTx = await account.execute([{
    contractAddress: POOL,
    entrypoint: "withdraw_private",
    calldata: CallData.compile({
      denomination,
      zk_nullifier: proveData.zkNullifier,
      zk_commitment: proveData.zkCommitment,
      proof: proveData.proof,
      merkle_path: merklePath,
      path_indices: pathIndices,
      recipient: accountAddress,
      btc_recipient_hash: "0x0",
    }),
  }]);
  await provider.waitForTransaction(withdrawTx.transaction_hash);
  ok(`Withdraw tx: ${withdrawTx.transaction_hash}`);

  const wbtcAfter = await wbtc.balance_of(accountAddress);
  const wbtcReceived = BigInt(wbtcAfter.toString()) - BigInt(wbtcBefore.toString());
  ok(`WBTC received: ${Number(wbtcReceived) / 1e8}`);

  // Verify nullifier is spent
  const isSpent = await pool.is_zk_nullifier_spent(proveData.zkNullifier);
  ok(`Nullifier spent: ${isSpent}`);

  // ───────────────────────────────────────
  // Summary
  // ───────────────────────────────────────
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║          E2E TEST PASSED             ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`
  Shield tx:     ${shieldTx.transaction_hash}
  Batch tx:      ${batchTx.transaction_hash}
  Withdraw tx:   ${withdrawTx.transaction_hash}
  ZK proof size: ${proveData.proof.length} felt252 values
  Proof time:    ${proofDuration}s
  WBTC received: ${Number(wbtcReceived) / 1e8}
`);
}

main().catch((err) => {
  console.error("\n✗ E2E TEST FAILED:", err.message ?? err);
  process.exit(1);
});
