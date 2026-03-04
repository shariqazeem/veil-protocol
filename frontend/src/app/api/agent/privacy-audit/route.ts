/**
 * Privacy Audit API — x402-gated deep per-deposit analysis.
 *
 * GET  → returns 402 with payment requirements
 * POST → accepts { deposits, payment_tx } — verifies on-chain STRK transfer,
 *        then returns per-deposit privacy scores, threat detection, and
 *        withdrawal recommendations.
 *
 * Cost: 0.005 STRK per audit
 */

import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, Contract, num, type Abi } from "starknet";
import {
  buildSTRKPayment,
  STRK_ADDRESSES,
  type PaymentRequirements,
} from "x402-starknet";
import { POOL_ADDRESS, RPC_URL, NETWORK, TREASURY_ADDRESS } from "../../relayer/shared";
import {
  calculateDepositPrivacy,
  calculatePoolHealth,
  getWithdrawalRecommendation,
  detectPrivacyThreats,
  type PoolPrivacyState,
  type DepositInfo,
} from "@/utils/privacyScore";

const x402Network = NETWORK === "mainnet" ? "starknet:mainnet" as const : "starknet:sepolia" as const;
const AUDIT_PRICE_STRK = Number(process.env.AUDIT_PRICE_STRK ?? 0.005);

const POOL_ABI: Abi = [
  { type: "function", name: "get_pending_usdc", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_batch_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

const norm = (a: string) => {
  try { return num.toHex(num.toBigInt(a)).toLowerCase(); }
  catch { return a.toLowerCase(); }
};

function getExpectedFeeAtomic(): bigint {
  return BigInt(Math.round(AUDIT_PRICE_STRK * 1e18));
}

function getStrkToken(): string {
  return STRK_ADDRESSES[x402Network] ?? "";
}

function getPaymentRequirements(): PaymentRequirements {
  return buildSTRKPayment({
    network: x402Network,
    amount: AUDIT_PRICE_STRK,
    payTo: TREASURY_ADDRESS,
  });
}

function build402Response(requirements: PaymentRequirements): NextResponse {
  return NextResponse.json({
    x402Version: 2,
    error: "Payment required for privacy audit",
    resource: {
      url: "/api/agent/privacy-audit",
      description: "Deep per-deposit privacy analysis with threat detection and withdrawal recommendations",
      mimeType: "application/json",
    },
    accepts: [requirements],
  }, { status: 402 });
}

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
        from = keys[1];
        to = keys[2];
        amountLow = BigInt(data[0] ?? "0");
        amountHigh = BigInt(data[1] ?? "0");
      } else {
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
    return { valid: false, error: `Tx verification failed: ${msg}` };
  }
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

export async function GET() {
  return build402Response(getPaymentRequirements());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { deposits, payment_tx } = body as {
      deposits?: DepositInfo[];
      payment_tx?: string;
    };

    if (!payment_tx) {
      return build402Response(getPaymentRequirements());
    }

    // Verify on-chain STRK transfer
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const verification = await verifyMicropayment(provider, payment_tx);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error ?? "Payment verification failed" },
        { status: 402 },
      );
    }

    // Payment verified — run deep privacy audit
    const poolState = await fetchPoolState();
    const poolHealth = calculatePoolHealth(poolState);

    // Score each user deposit
    const userDeposits = deposits ?? [];
    const depositScores = userDeposits
      .filter((d) => !d.claimed)
      .map((d) => ({
        tier: d.tier,
        leafIndex: d.leafIndex,
        score: calculateDepositPrivacy(d, poolState),
        recommendation: getWithdrawalRecommendation(d, poolState),
      }));

    // Detect threats
    const threats = detectPrivacyThreats(userDeposits, poolState);

    // Overall summary
    const avgScore = depositScores.length > 0
      ? Math.round(depositScores.reduce((s, d) => s + d.score.overall, 0) / depositScores.length)
      : 0;
    const readyCount = depositScores.filter((d) => d.score.withdrawalReady).length;

    return NextResponse.json({
      premium: true,
      timestamp: Date.now(),
      summary: {
        totalDeposits: depositScores.length,
        averagePrivacyScore: avgScore,
        readyToWithdraw: readyCount,
        threatCount: threats.length,
        criticalThreats: threats.filter((t) => t.severity === "critical").length,
      },
      pool: poolState,
      poolHealth,
      deposits: depositScores,
      threats,
      payment: {
        settled: true,
        transaction: payment_tx,
        payer: verification.payer,
        amount: `${AUDIT_PRICE_STRK} STRK`,
        method: "direct_transfer",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[privacy-audit] Error:", msg);
    return NextResponse.json({ error: "Privacy audit error", details: msg }, { status: 500 });
  }
}
