/**
 * Shared relayer configuration for all API routes.
 * Uses environment variables for private key and account address.
 */

import { NextResponse } from "next/server";
import { Account, RpcProvider, ETransactionVersion } from "starknet";
import addresses from "@/contracts/addresses.json";

// ---------------------------------------------------------------------------
// Rate Limiting (in-memory, per-IP, sliding window)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 requests per minute per IP

export function rateLimit(ip: string): NextResponse | null {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded — try again later" },
      { status: 429 },
    );
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  // Cleanup stale IPs every ~100 entries
  if (rateLimitMap.size > 100) {
    for (const [key, vals] of rateLimitMap) {
      if (vals.every((t) => now - t > RATE_LIMIT_WINDOW_MS)) rateLimitMap.delete(key);
    }
  }
  return null;
}

const network = addresses.network ?? "sepolia";

/** Strip literal \n that Vercel CLI sometimes appends to env vars */
const cleanEnv = (v: string | undefined) => v?.trim().replace(/\\n/g, "");

export const RPC_URL =
  cleanEnv(process.env.STARKNET_RPC_URL) ??
  (network === "mainnet"
    ? "https://rpc.starknet.lava.build"
    : "https://starknet-sepolia-rpc.publicnode.com");

export const POOL_ADDRESS = addresses.contracts.shieldedPool;
export const USDC_ADDRESS = addresses.contracts.usdc;
export const WBTC_ADDRESS = addresses.contracts.wbtc;
export const FEE_BPS = Number(process.env.RELAYER_FEE_BPS ?? 200); // 2% relayer fee (legacy path)

export const NETWORK = network;

// Treasury address that receives x402 micropayments (Agent tab only) — set via env for mainnet
export const TREASURY_ADDRESS =
  process.env.X402_TREASURY_ADDRESS ??
  addresses.deployer;

export const AVNU_API_BASE =
  network === "mainnet"
    ? "https://starknet.api.avnu.fi"
    : "https://sepolia.api.avnu.fi";

export function getRelayerAccount(): Account | null {
  const privateKey = cleanEnv(process.env.RELAYER_PRIVATE_KEY);
  const accountAddress = cleanEnv(process.env.RELAYER_ACCOUNT_ADDRESS);

  if (!privateKey || !accountAddress) return null;

  // Use V1 (ETH gas) when RELAYER_ETH_GAS=true, otherwise V3 (STRK gas)
  const useEthGas = process.env.RELAYER_ETH_GAS === "true";

  return new Account({
    provider: new RpcProvider({ nodeUrl: RPC_URL }),
    address: accountAddress,
    signer: privateKey,
    ...(useEthGas
      ? { transactionVersion: ETransactionVersion.V1 as any }
      : {}),
  });
}

export function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URL });
}
