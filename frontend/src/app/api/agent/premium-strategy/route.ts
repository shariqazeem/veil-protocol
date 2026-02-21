/**
 * x402-Gated Premium Strategy API
 *
 * Returns 402 Payment Required for unauthenticated requests.
 * After x402 payment verification, returns advanced AI strategy
 * with risk scoring, pool health analysis, and optimal timing.
 *
 * Cost: $0.01 USDC per analysis (paid via x402 micropayment)
 */

import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, Contract, type Abi } from "starknet";
import {
  buildUSDCPayment,
  buildSTRKPayment,
  verifyPayment,
  settlePayment,
  decodePaymentSignature,
  HTTP_HEADERS,
  type PaymentRequirements,
  type PaymentPayload,
} from "x402-starknet";
import { POOL_ADDRESS, RPC_URL, NETWORK, TREASURY_ADDRESS } from "../../relayer/shared";

const x402Network = NETWORK === "mainnet" ? "starknet:mainnet" as const : "starknet:sepolia" as const;

// Price per premium analysis: $0.01 USDC (or 0.005 STRK on sepolia)
const PREMIUM_PRICE_USDC = Number(process.env.PREMIUM_PRICE_USDC ?? 0.01);
const PREMIUM_PRICE_STRK = Number(process.env.PREMIUM_PRICE_STRK ?? 0.005);

const POOL_ABI: Abi = [
  { type: "function", name: "get_pending_usdc", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_batch_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

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

/** Build the x402 payment requirements. */
function getPaymentRequirements(): PaymentRequirements {
  if (x402Network === "starknet:mainnet") {
    return buildUSDCPayment({
      network: x402Network,
      amount: PREMIUM_PRICE_USDC,
      payTo: TREASURY_ADDRESS,
    });
  }
  return buildSTRKPayment({
    network: x402Network,
    amount: PREMIUM_PRICE_STRK,
    payTo: TREASURY_ADDRESS,
  });
}

/** Build the 402 response with x402-compliant headers. */
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

  // Encode the payment required header as base64
  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

  return new NextResponse(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      [HTTP_HEADERS.PAYMENT_REQUIRED]: encoded,
    },
  });
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

/** Verify x402 payment and return premium analysis. */
async function handlePaidRequest(paymentHeader: string, userInput: string) {
  const payload: PaymentPayload = decodePaymentSignature(paymentHeader);
  const requirements = getPaymentRequirements();
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  const verification = await verifyPayment(provider, payload, requirements);
  if (!verification.isValid) {
    return NextResponse.json(
      { error: "Payment verification failed", reason: verification.invalidReason, details: verification.details },
      { status: 402 },
    );
  }

  const settlement = await settlePayment(provider, payload, requirements);
  if (!settlement.success) {
    return NextResponse.json(
      { error: "Payment settlement failed", reason: settlement.errorReason },
      { status: 402 },
    );
  }

  const analysis = await generatePremiumAnalysis(userInput);
  return NextResponse.json({
    ...analysis,
    payment: {
      settled: true,
      transaction: settlement.transaction,
      payer: verification.payer,
      amount: x402Network === "starknet:mainnet" ? `$${PREMIUM_PRICE_USDC} USDC` : `${PREMIUM_PRICE_STRK} STRK`,
    },
  });
}

export async function GET(request: NextRequest) {
  const paymentHeader = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);

  if (!paymentHeader) {
    return build402Response(getPaymentRequirements());
  }

  try {
    const userInput = request.nextUrl.searchParams.get("input") ?? "";
    return await handlePaidRequest(paymentHeader, userInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[premium-strategy] Error:", msg);
    return NextResponse.json({ error: "Premium strategy error", details: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const paymentHeader = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);

  if (!paymentHeader) {
    return build402Response(getPaymentRequirements());
  }

  try {
    const body = await request.json().catch(() => ({}));
    return await handlePaidRequest(paymentHeader, body.input ?? "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[premium-strategy] Error:", msg);
    return NextResponse.json({ error: "Premium strategy error", details: msg }, { status: 500 });
  }
}
