"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, ChevronDown, ChevronUp, Shield, Unlock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type NoteWithStatus, checkAllNoteStatuses } from "@/utils/notesManager";

const SEPOLIA_EXPLORER = "https://sepolia.voyager.online/tx/";

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
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 px-1 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer rounded-lg"
      >
        {/* Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isClaimed
            ? "bg-emerald-900/20"
            : "bg-[var(--accent-orange)]/10"
        }`}>
          {isClaimed ? (
            <Unlock size={14} strokeWidth={1.5} className="text-emerald-400" />
          ) : (
            <Shield size={14} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="text-[13px] font-medium text-[var(--text-primary)]">
            {isClaimed ? "Unveiled" : "Shielded"}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            Batch #{note.batchId} &middot; {formatTimestamp(note.timestamp)}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
            {isClaimed ? (
              <span className="flex items-center gap-1">
                <ArrowUpRight size={12} strokeWidth={1.5} className="text-emerald-400" />
                {wbtcAmount ? `${wbtcAmount.toFixed(6)} BTC` : `${usdcAmount.toLocaleString()} USDC`}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ArrowDownLeft size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                {usdcAmount.toLocaleString()} USDC
              </span>
            )}
          </div>
          <div className={`text-[10px] font-medium ${
            note.status === "READY"
              ? "text-emerald-400"
              : note.status === "PENDING"
                ? "text-amber-400"
                : "text-[var(--text-tertiary)]"
          }`}>
            {note.status === "READY" ? "Ready" : note.status === "PENDING" ? "Pending" : "Complete"}
          </div>
        </div>

        {/* Expand */}
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--text-tertiary)]">Commitment:</span>
                <code className="font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] text-[10px]">
                  {truncateHash(note.commitment, 10)}
                </code>
              </div>
              {note.zkCommitment && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)]">ZK Commitment:</span>
                  <code className="font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)] text-[10px]">
                    {truncateHash(note.zkCommitment, 10)}
                  </code>
                </div>
              )}
              {note.hasBtcIdentity && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)]">BTC Identity:</span>
                  <span className="text-[var(--accent-orange)] font-medium">Linked</span>
                </div>
              )}
              {wbtcAmount && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)]">WBTC Received:</span>
                  <span className="font-[family-name:var(--font-geist-mono)] text-emerald-400 font-medium">
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
      // Sort by timestamp descending (newest first)
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
    <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Transaction History
        </span>
        <span className="text-[10px] text-[var(--text-quaternary)]">
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
