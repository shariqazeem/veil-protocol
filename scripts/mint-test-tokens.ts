/**
 * Mint test USDC + WBTC to any address on Sepolia dev deployment.
 *
 * Usage:
 *   npx ts-node --esm mint-test-tokens.ts <RECIPIENT_ADDRESS>
 *   npx ts-node --esm mint-test-tokens.ts 0xYOUR_WALLET_ADDRESS
 */

import { Account, RpcProvider, Contract, CallData, constants, type Abi } from "starknet";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
];

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.error("Usage: npx ts-node --esm mint-test-tokens.ts <RECIPIENT_ADDRESS>");
    process.exit(1);
  }

  const privateKey = process.env.PRIVATE_KEY;
  const accountAddress = process.env.ACCOUNT_ADDRESS;
  const rpcUrl = process.env.STARKNET_RPC_URL ?? "https://starknet-sepolia-rpc.publicnode.com";

  if (!privateKey || !accountAddress) {
    console.error("Set PRIVATE_KEY and ACCOUNT_ADDRESS in .env");
    process.exit(1);
  }

  const deployment = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "deployment.json"), "utf-8"),
  );

  if (deployment.mode !== "dev") {
    console.error("This script only works with dev deployment (mock tokens).");
    console.error(`Current mode: ${deployment.mode}`);
    process.exit(1);
  }

  const USDC = deployment.contracts.usdc;
  const WBTC = deployment.contracts.wbtc;
  const ROUTER = deployment.contracts.avnuRouter;

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, constants.TRANSACTION_VERSION.V3,
  );

  const usdc = new Contract(ERC20_ABI, USDC, provider);

  console.log(`\nMinting test tokens to: ${recipient}\n`);

  // Mint 10,000 USDC (6 decimals) to recipient
  const usdcAmount = 10_000_000_000n; // 10,000 USDC
  console.log("Minting 10,000 USDC...");
  const mintTx = await account.execute([
    {
      contractAddress: USDC,
      entrypoint: "mint",
      calldata: CallData.compile({
        to: recipient,
        amount: { low: usdcAmount, high: 0n },
      }),
    },
  ]);
  await provider.waitForTransaction(mintTx.transaction_hash);
  console.log(`  ✓ USDC mint tx: ${mintTx.transaction_hash}`);

  // Also ensure MockAvnuRouter has WBTC
  const routerWbtc = await new Contract(ERC20_ABI, WBTC, provider).balance_of(ROUTER);
  if (BigInt(routerWbtc.toString()) < 100_000_000n) {
    console.log("Minting WBTC to MockAvnuRouter...");
    const mintWbtcTx = await account.execute([{
      contractAddress: WBTC,
      entrypoint: "mint",
      calldata: CallData.compile({
        to: ROUTER,
        amount: { low: 100_000_000_000n, high: 0n },
      }),
    }]);
    await provider.waitForTransaction(mintWbtcTx.transaction_hash);
    console.log(`  ✓ WBTC router mint tx: ${mintWbtcTx.transaction_hash}`);
  }

  // Check final balance
  const bal = await usdc.balance_of(recipient);
  console.log(`\n  Final USDC balance: ${Number(bal) / 1e6} USDC`);
  console.log(`\n✓ Done! You can now test shielding on the frontend.\n`);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
