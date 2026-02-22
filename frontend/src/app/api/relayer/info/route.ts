import { NextRequest, NextResponse } from "next/server";
import {
  POOL_ADDRESS, FEE_BPS, getRelayerAccount, RPC_URL, rateLimit,
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
  });
}
