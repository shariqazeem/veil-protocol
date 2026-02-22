import "dotenv/config";
import { Account, RpcProvider, constants, CallData } from "starknet";

const STRK = "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";
const USDC = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
const TO = "0x05db1a00Fa6AD44e82DE90CAe46d82Cd5cE052394320d60946eF661dB68e3048";
const RPC_URL = process.env.STARKNET_RPC_URL ?? "https://rpc.starknet.lava.build";

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, process.env.ACCOUNT_ADDRESS!, process.env.PRIVATE_KEY!, undefined, constants.TRANSACTION_VERSION.V3);

  const usdcAmount = "1790000"; // 1.79 USDC
  const strkAmount = "5000000000000000000"; // 5 STRK

  console.log(`\nSending to: ${TO}`);
  console.log("  1.79 USDC + 5 STRK for gas\n");

  const tx = await account.execute([
    {
      contractAddress: USDC,
      entrypoint: "transfer",
      calldata: CallData.compile({ recipient: TO, amount: { low: usdcAmount, high: "0" } }),
    },
    {
      contractAddress: STRK,
      entrypoint: "transfer",
      calldata: CallData.compile({ recipient: TO, amount: { low: strkAmount, high: "0" } }),
    },
  ]);

  console.log(`TX: ${tx.transaction_hash}`);
  console.log(`Voyager: https://voyager.online/tx/${tx.transaction_hash}`);
  console.log("Waiting...");
  await provider.waitForTransaction(tx.transaction_hash);
  console.log("Confirmed!\n");

  const uBal = await provider.callContract({ contractAddress: USDC, entrypoint: "balanceOf", calldata: [TO] });
  const sBal = await provider.callContract({ contractAddress: STRK, entrypoint: "balanceOf", calldata: [TO] });
  console.log("Your wallet:");
  console.log(`  USDC: ${(Number(BigInt(uBal[0])) / 1e6).toFixed(6)}`);
  console.log(`  STRK: ${(Number(BigInt(sBal[0])) / 1e18).toFixed(4)}`);
}

main().catch((e) => { console.error("Failed:", e?.message ?? e); process.exit(1); });
