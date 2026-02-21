"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, ChevronDown, ChevronUp, Shield, Unlock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type NoteWithStatus, checkAllNoteStatuses } from "@/utils/notesManager";
import { EXPLORER_TX } from "@/utils/network";

const TX_EXPLORER = EXPLORER_TX;

const springDefault = { type: "spring" as const, stiffness: 300, damping: 24 };

function truncateHash(h: string, chars = 6): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HistoryEntry({ note }: { note: NoteWithStatus }) {
  const [expanded, setExpanded] = useState(false);
  const isClaimed = note.claimed || note.status === "CLAIMED";
  const usdcAmount = Number(note.amount) / 1_000_000;
  const wbtcAmount = note.wbtcShare ? Number(note.wbtcShare) / 1e8 : null;

  return (
    <motion.div
      layout
      className="border-b border-[var(--border-subtle)] last:border-0"
      whileHover={{ x: 2 }}
      transition={springDefault}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 px-1 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer rounded-lg"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isClaimed
            ? "bg-[var(--accent-emerald-dim)]"
            : "bg-[var(--accent-orange-dim)]"
        }`}>
          {isClaimed ? (
            <Unlock size={14} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
          ) : (
            <Shield size={14} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="text-[13px] font-medium text-[var(--text-primary)]">
            {isClaimed ? "Exited" : "Allocated"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            Batch #{note.batchId} &middot; {formatTimestamp(note.timestamp)}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-['JetBrains_Mono'] font-semibold text-[var(--text-primary)] font-tabular">
            {isClaimed ? (
              <span className="flex items-center gap-1">
                <ArrowUpRight size={12} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                {wbtcAmount ? `${wbtcAmount.toFixed(6)} BTC` : `${usdcAmount.toLocaleString()} USDC`}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ArrowDownLeft size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                {usdcAmount.toLocaleString()} USDC
              </span>
            )}
          </div>
          <div className={`text-xs font-medium ${
            note.status === "READY"
              ? "text-[var(--accent-emerald)]"
              : note.status === "PENDING"
                ? "text-[var(--accent-amber)]"
                : "text-[var(--text-tertiary)]"
          }`}>
            {note.status === "READY" ? "Ready" : note.status === "PENDING" ? "Pending" : "Complete"}
          </div>
        </div>

        <div className="flex-shrink-0 text-[var(--text-tertiary)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: springDefault, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-tertiary)]">Commitment:</span>
                <code className="font-['JetBrains_Mono'] text-[var(--text-secondary)] text-xs">
                  {truncateHash(note.commitment, 10)}
                </code>
              </div>
              {note.zkCommitment && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--text-tertiary)]">ZK Commitment:</span>
                  <code className="font-['JetBrains_Mono'] text-[var(--text-secondary)] text-xs">
                    {truncateHash(note.zkCommitment, 10)}
                  </code>
                </div>
              )}
              {note.hasBtcIdentity && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--text-tertiary)]">BTC Identity:</span>
                  <span className="text-[var(--accent-orange)] font-medium">Linked</span>
                </div>
              )}
              {wbtcAmount && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--text-tertiary)]">WBTC Received:</span>
                  <span className="font-['JetBrains_Mono'] text-[var(--accent-emerald)] font-medium">
                    {wbtcAmount.toFixed(8)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TransactionHistory() {
  const { address } = useAccount();
  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await checkAllNoteStatuses(address ?? undefined);
      all.sort((a, b) => b.timestamp - a.timestamp);
      setNotes(all);
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!address) return null;
  if (loading && notes.length === 0) return null;
  if (notes.length === 0) return null;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-3xl border-2 border-[var(--border-subtle)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Capital Activity
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">
          {notes.length} {notes.length === 1 ? "transaction" : "transactions"}
        </span>
      </div>
      <div className="px-4 py-1">
        {notes.map((note) => (
          <HistoryEntry key={note.commitment} note={note} />
        ))}
      </div>
    </div>
  );
}
