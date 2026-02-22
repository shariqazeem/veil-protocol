/**
 * Privacy Score API — free real-time pool privacy metrics.
 *
 * GET → returns pool-wide privacy health, per-tier anonymity analysis,
 *       and improvement suggestions. No payment required.
 */

import { NextResponse } from "next/server";
import { Contract, RpcProvider, type Abi } from "starknet";
import { POOL_ADDRESS, RPC_URL } from "../../relayer/shared";
import {
  calculatePoolHealth,
  type PoolPrivacyState,
} from "@/utils/privacyScore";

const POOL_ABI: Abi = [
  { type: "function", name: "get_pending_usdc", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_batch_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

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

export async function GET() {
  try {
    const poolState = await fetchPoolState();
    const health = calculatePoolHealth(poolState);

    return NextResponse.json({
      timestamp: Date.now(),
      pool: poolState,
      health,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[privacy-score] Error:", msg);
    return NextResponse.json({ error: "Failed to fetch privacy metrics", details: msg }, { status: 500 });
  }
}
