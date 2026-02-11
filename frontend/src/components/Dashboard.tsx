"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { motion } from "framer-motion";
import { Activity, Shield, Layers, TrendingUp, Users, Clock, Bitcoin, Anchor, Fingerprint, Zap } from "lucide-react";
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
  const [anchorHistory, setAnchorHistory] = useState<ReturnType<typeof getAnchorHistory>>([]);

  useEffect(() => {
    setAnchorHistory(getAnchorHistory());
  }, [anchorTxid]);

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-950/30 border border-orange-800/30 text-[10px] font-medium text-[var(--accent-orange)]">
            <Zap size={10} strokeWidth={2} />
            Gasless Relayer Active
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

      {/* Privacy Features */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <Shield size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Privacy Stack
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: Fingerprint, label: "ZK Proofs", value: "Noir + Garaga", color: "text-emerald-400" },
            { icon: Zap, label: "Gasless", value: "Relayer (2%)", color: "text-[var(--accent-orange)]" },
            { icon: Clock, label: "Timing Guard", value: "60s cooldown", color: "text-[var(--text-secondary)]" },
            { icon: Layers, label: "Merkle Tree", value: "20-level", color: "text-[var(--text-secondary)]" },
            { icon: Users, label: "Anon Sets", value: "3 tiers", color: "text-[var(--text-secondary)]" },
            { icon: Bitcoin, label: "BTC Binding", value: `${btcLinked} linked`, color: "text-[var(--accent-orange)]" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-lg bg-[var(--bg-secondary)] px-3 py-2.5">
              <Icon size={12} strokeWidth={1.5} className={color} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</div>
                <div className={`text-[10px] font-[family-name:var(--font-geist-mono)] font-tabular ${color}`}>{value}</div>
              </div>
            </div>
          ))}
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

        {anchorHistory.length === 0 ? (
            <p className="text-[10px] text-[var(--text-quaternary)]">
              {bitcoinAddress ? "No attestations yet. Sign to anchor the Merkle root." : "Connect Bitcoin wallet to sign Merkle root attestations."}
            </p>
        ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-tertiary)]">Last attested</span>
                <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
                  {new Date(anchorHistory[0].timestamp).toLocaleDateString()}
                </span>
              </div>
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-orange)]">
                {anchorHistory[0].signature.slice(0, 12)}...
              </span>
            </div>
        )}
      </div>
    </div>
  );
}
