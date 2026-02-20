import { NextResponse } from "next/server";
import { Contract, RpcProvider, type Abi } from "starknet";
import { POOL_ADDRESS } from "../../relayer/shared";
import { RPC_URL } from "../../relayer/shared";

const POOL_ABI: Abi = [
  {
    type: "function",
    name: "get_pending_usdc",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_batch_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_leaf_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_anonymity_set",
    inputs: [{ name: "tier", type: "core::integer::u8" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
];

/** Fetch BTC price with multiple fallback sources. */
async function fetchBtcPrice(): Promise<number> {
  // Source 1: CoinGecko
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) return data.bitcoin.usd;
    }
  } catch { /* try next */ }

  // Source 2: CoinCap
  try {
    const res = await fetch(
      "https://api.coincap.io/v2/assets/bitcoin",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.priceUsd) return parseFloat(data.data.priceUsd);
    }
  } catch { /* try next */ }

  // Source 3: Blockchain.info
  try {
    const res = await fetch(
      "https://blockchain.info/ticker",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.USD?.last) return data.USD.last;
    }
  } catch { /* all sources failed */ }

  return 0; // Return 0 to signal failure — frontend will show "unavailable"
}

export async function GET() {
  try {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });

    // Fetch pool state and BTC price in parallel
    const [pendingRaw, batchCount, leafCount, anonSet0, anonSet1, anonSet2, anonSet3, btcPrice] =
      await Promise.all([
        pool.get_pending_usdc(),
        pool.get_batch_count(),
        pool.get_leaf_count(),
        pool.get_anonymity_set(0),
        pool.get_anonymity_set(1),
        pool.get_anonymity_set(2),
        pool.get_anonymity_set(3),
        fetchBtcPrice(),
      ]);

    const pendingUsdc = Number(BigInt(pendingRaw.toString())) / 1_000_000;
    const anon = [Number(anonSet0), Number(anonSet1), Number(anonSet2), Number(anonSet3)];

    // CSI: max_participants * active_tranches
    const activeTranches = anon.filter((a) => a > 0).length;
    const maxParticipants = Math.max(...anon, 0);
    const csi = maxParticipants * activeTranches;

    return NextResponse.json({
      pendingUsdc,
      batchCount: Number(batchCount),
      leafCount: Number(leafCount),
      anonSets: { 0: anon[0], 1: anon[1], 2: anon[2], 3: anon[3] },
      btcPrice,
      csi,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent/status] Error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
