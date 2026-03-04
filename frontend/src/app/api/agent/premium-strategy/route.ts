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
    }

    return { valid: false, error: "STRK transfer to treasury not found or amount too low" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[premium-strategy] Tx verification error: ${msg}`);
    return { valid: false, error: `Tx verification failed: ${msg}` };
  }
}

// Deposit info from client localStorage
interface DepositInfo {
  tier: number;
  depositTimestamp: number;
  leafIndex: number;
  claimed: boolean;
}

const TIER_AMOUNTS = [1, 10, 100, 1000];
const TIER_LABELS = ["$1", "$10", "$100", "$1,000"];

/** Generate deeply personalized premium analysis. */
async function generatePremiumAnalysis(
  userInput: string,
  targetUsdc: number,
  deposits: DepositInfo[],
) {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });

  const [pendingRaw, _batchCount, leafCount, anonSet0, anonSet1, anonSet2, anonSet3, totalVolumeRaw, totalBatches, btcPrice] =
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
  const leaves = Number(leafCount);
  const totalParticipants = anon.reduce((s, v) => s + v, 0);

  // ---- YOUR POSITION: Score each deposit ----
  const now = Date.now();
  const activeDeposits = deposits.filter(d => !d.claimed);
  const depositAnalysis = activeDeposits.map(d => {
    const tierAnon = anon[d.tier] ?? 0;
    const hoursElapsed = (now - d.depositTimestamp) / 3_600_000;
    const depositsSince = Math.max(0, leaves - (d.leafIndex + 1));

    // Anonymity score (40%)
    const anonScore = tierAnon >= 10 ? 100 : tierAnon >= 5 ? 70 : tierAnon >= 3 ? 45 : tierAnon >= 2 ? 25 : 10;
    // Time score (20%) — longer = better
    const timeScore = hoursElapsed >= 168 ? 100 : hoursElapsed >= 72 ? 80 : hoursElapsed >= 24 ? 60 : hoursElapsed >= 6 ? 40 : 20;
    // Deposits-since score (20%)
    const sinceScore = depositsSince >= 20 ? 100 : depositsSince >= 10 ? 70 : depositsSince >= 5 ? 50 : depositsSince >= 2 ? 30 : 10;
    // Timing safety (20%) — penalize immediate withdrawal
    const timingSafety = hoursElapsed >= 24 ? 100 : hoursElapsed >= 6 ? 70 : hoursElapsed >= 1 ? 40 : 15;

    const overall = Math.round(anonScore * 0.4 + timeScore * 0.2 + sinceScore * 0.2 + timingSafety * 0.2);

    const withdrawSafe = overall >= 60 && hoursElapsed >= 6 && tierAnon >= 3;

    return {
      tier: d.tier,
      label: TIER_LABELS[d.tier],
      amount: TIER_AMOUNTS[d.tier],
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      depositsSince,
      privacyScore: overall,
      rating: overall >= 80 ? "Strong" : overall >= 60 ? "Good" : overall >= 40 ? "Moderate" : "Weak",
      factors: { anonymity: anonScore, time: timeScore, depositsSince: sinceScore, timingSafety },
      withdrawSafe,
      withdrawAdvice: withdrawSafe
        ? "Safe to withdraw — anonymity set is sufficient"
        : hoursElapsed < 6 ? "Wait at least 6 hours to avoid timing correlation"
        : tierAnon < 3 ? `Wait for more deposits in ${TIER_LABELS[d.tier]} tier (currently ${tierAnon})`
        : "Consider waiting for stronger anonymity coverage",
    };
  });

  const avgScore = depositAnalysis.length > 0
    ? Math.round(depositAnalysis.reduce((s, d) => s + d.privacyScore, 0) / depositAnalysis.length)
    : 0;

  // ---- YOUR STRATEGY: Personalized plan for the target amount ----
  const affordable = [0, 1, 2, 3].filter(t => TIER_AMOUNTS[t] <= targetUsdc);

  // Find optimal split — prioritize tiers with highest anonymity sets
  const optimalPlan: Array<{ tier: number; label: string; count: number; costUsd: number; privacyGain: string }> = [];
  let remaining = targetUsdc;

  // Sort tiers by anonymity set (desc) — deposit where others are to maximize privacy
  const sortedTiers = affordable.sort((a, b) => (anon[b] || 0) - (anon[a] || 0));

  for (const tier of sortedTiers) {
    if (remaining < TIER_AMOUNTS[tier]) continue;
    const count = Math.floor(remaining / TIER_AMOUNTS[tier]);
    const limited = Math.min(count, 10); // cap per-tier
    if (limited > 0) {
      const newAnon = anon[tier] + limited;
      optimalPlan.push({
        tier,
        label: TIER_LABELS[tier],
        count: limited,
        costUsd: TIER_AMOUNTS[tier] * limited,
        privacyGain: `${anon[tier]} → ${newAnon} participants (${newAnon >= 10 ? "Strong" : newAnon >= 5 ? "Good" : "Moderate"} unlinkability)`,
      });
      remaining -= TIER_AMOUNTS[tier] * limited;
    }
    if (remaining <= 0) break;
  }

  const planTotal = optimalPlan.reduce((s, p) => s + p.costUsd, 0);
  const planBtc = btcPrice > 0 ? (planTotal / btcPrice * 0.99) : 0;

  // ---- YOUR PROJECTION: BTC for YOUR specific amount ----
  const yourBtcProjection = btcPrice > 0 ? {
    your_amount: targetUsdc,
    btc_estimate: (targetUsdc / btcPrice * 0.99).toFixed(8),
    btc_price: btcPrice,
    slippage: "~1% via AVNU DEX aggregation",
    dca_projection_30d: (targetUsdc * 30 / btcPrice * 0.99).toFixed(6),
    dca_projection_90d: (targetUsdc * 90 / btcPrice * 0.99).toFixed(6),
  } : null;

  // ---- THREAT DETECTION ----
  const threats: string[] = [];
  for (const d of depositAnalysis) {
    if (d.hoursElapsed < 1) threats.push(`${d.label} deposit is very recent — high timing correlation risk`);
    if (d.factors.anonymity < 30) threats.push(`${d.label} tier has weak anonymity — your deposit is easily narrowed`);
  }
  if (totalParticipants < 5) threats.push("Pool has very few participants — protocol-level privacy is limited");
  if (activeDeposits.length > 0 && new Set(activeDeposits.map(d => d.tier)).size === 1) {
    threats.push("All deposits in one tier — consider spreading across tiers for better unlinkability");
  }

  // ---- PERSONALIZED RECOMMENDATIONS ----
  const recommendations: string[] = [];

  if (depositAnalysis.length > 0) {
    const weakest = depositAnalysis.reduce((w, d) => d.privacyScore < w.privacyScore ? d : w);
    if (weakest.privacyScore < 60) {
      recommendations.push(`Your ${weakest.label} deposit has a weak privacy score (${weakest.privacyScore}/100). ${weakest.withdrawAdvice}.`);
    }
    const safeToClaim = depositAnalysis.filter(d => d.withdrawSafe).length;
    if (safeToClaim > 0) {
      recommendations.push(`${safeToClaim} of ${depositAnalysis.length} deposits are safe to withdraw now.`);
    }
  }

  if (optimalPlan.length > 0) {
    const bestTier = optimalPlan[0];
    recommendations.push(`Best entry: ${bestTier.label} tier — ${bestTier.privacyGain}.`);
  }

  if (pendingUsdc > 0) {
    recommendations.push(`$${pendingUsdc.toFixed(0)} USDC pending batch conversion — deposit now to join this batch cycle.`);
  }

  if (btcPrice > 0 && yourBtcProjection) {
    recommendations.push(`At current BTC price ($${btcPrice.toLocaleString()}), your $${targetUsdc} converts to ~${yourBtcProjection.btc_estimate} BTC after fees.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Pool conditions are favorable — execute your strategy when ready.");
  }

  return {
    premium: true,
    timestamp: Date.now(),
    user_input: userInput,
    your_amount: targetUsdc,
    // Your position
    your_deposits: {
      count: depositAnalysis.length,
      total_shielded: depositAnalysis.reduce((s, d) => s + d.amount, 0),
      avg_privacy_score: avgScore,
      overall_rating: avgScore >= 80 ? "Strong" : avgScore >= 60 ? "Good" : avgScore >= 40 ? "Moderate" : avgScore > 0 ? "Weak" : "No deposits",
      deposits: depositAnalysis,
    },
    // Optimal strategy for the user's amount
    optimal_plan: {
      steps: optimalPlan,
      total_usdc: planTotal,
      estimated_btc: planBtc.toFixed(8),
      deposit_count: optimalPlan.reduce((s, p) => s + p.count, 0),
    },
    // BTC projection for THEIR specific amount
    btc_projection: yourBtcProjection,
    // Threats specific to their position
    threats,
    // Personalized recommendations
    recommendations,
    // Pool context (compact)
    pool_summary: {
      health: totalParticipants >= 20 ? "Strong" : totalParticipants >= 10 ? "Good" : totalParticipants >= 5 ? "Moderate" : "Weak",
      participants: totalParticipants,
      anon_sets: anon.map((c, i) => ({ tier: TIER_LABELS[i], count: c })),
      pending_usdc: pendingUsdc,
      volume,
    },
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
    const { input, payment_tx, target_usdc, deposits } = body as {
      input?: string;
      payment_tx?: string;
      target_usdc?: number;
      deposits?: DepositInfo[];
    };

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

    // Payment verified — generate personalized premium analysis
    const analysis = await generatePremiumAnalysis(
      input ?? "analyze pool",
      target_usdc ?? 100,
      deposits ?? [],
    );

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
