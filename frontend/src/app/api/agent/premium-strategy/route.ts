/**
 * Premium Strategy API — gated by direct STRK micropayment.
 *
 * GET  → returns 402 with payment requirements (how much to pay, where)
 * POST → accepts { input, payment_tx } — verifies the on-chain STRK transfer,
 *        then returns premium AI strategy analysis.
 *
 * Cost: 0.005 STRK per analysis (~$0.0002)
 */

import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, Contract, num, type Abi } from "starknet";
import {
  buildSTRKPayment,
  STRK_ADDRESSES,
  type PaymentRequirements,
} from "x402-starknet";
import { POOL_ADDRESS, RPC_URL, NETWORK, TREASURY_ADDRESS } from "../../relayer/shared";

const x402Network = NETWORK === "mainnet" ? "starknet:mainnet" as const : "starknet:sepolia" as const;

// Price per premium analysis: 0.005 STRK (~$0.0002)
const PREMIUM_PRICE_STRK = Number(process.env.PREMIUM_PRICE_STRK ?? 0.005);

const POOL_ABI: Abi = [
  { type: "function", name: "get_pending_usdc", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_batch_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

/** Normalize any hex address for comparison (strips leading zeros). */
const norm = (a: string) => {
  try { return num.toHex(num.toBigInt(a)).toLowerCase(); }
  catch { return a.toLowerCase(); }
};

/** Expected fee in atomic units (STRK has 18 decimals). */
function getExpectedFeeAtomic(): bigint {
  return BigInt(Math.round(PREMIUM_PRICE_STRK * 1e18));
}

/** STRK token address for the current network. */
function getStrkToken(): string {
  return STRK_ADDRESSES[x402Network] ?? "";
}

/** Fetch BTC price. */
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

/** Build the payment requirements for the 402 response. */
function getPaymentRequirements(): PaymentRequirements {
  return buildSTRKPayment({
    network: x402Network,
    amount: PREMIUM_PRICE_STRK,
    payTo: TREASURY_ADDRESS,
  });
}

/** Build the 402 response telling the client how to pay. */
function build402Response(requirements: PaymentRequirements): NextResponse {
  const paymentRequired = {
    x402Version: 2,
    error: "Payment required for premium strategy analysis",
    resource: {
      url: "/api/agent/premium-strategy",
      description: "Premium AI strategy analysis with risk scoring, pool health, and optimal timing",
      mimeType: "application/json",
    },
    accepts: [requirements],
  };

  return NextResponse.json(paymentRequired, { status: 402 });
}

/**
 * Verify a direct on-chain STRK transfer to the treasury.
 * Returns the payer address if valid.
 */
async function verifyMicropayment(
  provider: RpcProvider,
  txHash: string,
): Promise<{ valid: boolean; payer?: string; error?: string }> {
  try {
    const receipt = await provider.waitForTransaction(txHash, {
      successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
      retryInterval: 2000,
    });

    const expectedToken = norm(getStrkToken());
    const expectedAmount = getExpectedFeeAtomic();
    const treasuryNorm = norm(TREASURY_ADDRESS);
    const TRANSFER_KEY = norm("0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9");

    const events = (receipt as any).events ?? [];
    console.log(`[premium-strategy] Verifying tx ${txHash}, ${events.length} events`);

    for (const event of events) {
      const emitter = norm(event.from_address ?? "");
      const keys = (event.keys ?? []).map((k: string) => norm(k));
      const data = (event.data ?? []).map((d: string) => d);

      if (keys[0] !== TRANSFER_KEY) continue;
      if (emitter !== expectedToken) continue;

      // Starknet Transfer event format (current):
      //   keys: [selector]
      //   data: [from, to, amount_low, amount_high]
      // Legacy format had from/to in keys — handle both
      let from: string, to: string, amountLow: bigint, amountHigh: bigint;

      if (keys.length >= 3) {
        // Legacy: keys=[selector, from, to], data=[amount_low, amount_high]
        from = keys[1];
        to = keys[2];
        amountLow = BigInt(data[0] ?? "0");
        amountHigh = BigInt(data[1] ?? "0");
      } else {
        // Current: keys=[selector], data=[from, to, amount_low, amount_high]
        from = norm(data[0] ?? "0");
        to = norm(data[1] ?? "0");
        amountLow = BigInt(data[2] ?? "0");
        amountHigh = BigInt(data[3] ?? "0");
      }

      if (to !== treasuryNorm) continue;

      const totalAmount = amountLow + (amountHigh << 128n);
      if (totalAmount >= expectedAmount) {
        return { valid: true, payer: from };
      }
      console.log(`[premium-strategy] Amount too low: ${totalAmount} < ${expectedAmount}`);
    }

    return { valid: false, error: "STRK transfer to treasury not found or amount too low" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[premium-strategy] Tx verification error: ${msg}`);
    return { valid: false, error: `Tx verification failed: ${msg}` };
  }
}

/** Generate the premium strategy analysis. */
async function generatePremiumAnalysis(userInput: string) {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });

  const [pendingRaw, batchCount, leafCount, anonSet0, anonSet1, anonSet2, anonSet3, totalVolumeRaw, totalBatches, btcPrice] =
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
      fetchBtcPrice(),
    ]);

  const pendingUsdc = Number(BigInt(pendingRaw.toString())) / 1_000_000;
  const volume = Number(BigInt(totalVolumeRaw.toString())) / 1_000_000;
  const anon = [Number(anonSet0), Number(anonSet1), Number(anonSet2), Number(anonSet3)];

  const activeTiers = anon.filter(a => a > 0).length;
  const maxAnon = Math.max(...anon, 0);
  const minAnon = Math.min(...anon);
  const totalParticipants = anon.reduce((s, v) => s + v, 0);
  const csi = maxAnon * activeTiers;

  let healthScore = 0;
  healthScore += Math.min(totalParticipants * 2, 40);
  healthScore += activeTiers * 10;
  healthScore += Math.min(minAnon * 5, 30);

  const healthRating = healthScore >= 80 ? "Excellent" : healthScore >= 50 ? "Strong" : healthScore >= 25 ? "Moderate" : "Weak";

  const tierRisk = anon.map((count, i) => ({
    tier: i,
    label: ["$1", "$10", "$100", "$1,000"][i],
    participants: count,
    unlinkability: count >= 10 ? "Strong" : count >= 5 ? "Good" : count >= 3 ? "Moderate" : "Low",
    recommendation: count < 3
      ? "High marginal impact — deposits here significantly improve pool privacy"
      : count < 10
        ? "Growing set — additional deposits strengthen anonymity guarantees"
        : "Strong cover — safe for large position deployment",
  }));

  const batchesExecuted = Number(totalBatches);
  const pendingBatchRatio = pendingUsdc > 0 ? pendingUsdc / Math.max(volume, 1) : 0;
  const timingAdvice = pendingUsdc > 100
    ? "Batch nearing execution — deposit now to join this batch cycle"
    : pendingUsdc > 0
      ? "Active batch accumulating — good entry window"
      : "Fresh batch cycle — ideal time for privacy-first deposits";

  const btcProjections = btcPrice > 0 ? {
    current_price: btcPrice,
    projections: {
      "$10_deposit": (10 / btcPrice * 0.99).toFixed(8),
      "$100_deposit": (100 / btcPrice * 0.99).toFixed(8),
      "$1000_deposit": (1000 / btcPrice * 0.99).toFixed(6),
    },
    slippage_estimate: "1% (AVNU aggregation across Starknet DEXes)",
  } : null;

  const recommendations: string[] = [];
  if (maxAnon < 5) {
    recommendations.push("Pool is in early stage — deposits have maximum marginal privacy impact.");
  }
  const weakestTier = tierRisk.reduce((w, t) => t.participants < w.participants ? t : w);
  if (weakestTier.participants < 3) {
    recommendations.push(`${weakestTier.label} tier needs participants — contributing here maximizes protocol-wide privacy.`);
  }
  if (activeTiers < 4) {
    recommendations.push("Some tiers are empty — whale distribution across all tiers strengthens protocol coverage.");
  }
  if (pendingUsdc > 50) {
    recommendations.push(`$${pendingUsdc.toFixed(0)} USDC pending — batch conversion imminent, good timing for deposits.`);
  }
  if (btcPrice > 0 && btcPrice < 100000) {
    recommendations.push("BTC price in accumulation range — favorable entry for DCA strategies.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Pool health is strong — any strategy is viable with current anonymity sets.");
  }

  return {
    premium: true,
    timestamp: Date.now(),
    pool: {
      pending_usdc: pendingUsdc,
      total_volume: volume,
      batches_executed: batchesExecuted,
      leaf_count: Number(leafCount),
      batch_count: Number(batchCount),
      csi,
      health: { score: healthScore, rating: healthRating, active_tiers: activeTiers, total_participants: totalParticipants },
    },
    tier_analysis: tierRisk,
    timing: { advice: timingAdvice, pending_batch_ratio: pendingBatchRatio, batch_status: pendingUsdc > 0 ? "accumulating" : "idle" },
    btc: btcProjections,
    recommendations,
    user_input: userInput,
  };
}

/** GET: Return 402 with payment requirements. */
export async function GET() {
  return build402Response(getPaymentRequirements());
}

/** POST: Verify payment_tx, then return premium analysis. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { input, payment_tx } = body as { input?: string; payment_tx?: string };

    if (!payment_tx) {
      return build402Response(getPaymentRequirements());
    }

    // Verify the direct STRK transfer on-chain
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const verification = await verifyMicropayment(provider, payment_tx);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error ?? "Payment verification failed" },
        { status: 402 },
      );
    }

    // Payment verified — generate premium analysis
    const analysis = await generatePremiumAnalysis(input ?? "analyze pool");

    return NextResponse.json({
      ...analysis,
      payment: {
        settled: true,
        transaction: payment_tx,
        payer: verification.payer,
        amount: `${PREMIUM_PRICE_STRK} STRK`,
        method: "direct_transfer",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[premium-strategy] Error:", msg);
    return NextResponse.json({ error: "Premium strategy error", details: msg }, { status: 500 });
  }
}
