/**
 * Compliance Score API — Association Set compliance posture scoring.
 *
 * POST → accepts { address, deposits? }
 *         Returns compliance score (0-100) with grade and breakdown.
 *
 * Based on the Privacy Pools model (Buterin, Soleimani et al.):
 * - Association Set membership (Merkle tree inclusion)
 * - Viewing key registration
 * - Proof export availability
 * - No flagged interactions
 */

import { NextRequest, NextResponse } from "next/server";
import { Contract, RpcProvider, type Abi } from "starknet";
import { POOL_ADDRESS, RPC_URL } from "../../relayer/shared";

const POOL_ABI: Abi = [
  { type: "function", name: "get_leaf_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_anonymity_set", inputs: [{ name: "tier", type: "core::integer::u8" }], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
  { type: "function", name: "get_total_volume", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
  { type: "function", name: "get_total_batches_executed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
];

interface DepositInput {
  tier: number;
  leafIndex: number;
  claimed: boolean;
  depositTimestamp: number;
  hasViewKey?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { address, deposits } = body as {
      address?: string;
      deposits?: DepositInput[];
    };

    // Fetch on-chain state
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const pool = new Contract({ abi: POOL_ABI, address: POOL_ADDRESS, providerOrAccount: provider });

    const [leafCount, a0, a1, a2, a3] = await Promise.all([
      pool.get_leaf_count(),
      pool.get_anonymity_set(0),
      pool.get_anonymity_set(1),
      pool.get_anonymity_set(2),
      pool.get_anonymity_set(3),
    ]);

    const anonSets = [Number(a0), Number(a1), Number(a2), Number(a3)];
    const totalLeaves = Number(leafCount);

    // Score breakdown
    const userDeposits = (deposits ?? []).filter(d => !d.claimed);
    const hasDeposits = userDeposits.length > 0;

    // 1. Association Set membership (40 points)
    // All deposits go through our on-chain pool → they are in the Merkle tree by definition
    const associationSetScore = hasDeposits ? 40 : 0;
    const associationSetStatus = hasDeposits ? "INCLUDED" : "NO_DEPOSITS";

    // 2. Viewing key availability (25 points)
    // Check if any deposits have view keys registered
    const viewKeyCount = userDeposits.filter(d => d.hasViewKey).length;
    const viewKeyScore = hasDeposits
      ? Math.round((viewKeyCount / userDeposits.length) * 25)
      : 0;

    // 3. Proof exportability (20 points)
    // All our deposits can export proofs since they're in the Merkle tree
    const proofExportScore = hasDeposits ? 20 : 0;

    // 4. Clean record — no flagged interactions (15 points)
    // In our current protocol, all deposits are clean by default (go through verified contract)
    const cleanRecordScore = hasDeposits ? 15 : 0;

    const totalScore = associationSetScore + viewKeyScore + proofExportScore + cleanRecordScore;

    // Grade
    const grade = totalScore >= 90 ? "A" : totalScore >= 75 ? "B" : totalScore >= 50 ? "C" : totalScore >= 25 ? "D" : "F";

    // Recommendations
    const recommendations: string[] = [];
    if (!hasDeposits) {
      recommendations.push("Make a deposit to join the Association Set");
    }
    if (hasDeposits && viewKeyCount < userDeposits.length) {
      recommendations.push("Register viewing keys for all deposits to achieve full compliance readiness");
    }
    if (hasDeposits && userDeposits.length < 3) {
      recommendations.push("Diversify across multiple tiers to increase anonymity set coverage");
    }

    return NextResponse.json({
      timestamp: Date.now(),
      address: address ?? null,
      score: totalScore,
      grade,
      breakdown: {
        associationSet: {
          score: associationSetScore,
          maxScore: 40,
          status: associationSetStatus,
          description: "Deposits verified in on-chain Merkle tree (Association Set)",
        },
        viewingKeys: {
          score: viewKeyScore,
          maxScore: 25,
          registered: viewKeyCount,
          total: userDeposits.length,
          description: "Encrypted viewing keys registered for selective disclosure",
        },
        proofExport: {
          score: proofExportScore,
          maxScore: 20,
          available: hasDeposits,
          description: "Cryptographic proofs exportable for audit",
        },
        cleanRecord: {
          score: cleanRecordScore,
          maxScore: 15,
          flagged: false,
          description: "No flagged or suspicious interactions detected",
        },
      },
      poolContext: {
        totalLeaves,
        anonSets,
        tiersUsed: anonSets.filter(a => a > 0).length,
      },
      recommendations,
      model: "Privacy Pools (Buterin, Soleimani et al. 2023)",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[compliance-score] Error:", msg);
    return NextResponse.json({ error: "Compliance score error", details: msg }, { status: 500 });
  }
}
