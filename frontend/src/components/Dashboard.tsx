"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "@starknet-react/core";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Bitcoin, Fingerprint, Zap, ExternalLink } from "lucide-react";
import PrivacyScore from "./PrivacyScore";
import { SkeletonLine } from "./Skeleton";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

const STARKSCAN_BASE = "https://sepolia.starkscan.co/contract";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:3001";

function truncateHash(h: string, chars = 6): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

export default function Dashboard() {
  const poolAddress = addresses.contracts.shieldedPool as `0x${string}` | "";

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

  // Prover/relayer health check
  const [proverStatus, setProverStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    async function checkProver() {
      try {
        const res = await fetch(`${RELAYER_URL}/info`, { signal: AbortSignal.timeout(5000) });
        setProverStatus(res.ok ? "online" : "offline");
      } catch {
        setProverStatus("offline");
      }
    }
    checkProver();
    const interval = setInterval(checkProver, 30_000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="text-center space-y-3">
        <h1 className="text-[24px] sm:text-[32px] font-black tracking-tight text-[var(--text-primary)] leading-tight">
          Bitcoin&apos;s Privacy Layer
        </h1>
        <p className="text-[13px] sm:text-[15px] text-[var(--text-secondary)] font-medium">
          Gasless private execution on Starknet
        </p>
        {/* Protocol Status Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-800/30 text-[10px] font-medium text-emerald-400">
            <Fingerprint size={10} strokeWidth={2} />
            ZK Verified On-Chain
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium ${
            proverStatus === "online"
              ? "bg-orange-950/30 border border-orange-800/30 text-[var(--accent-orange)]"
              : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]"
          }`}>
            <Zap size={10} strokeWidth={2} />
            {proverStatus === "online" ? "Relayer Online" : proverStatus === "checking" ? "Checking Relayer..." : "Relayer Offline"}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse-dot" />
            Sepolia Live
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="glass-card p-4 sm:p-6 relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-[0.03] pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--accent-orange) 0%, transparent 70%)" }}
        />

        <div className="grid grid-cols-2 gap-4 sm:gap-6 relative">
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
                <motion.span
                  className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {volume.toLocaleString()}
                </motion.span>
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
                <motion.span
                  className="text-[22px] sm:text-[28px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular tracking-tight"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  {pending.toLocaleString()}
                </motion.span>
              ) : (
                <SkeletonLine width="80px" height="28px" />
              )}
              <span className="text-[11px] sm:text-[13px] text-[var(--text-tertiary)] font-medium">USDC</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-4 gap-3 relative">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Layers size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Batches</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {batches}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">Commits</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {leaves}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">In Batch</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
              {deposits}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bitcoin size={10} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
              <span className="text-[10px] text-[var(--text-tertiary)] font-medium">BTC IDs</span>
            </div>
            <span className="text-[16px] sm:text-[18px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular">
              {btcLinked}
            </span>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] my-5" />

        {/* Merkle Root & Protocol Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 relative">
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

        <div className="h-px bg-[var(--border-subtle)] my-4" />

        {/* Verified On-Chain Links */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${STARKSCAN_BASE}/${addresses.contracts.shieldedPool}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Shield size={10} strokeWidth={1.5} />
            Pool
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
          {(addresses.contracts as Record<string, string>).garagaVerifier && (
            <a
              href={`${STARKSCAN_BASE}/${(addresses.contracts as Record<string, string>).garagaVerifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/20 transition-colors text-[10px] font-medium text-emerald-400"
            >
              <Fingerprint size={10} strokeWidth={1.5} />
              ZK Verifier
              <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
            </a>
          )}
          <a
            href={`${STARKSCAN_BASE}/${addresses.contracts.usdc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            USDC
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
          <a
            href={`${STARKSCAN_BASE}/${addresses.contracts.wbtc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Bitcoin size={10} strokeWidth={1.5} />
            WBTC
            <ExternalLink size={8} strokeWidth={2} className="opacity-50" />
          </a>
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

      {/* ZK Proof Pipeline — the differentiator */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.02] pointer-events-none"
          style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
        />
        <div className="flex items-center gap-1.5 mb-4">
          <Fingerprint size={12} strokeWidth={1.5} className="text-emerald-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            ZK Proof Pipeline
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 mb-4">
          {[
            { label: "Noir Circuit", sub: "Poseidon BN254" },
            { label: "BB Prover", sub: "UltraHonk" },
            { label: "Garaga", sub: "On-chain verify" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-1 sm:gap-2 flex-1">
              <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-800/20 p-2 sm:p-2.5 text-center">
                <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400">{step.label}</div>
                <div className="text-[9px] text-emerald-400/50">{step.sub}</div>
              </div>
              {i < 2 && (
                <span className="text-[var(--text-quaternary)] text-[10px] flex-shrink-0">&rarr;</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
          Secrets never appear in calldata. The ZK proof (~2835 felt252 values) is verified by the Garaga UltraKeccakZKHonk verifier deployed on-chain.
        </p>
      </div>

    </div>
  );
}
