"use client";

import { useState } from "react";
import { useReadContract } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Clock, Bitcoin, Anchor } from "lucide-react";
import { anchorMerkleRoot, saveAnchor, getAnchorHistory } from "@/utils/bitcoin";
import PrivacyScore from "./PrivacyScore";
import { SkeletonLine } from "./Skeleton";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

function truncateHash(h: string, chars = 6): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

export default function Dashboard() {
  const { bitcoinAddress } = useWallet();
  const poolAddress = addresses.contracts.shieldedPool as `0x${string}` | "";

  const [anchoring, setAnchoring] = useState(false);
  const [anchorTxid, setAnchorTxid] = useState<string | null>(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const { data: pendingUsdc } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_pending_usdc",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: batchCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_batch_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalVolume } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_total_volume",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalBatches } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_total_batches_executed",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: leafCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_leaf_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: merkleRoot } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_merkle_root",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 30_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet0 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [0],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet1 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [1],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet2 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [2],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const safe = (v: unknown, div = 1) => { const n = Number(v); return Number.isFinite(n) ? n / div : 0; };
  const pending = safe(pendingUsdc, 1_000_000);
  const deposits = safe(batchCount);
  // Data still loading if the first query hasn't returned yet
  const dataLoaded = totalVolume !== undefined;

  const volume = safe(totalVolume, 1_000_000);
  const batches = safe(totalBatches);
  const leaves = safe(leafCount);
  const root = merkleRoot ? String(merkleRoot) : "0x0";
  const anon0 = safe(anonSet0);
  const anon1 = safe(anonSet1);
  const anon2 = safe(anonSet2);

  const { data: btcLinkedCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_btc_linked_count",
    args: [],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);
  const btcLinked = safe(btcLinkedCount);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[var(--text-primary)] leading-tight">
          Bitcoin&apos;s Privacy Layer
        </h1>
        <p className="text-[13px] sm:text-[15px] text-[var(--text-secondary)] font-medium">
          Gasless private execution on Starknet
        </p>
      </div>

      {/* Stats Grid */}
      <div className="glass-card p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {/* Total Volume */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Total Shielded
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <span className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight">
                  {volume.toLocaleString()}
                </span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-[11px] sm:text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>

          {/* Pending Pool */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                Pending Pool
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {dataLoaded ? (
                <span className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular tracking-tight">
                  {pending.toLocaleString()}
                </span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-[11px] sm:text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Layers size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium">Batches</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {batches}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Shield size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] sm:text-[11px] text-[var(--text-tertiary)] font-medium">Commitments</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {leaves}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Activity size={11} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] sm:text-[11px] text-[var(--text-tertiary)] font-medium">In Batch</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {deposits}
            </span>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Merkle Root & Protocol Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-tertiary)]">Merkle Root</span>
            <span className="text-[10px] sm:text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
              {truncateHash(root)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
            <span className="text-[11px] text-[var(--text-tertiary)]">Live on Sepolia</span>
          </div>
        </div>
      </div>

      {/* Anonymity Sets — Animated Bars */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <Users size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Anonymity Sets
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-quaternary)]">
            Target: 20+ deposits per tier
          </span>
        </div>
        <div className="space-y-4">
          {[
            { label: "100", unit: "USDC", count: anon0 },
            { label: "1K", unit: "USDC", count: anon1 },
            { label: "10K", unit: "USDC", count: anon2 },
          ].map(({ label, unit, count }) => {
            const pct = Math.min(count / 20, 1) * 100;
            const color = count >= 10 ? "#10B981" : count >= 3 ? "#F59E0B" : "#EF4444";
            const strength = count >= 20 ? "Maximum" : count >= 10 ? "Strong" : count >= 3 ? "Growing" : "Low";
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                      {label}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-bold font-tabular" style={{ color }}>
                      {count}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color }}>
                      {strength}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[var(--text-quaternary)] text-center mt-4">
          Your deposit is indistinguishable from others in the same tier. More deposits = stronger privacy.
        </p>
      </div>

      {/* Privacy Score */}
      <PrivacyScore
        anonSet={Math.max(anon0, anon1, anon2)}
        batches={batches}
        btcLinked={btcLinked}
        commitments={leaves}
      />

      {/* Privacy Features */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Shield size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Privacy Features
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Withdrawal Delay</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              60 seconds
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Gasless Withdrawals</span>
            </div>
            <span className="text-[12px] font-medium text-emerald-500">Relayer Supported</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Max Relayer Fee</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              5% cap
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">Merkle Tree</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] font-tabular">
              20-level (1M+ deposits)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bitcoin size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[12px] text-[var(--text-secondary)]">BTC-Linked Deposits</span>
            </div>
            <span className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-orange)] font-tabular">
              {btcLinked}
            </span>
          </div>
        </div>
      </div>

      {/* Bitcoin Attestation */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Anchor size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Bitcoin Attestation
            </span>
          </div>
          {bitcoinAddress && root !== "0x0" && (
            <motion.button
              onClick={async () => {
                setAnchoring(true);
                setAnchorError(null);
                setAnchorTxid(null);
                try {
                  const sig = await anchorMerkleRoot(bitcoinAddress, root);
                  setAnchorTxid(sig);
                  saveAnchor(root, sig);
                } catch (err) {
                  setAnchorError(err instanceof Error ? err.message : "Attestation failed");
                }
                setAnchoring(false);
              }}
              disabled={anchoring}
              className="text-[11px] font-medium text-[var(--accent-orange)] hover:text-white bg-orange-900/20 hover:bg-[var(--accent-orange)] px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {anchoring ? "Signing..." : "Sign Attestation"}
            </motion.button>
          )}
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
          Your Bitcoin wallet signs the current Merkle root, creating a verifiable cryptographic attestation that the privacy pool state existed at this moment.
        </p>

        {anchorTxid && (
          <div className="rounded-xl p-3 bg-emerald-900/20 border border-emerald-800/30 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mb-1">
              <span>Merkle root attested by Bitcoin wallet</span>
            </div>
            <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-400/70 break-all">
              sig: {anchorTxid.slice(0, 32)}...
            </div>
          </div>
        )}

        {anchorError && (
          <div className="rounded-xl p-3 bg-red-950/30 border border-red-900/30 mb-3">
            <span className="text-[11px] text-red-400">{anchorError}</span>
          </div>
        )}

        {(() => {
          const history = typeof window !== "undefined" ? getAnchorHistory() : [];
          if (history.length === 0) return (
            <p className="text-[10px] text-[var(--text-quaternary)]">
              {bitcoinAddress ? "No attestations yet. Sign to anchor the Merkle root." : "Connect Bitcoin wallet to sign Merkle root attestations."}
            </p>
          );
          const latest = history[0];
          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-tertiary)]">Last attested</span>
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
                  {new Date(latest.timestamp).toLocaleDateString()}
                </span>
              </div>
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-orange)]">
                {latest.signature.slice(0, 12)}...
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
