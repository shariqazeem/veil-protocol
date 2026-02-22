/**
 * Swap STRK → USDC via AVNU Router on Starknet mainnet.
 *
 * Usage: cd scripts && npx ts-node --esm swap-strk-to-usdc.ts [amount_strk]
 * Default: 40 STRK
 */

import "dotenv/config";
import { Account, RpcProvider, constants, CallData } from "starknet";

const STRK = "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";
const USDC = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
const AVNU_API = "https://starknet.api.avnu.fi";
const RPC_URL = process.env.STARKNET_RPC_URL ?? "https://rpc.starknet.lava.build";

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const accountAddress = process.env.ACCOUNT_ADDRESS!;
  const amountStrk = parseFloat(process.argv[2] ?? "40");

  if (!privateKey || !accountAddress) {
    console.error("Set PRIVATE_KEY and ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, accountAddress, privateKey, undefined, constants.TRANSACTION_VERSION.V3);

  const sellAmountWei = BigInt(Math.floor(amountStrk * 1e18));
  const sellAmountHex = "0x" + sellAmountWei.toString(16);

  console.log(`\nSwapping ${amountStrk} STRK → USDC`);
  console.log(`Account: ${accountAddress}`);
  console.log(`Sell amount: ${sellAmountHex} (${sellAmountWei} wei)\n`);

  // Step 1: Get quote
  console.log("1. Getting AVNU quote...");
  const quoteUrl = `${AVNU_API}/swap/v2/quotes?sellTokenAddress=${STRK}&buyTokenAddress=${USDC}&sellAmount=${sellAmountHex}&takerAddress=${accountAddress}`;
  const quoteRes = await fetch(quoteUrl);
  const quotes = await quoteRes.json();

  if (!Array.isArray(quotes) || quotes.length === 0) {
    console.error("No quotes available:", JSON.stringify(quotes).slice(0, 500));
    process.exit(1);
  }

  const quote = quotes[0];
  const buyAmount = BigInt(quote.buyAmount);
  const usdcAmount = Number(buyAmount) / 1e6;
  console.log(`   Quote: ${amountStrk} STRK → ${usdcAmount.toFixed(6)} USDC`);
  console.log(`   Rate: $${(usdcAmount / amountStrk).toFixed(6)} per STRK`);
  console.log(`   Quote ID: ${quote.quoteId}\n`);

  // Step 2: Build swap calldata
  console.log("2. Building swap transaction...");
  const buildRes = await fetch(`${AVNU_API}/swap/v2/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: quote.quoteId,
      takerAddress: accountAddress,
      slippage: 0.05, // 5% slippage tolerance
    }),
  });
  const buildData = await buildRes.json();

  // AVNU v2 returns { calls: [...] } with approve + swap calls
  const calls = buildData.calls ?? [];
  if (calls.length === 0) {
    console.error("Build failed:", JSON.stringify(buildData).slice(0, 500));
    process.exit(1);
  }

  console.log(`   ${calls.length} calls (approve + swap)`);
  for (const c of calls) {
    console.log(`   → ${c.entrypoint} on ${c.contractAddress.slice(0, 12)}...`);
  }
  console.log();

  const txRes = await account.execute(calls);
  console.log(`   TX: ${txRes.transaction_hash}`);
  console.log(`   Voyager: https://voyager.online/tx/${txRes.transaction_hash}`);
  console.log("   Waiting for confirmation...");

  await provider.waitForTransaction(txRes.transaction_hash);
  console.log("   Confirmed!\n");

  // Step 4: Check balances
  console.log("4. Checking balances...");
  const strkBal = await provider.callContract({
    contractAddress: STRK,
    entrypoint: "balanceOf",
    calldata: [accountAddress],
  });
  const usdcBal = await provider.callContract({
    contractAddress: USDC,
    entrypoint: "balanceOf",
    calldata: [accountAddress],
  });

  const strkFinal = Number(BigInt(strkBal[0])) / 1e18;
  const usdcFinal = Number(BigInt(usdcBal[0])) / 1e6;

  console.log(`   STRK: ${strkFinal.toFixed(4)}`);
  console.log(`   USDC: ${usdcFinal.toFixed(6)}`);
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("\nFailed:", err?.message ?? err);
  process.exit(1);
});
