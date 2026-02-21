"use client";

import { useState, useEffect, useRef } from "react";
import { useReadContract } from "@starknet-react/core";
import { motion, useMotionValue, animate } from "framer-motion";
import { Play, Loader2, Check, ExternalLink, Zap, Lock, Bitcoin, ArrowRightLeft } from "lucide-react";
import PrivacyScore from "./PrivacyScore";
import { SkeletonLine } from "./Skeleton";
import { useToast } from "@/context/ToastContext";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { EXPLORER_TX, RPC_URL } from "@/utils/network";
import { RpcProvider, Contract, type Abi } from "starknet";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";

function AnimatedCounter({ value, decimals = 0, duration = 1.5 }: { value: number; decimals?: number; duration?: number }) {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  const prevRef = useRef(0);

  useEffect(() => {
    prevRef.current = value;
    const controls = animate(motionVal, value, {
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (v) => setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()),
    });
    return () => controls.stop();
  }, [value, duration, decimals, motionVal]);

  return <>{display}</>;
}

/** Animated shield visualization — the "hero moment" for the dashboard */
function PrivacyOrb({ score, leaves }: { score: number; leaves: number }) {
  const color = score >= 60 ? "52,211,153" : score >= 30 ? "245,158,11" : "255,90,0";

  return (
    <div className="relative w-28 h-28 mx-auto flex-shrink-0">
      {/* Outer ring — slow rotate */}
      <div
        className="absolute inset-0 rounded-full animate-spin-slow"
        style={{
          background: `conic-gradient(from 0deg, rgba(${color},0.3), transparent 40%, rgba(${color},0.15) 60%, transparent 80%, rgba(${color},0.3))`,
        }}
      />
      {/* Middle ring — counter-rotate */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          animation: "spin-slow 12s linear infinite reverse",
          background: `conic-gradient(from 180deg, rgba(${color},0.2), transparent 30%, rgba(${color},0.1) 50%, transparent 70%, rgba(${color},0.2))`,
        }}
      />
      {/* Inner orb */}
      <div
        className="absolute inset-4 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 40% 35%, rgba(${color},0.25) 0%, rgba(${color},0.08) 60%, transparent 100%)`,
          border: `1px solid rgba(${color},0.25)`,
          boxShadow: `0 0 40px rgba(${color},0.15), inset 0 0 20px rgba(${color},0.05)`,
        }}
      >
        <div className="text-center">
          <Lock size={16} strokeWidth={1.5} style={{ color: `rgba(${color},0.8)` }} className="mx-auto mb-0.5" />
          <span className="text-[10px] font-medium block" style={{ color: `rgba(${color},0.7)` }}>
            {leaves > 0 ? `${leaves} shielded` : "Ready"}
          </span>
        </div>
      </div>
      {/* Floating particles */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: `rgba(${color},0.6)`,
            top: `${20 + i * 25}%`,
            left: `${10 + i * 30}%`,
            animation: `float ${2.5 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

interface IntentData {
  id: number;
  amount: string;
  status: string;
  timestamp: number;
}

const STATUS_MAP: Record<number, string> = { 0: "CREATED", 1: "CLAIMED", 2: "SETTLED", 3: "EXPIRED" };
const STATUS_COLORS: Record<string, string> = {
  CREATED: "var(--accent-orange)",
  CLAIMED: "var(--accent-amber)",
  SETTLED: "var(--accent-emerald)",
  EXPIRED: "var(--text-tertiary)",
};

function IntentExplorer({ poolAddress }: { poolAddress: string }) {
  const [intents, setIntents] = useState<IntentData[]>([]);
  const [intentCount, setIntentCount] = useState(0);

  useEffect(() => {
    if (!poolAddress) return;
    async function fetchIntents() {
      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: provider });
        const count = Number(await pool.call("get_intent_count", []));
        setIntentCount(count);
        if (count === 0) return;
        const start = Math.max(0, count - 5);
        const fetched: IntentData[] = [];
        for (let i = count - 1; i >= start; i--) {
          try {
            const intent = await pool.call("get_intent", [i]) as any;
            fetched.push({
              id: i,
              amount: (Number(intent.amount || intent[0] || 0) / 1e8).toFixed(6),
              status: STATUS_MAP[Number(intent.status ?? intent[4] ?? 0)] || "UNKNOWN",
              timestamp: Number(intent.timestamp || intent[3] || 0),
            });
          } catch { break; }
        }
        setIntents(fetched);
      } catch { /* no intents available */ }
    }
    fetchIntents();
    const interval = setInterval(fetchIntents, 15_000);
    return () => clearInterval(interval);
  }, [poolAddress]);

  if (intentCount === 0) return null;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bitcoin size={14} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Bitcoin Intent Settlement</span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-orange-dim)] text-[var(--accent-orange)] font-semibold">
          {intentCount} intent{intentCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {intents.map((intent) => {
          const color = STATUS_COLORS[intent.status] || "var(--text-tertiary)";
          return (
            <motion.div
              key={intent.id}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <ArrowRightLeft size={12} strokeWidth={1.5} style={{ color }} />
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Intent #{intent.id}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-2">
                    {intent.amount} WBTC
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {intent.status === "CREATED" || intent.status === "CLAIMED" ? (
                  <Loader2 size={10} className="animate-spin" style={{ color }} strokeWidth={2} />
                ) : (
                  <Check size={10} style={{ color }} strokeWidth={2} />
                )}
                <span className="text-[11px] font-semibold" style={{ color }}>
                  {intent.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const poolAddress = addresses.contracts.shieldedPool as `0x${string}` | "";

  const { data: pendingUsdc } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_pending_usdc",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: batchCount } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_batch_count",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalVolume } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_total_volume",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: totalBatches } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_total_batches_executed",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: leafCount } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_leaf_count",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet0 } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_anonymity_set",
    args: [0], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet1 } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_anonymity_set",
    args: [1], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet2 } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_anonymity_set",
    args: [2], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: anonSet3 } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_anonymity_set",
    args: [3], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const safe = (v: unknown, div = 1) => { const n = Number(v); return Number.isFinite(n) ? n / div : 0; };
  const pending = safe(pendingUsdc, 1_000_000);
  const deposits = safe(batchCount);
  const dataLoaded = totalVolume !== undefined;

  const volume = safe(totalVolume, 1_000_000);
  const batches = safe(totalBatches);
  const leaves = safe(leafCount);
  const anon0 = safe(anonSet0);
  const anon1 = safe(anonSet1);
  const anon2 = safe(anonSet2);
  const anon3 = safe(anonSet3);

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

  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleExecuteBatch() {
    setBatchExecuting(true);
    setBatchTxHash(null);
    try {
      const res = await fetch(`${RELAYER_URL}/execute-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setBatchTxHash(data.txHash);
        toast("success", "Batch executed — capital converted to BTC");
      } else {
        toast("error", data.error ?? "Batch execution failed");
      }
    } catch {
      toast("error", "Failed to connect to relayer");
    }
    setBatchExecuting(false);
  }

  const { data: btcLinkedCount } = useReadContract({
    address: poolAddress || undefined, abi: SHIELDED_POOL_ABI, functionName: "get_btc_linked_count",
    args: [], enabled: !!poolAddress, refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);
  const btcLinked = safe(btcLinkedCount);

  const stats = [
    { label: "Batches", value: batches },
    { label: "Commitments", value: leaves },
    { label: "Queued", value: deposits },
    { label: "BTC IDs", value: btcLinked },
  ];

  const privacyScoreValue = (() => {
    const anonPts = Math.min(Math.max(anon0, anon1, anon2, anon3) / 20, 1) * 40;
    const batchPts = Math.min(batches / 10, 1) * 20;
    const btcPts = Math.min(btcLinked / 5, 1) * 15;
    const usagePts = Math.min(leaves / 20, 1) * 15 + (leaves > 0 ? 10 : 0);
    return Math.min(Math.round(anonPts + batchPts + btcPts + usagePts), 100);
  })();

  return (
    <div className="space-y-4">
      {/* Hero — Privacy Orb + Key Metrics */}
      <div className="card-glow p-5 sm:p-6">
        <div className="flex items-center gap-5 sm:gap-8">
          {/* Privacy Orb */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <PrivacyOrb score={privacyScoreValue} leaves={leaves} />
          </motion.div>

          {/* Metrics */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <span className="text-[11px] text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Total Shielded</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  {dataLoaded ? (
                    <motion.span
                      className="text-xl sm:text-2xl font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular tracking-tight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      $<AnimatedCounter value={volume} />
                    </motion.span>
                  ) : (
                    <SkeletonLine width="80px" height="24px" />
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-tertiary)] font-medium uppercase tracking-wider">Pending</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  {dataLoaded ? (
                    <motion.span
                      className="text-xl sm:text-2xl font-[family-name:var(--font-geist-mono)] font-bold text-violet-600 font-tabular tracking-tight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    >
                      $<AnimatedCounter value={pending} />
                    </motion.span>
                  ) : (
                    <SkeletonLine width="80px" height="24px" />
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-[var(--border-subtle)]">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--text-quaternary)]">{label}</span>
                  <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-secondary)] font-tabular">
                    <AnimatedCounter value={value} duration={1} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Execute Batch */}
      {pending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-2xl bg-violet-50 border border-violet-200/50"
        >
          <div>
            <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Zap size={11} strokeWidth={2} className="text-violet-500" />
              {pending.toLocaleString()} USDC ready for conversion
            </span>
          </div>
          <motion.button
            onClick={handleExecuteBatch}
            disabled={batchExecuting || proverStatus !== "online"}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold
                       disabled:opacity-30 disabled:cursor-not-allowed
                       cursor-pointer flex items-center gap-1.5 flex-shrink-0"
            whileTap={!batchExecuting ? { scale: 0.97 } : {}}
          >
            {batchExecuting ? (
              <Loader2 size={11} className="animate-spin" strokeWidth={2} />
            ) : (
              <Play size={11} strokeWidth={2} />
            )}
            {batchExecuting ? "Executing..." : "Convert"}
          </motion.button>
        </motion.div>
      )}
      {batchTxHash && (
        <a
          href={`${EXPLORER_TX}${batchTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[var(--accent-emerald)] hover:underline font-[family-name:var(--font-geist-mono)] px-1"
        >
          <Check size={10} strokeWidth={2} />
          Conversion confirmed
          <ExternalLink size={9} strokeWidth={1.5} className="opacity-60" />
        </a>
      )}

      {/* Active Bitcoin Intents */}
      <IntentExplorer poolAddress={poolAddress} />

      {/* Anonymity Sets + Privacy Score */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Anonymity Sets — minimal bars */}
          <div className="flex-1">
            <span className="text-xs text-[var(--text-tertiary)] font-medium">Anonymity Sets</span>
            <div className="mt-4 space-y-3">
              {[
                { label: "$1", count: anon0 },
                { label: "$10", count: anon1 },
                { label: "$100", count: anon2 },
                { label: "$1,000", count: anon3 },
              ].map(({ label, count }, i) => {
                const pct = Math.min(count / 20, 1) * 100;
                const color = count >= 10 ? "var(--accent-emerald)" : count >= 3 ? "var(--accent-amber)" : "var(--text-quaternary)";
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] font-tabular">
                        {label}
                      </span>
                      <span className="text-sm font-[family-name:var(--font-geist-mono)] font-bold font-tabular" style={{ color }}>
                        {count}
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 * i }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Privacy Score */}
          <div className="lg:w-52 flex-shrink-0">
            <PrivacyScore
              anonSet={Math.max(anon0, anon1, anon2, anon3)}
              batches={batches}
              btcLinked={btcLinked}
              commitments={leaves}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
