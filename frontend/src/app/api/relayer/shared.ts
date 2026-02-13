/**
 * Shared relayer configuration for all API routes.
 * Uses environment variables for private key and account address.
 */

import { Account, RpcProvider } from "starknet";
import addresses from "@/contracts/addresses.json";

const network = addresses.network ?? "sepolia";

export const RPC_URL =
  process.env.STARKNET_RPC_URL ??
  (network === "mainnet"
    ? "https://starknet-mainnet.public.blastapi.io"
    : "https://starknet-sepolia-rpc.publicnode.com");

export const POOL_ADDRESS = addresses.contracts.shieldedPool;
export const FEE_BPS = 200; // 2% relayer fee

export function getRelayerAccount(): Account | null {
  const privateKey = process.env.RELAYER_PRIVATE_KEY?.trim();
  const accountAddress = process.env.RELAYER_ACCOUNT_ADDRESS?.trim();

  if (!privateKey || !accountAddress) return null;

  return new Account({
    provider: new RpcProvider({ nodeUrl: RPC_URL }),
    address: accountAddress,
    signer: privateKey,
  });
}

export function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URL });
}
