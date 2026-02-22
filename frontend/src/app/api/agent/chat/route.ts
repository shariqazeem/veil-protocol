/**
 * AI Privacy Chat API — intelligent contextual privacy advisor.
 *
 * POST → accepts { input, deposits? }
 *         Returns AI-generated privacy advice, scores, and recommendations
 *         based on real on-chain pool state.
 *
 * Free for most intents. Premium intents (deep audit) redirect to /privacy-audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { Contract, RpcProvider, type Abi } from "starknet";
import { POOL_ADDRESS, RPC_URL } from "../../relayer/shared";
import {
  generateChatResponse,
  type ChatContext,
} from "@/utils/privacyChat";
import { type PoolPrivacyState, type DepositInfo } from "@/utils/privacyScore";

const POOL_ABI: Abi = [
  { type: "function", name: "get_pending_usdc", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_batch_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

async function fetchBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) return data.bitcoin.usd;
    }
  } catch { /* fallback */ }
  try {
    const res = await fetch("https://api.coincap.io/v2/assets/bitcoin", { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.priceUsd) return parseFloat(data.data.priceUsd);
    }
  } catch { /* */ }
  return 0;
}

async function fetchPoolState(): Promise<PoolPrivacyState> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });

  const [pendingRaw, _batchCount, leafCount, a0, a1, a2, a3, volumeRaw, totalBatches] =
    await Promise.all([
      pool.get_pending_usdc(),
      pool.get_batch_count(),
      pool.get_leaf_count(),
      pool.get_anonymity_set(0),
      pool.get_anonymity_set(1),
      pool.get_anonymity_set(2),
      pool.get_anonymity_set(3),
      pool.get_total_volume(),
      pool.get_total_batches_executed(),
    ]);

  const anonSets = [Number(a0), Number(a1), Number(a2), Number(a3)];
  return {
    anonSets,
    totalDeposits: anonSets.reduce((s, v) => s + v, 0),
    activeTiers: anonSets.filter((c) => c > 0).length,
    leafCount: Number(leafCount),
    batchesExecuted: Number(totalBatches),
    pendingUsdc: Number(BigInt(pendingRaw.toString())) / 1_000_000,
    totalVolume: Number(BigInt(volumeRaw.toString())) / 1_000_000,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { input, deposits } = body as {
      input?: string;
      deposits?: DepositInfo[];
    };

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing 'input' field — send a privacy question" },
        { status: 400 },
      );
    }

    // Fetch live pool state and BTC price in parallel
    const [poolState, btcPrice] = await Promise.all([
      fetchPoolState(),
      fetchBtcPrice(),
    ]);

    const context: ChatContext = {
      pool: poolState,
      deposits: deposits ?? [],
      btcPrice,
    };

    const response = generateChatResponse(input.trim(), context);

    return NextResponse.json({
      timestamp: Date.now(),
      ...response,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] Error:", msg);
    return NextResponse.json({ error: "Chat error", details: msg }, { status: 500 });
  }
}
