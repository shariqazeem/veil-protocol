import { Account, RpcProvider, CallData, constants } from "starknet";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, "deployment.json"), "utf-8"));

const rpcUrl = process.env.STARKNET_RPC_URL ?? "https://starknet-sepolia-rpc.publicnode.com";
const privateKey = process.env.PRIVATE_KEY!;
const accountAddress = process.env.ACCOUNT_ADDRESS!;
const USDC = deployment.contracts.usdc;

const provider = new RpcProvider({ nodeUrl: rpcUrl });
const account = new Account(provider, accountAddress, privateKey, undefined, constants.TRANSACTION_VERSION.V3);

console.log("Approving relayer to spend its own USDC...");
console.log(`  USDC: ${USDC}`);
console.log(`  Spender (self): ${accountAddress}`);

const tx = await account.execute([{
  contractAddress: USDC,
  entrypoint: "approve",
  calldata: CallData.compile({
    spender: accountAddress,
    amount: { low: 10_000_000_000n, high: 0n }, // 10,000 USDC
  }),
}]);

await provider.waitForTransaction(tx.transaction_hash);
console.log(`  ✓ Self-approval tx: ${tx.transaction_hash}`);
