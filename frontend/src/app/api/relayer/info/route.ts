import { NextRequest, NextResponse } from "next/server";
import {
  POOL_ADDRESS, FEE_BPS, getRelayerAccount, RPC_URL, rateLimit,
  X402_RELAY_ENABLED, RELAY_FEE_USDC, RELAY_FEE_STRK, NETWORK,
} from "../shared";

export async function GET(req: NextRequest) {
  const rateLimited = rateLimit(req.headers.get("x-forwarded-for") ?? "unknown");
  if (rateLimited) return rateLimited;
  const account = getRelayerAccount();

  return NextResponse.json({
    pool: POOL_ADDRESS,
    fee_bps: FEE_BPS,
    relayer: account ? "online" : "offline",
    relayerAddress: account?.address ?? null,
    rpc: RPC_URL,
    x402Relay: {
      enabled: X402_RELAY_ENABLED,
      flatFee: NETWORK === "mainnet" ? `$${RELAY_FEE_USDC} USDC` : `${RELAY_FEE_STRK} STRK`,
      description: "Pay flat fee upfront via x402 instead of 2% deduction",
    },
  });
}
