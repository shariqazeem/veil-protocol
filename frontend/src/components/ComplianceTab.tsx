"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { ShieldCheck, FileText, Bitcoin, Download, Loader } from "lucide-react";
import { motion } from "framer-motion";
import { type NoteWithStatus, checkAllNoteStatuses } from "@/utils/notesManager";
import { computeNullifier, buildMerkleProof } from "@/utils/privacy";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { RPC_URL, isMainnet } from "@/utils/network";
import { CallData, RpcProvider, Contract, type Abi, num, hash } from "starknet";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

function truncateHash(h: string, chars = 6): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

export default function ComplianceTab() {
  const { address, isConnected } = useAccount();
  const { sendAsync } = useSendTransaction({ calls: [] });

  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poolAddress = addresses.contracts.shieldedPool;

  const refreshNotes = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await checkAllNoteStatuses(address ?? undefined);
      setNotes(statuses);
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  async function handleRegisterViewKey(note: NoteWithStatus) {
    if (!isConnected || !address || !poolAddress) return;

    setRegistering(note.commitment);
    setRegisterSuccess(null);
    setError(null);

    try {
      // Generate a view key hash from the secret + a deterministic salt
      const viewKeyHash = hash.computePedersenHash(note.secret, "0x564945574b4559"); // "VIEWKEY" in hex

      const calls = [
        {
          contractAddress: poolAddress,
          entrypoint: "register_view_key",
          calldata: CallData.compile({
            commitment: note.commitment,
            view_key_hash: viewKeyHash,
          }),
        },
      ];

      await sendAsync(calls);
      setRegisterSuccess(note.commitment);
    } catch (e) {
      setError(`View key registration failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setRegistering(null);
  }

  async function exportProof(note: NoteWithStatus) {
    try {
      const rpc = new RpcProvider({
        nodeUrl: RPC_URL,
      });
      const pool = new Contract({
        abi: SHIELDED_POOL_ABI as unknown as Abi,
        address: poolAddress,
        providerOrAccount: rpc,
      });

      const onChainLeafCount = Number(await pool.call("get_leaf_count", []));
      const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
        pool.call("get_leaf", [i]).then((leaf) => num.toHex(leaf as bigint))
      );
      const allCommitments = await Promise.all(leafPromises);

      let leafIndex = note.leafIndex ?? 0;

      // Validate leaf index matches on-chain commitment
      if (leafIndex >= allCommitments.length || allCommitments[leafIndex] !== note.commitment) {
        const found = allCommitments.indexOf(note.commitment);
        if (found === -1) {
          throw new Error("Commitment not found on-chain");
        }
        leafIndex = found;
      }

      const { path: merklePath, indices: pathIndices } = buildMerkleProof(
        leafIndex,
        allCommitments,
      );

      const nullifier = computeNullifier(note.secret);

      const proof = {
        protocol: "Veil Protocol",
        version: "1.0",
        network: isMainnet ? "starknet-mainnet" : "starknet-sepolia",
        contract: poolAddress,
        commitment: note.commitment,
        denomination: note.denomination,
        amount: `${Number(note.amount) / 1_000_000} USDC`,
        batchId: note.batchId,
        leafIndex: note.leafIndex,
        nullifier,
        merklePath,
        pathIndices,
        hasBtcIdentity: note.hasBtcIdentity ?? false,
        timestamp: note.timestamp,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veil-proof-${note.commitment.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Proof export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Compliance Portal
          </span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Voluntarily prove your transaction history to regulators without compromising other users&apos; privacy.
          Register a view key against your commitment, or export a cryptographic proof of your deposit.
        </p>
      </div>

      {/* View Key Explainer */}
      <div className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText size={12} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            How View Keys Work
          </span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          A view key hash is registered on-chain against your commitment. You can share the view key
          with a regulator, who can then verify it matches the on-chain hash — proving you made that specific
          deposit. Other users&apos; deposits remain completely private.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 flex items-center justify-between">
          <span className="text-xs text-[var(--accent-red)]">{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--accent-red)]/60 hover:text-[var(--accent-red)] text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-10">
          <Loader size={20} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--text-quaternary)] mt-3">Loading notes...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-10">
          <ShieldCheck size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">No deposits found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Make a deposit first, then register view keys here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <motion.div
              key={note.commitment}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3"
            >
              {/* Note Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
                  {truncateHash(note.commitment)}
                </span>
                <div className="flex items-center gap-1.5">
                  {note.hasBtcIdentity && (
                    <span className="flex items-center gap-1 text-xs bg-[var(--accent-orange-dim)] text-[var(--accent-orange)] px-2 py-0.5 rounded-full font-medium border border-[var(--accent-orange)]/20">
                      <Bitcoin size={10} strokeWidth={1.5} />
                      BTC
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    note.claimed
                      ? "bg-[var(--bg-elevated)] text-[var(--text-tertiary)]"
                      : "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]"
                  }`}>
                    {note.claimed ? "Claimed" : "Active"}
                  </span>
                </div>
              </div>

              {/* Note Info */}
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-[var(--text-tertiary)]">Amount</span>
                  <div className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                    {(Number(note.amount) / 1_000_000).toLocaleString()} USDC
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-tertiary)]">Batch</span>
                  <div className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                    #{note.batchId}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-tertiary)]">Date</span>
                  <div className="text-[12px] text-[var(--text-primary)]">
                    {new Date(note.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => handleRegisterViewKey(note)}
                  disabled={registering === note.commitment}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)]/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.98 }}
                >
                  {registering === note.commitment ? (
                    <Loader size={11} className="animate-spin" strokeWidth={1.5} />
                  ) : (
                    <ShieldCheck size={11} strokeWidth={1.5} />
                  )}
                  {registerSuccess === note.commitment ? "Registered" : "Register View Key"}
                </motion.button>
                <motion.button
                  onClick={() => exportProof(note)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-orange)]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.98 }}
                >
                  <Download size={11} strokeWidth={1.5} />
                  Export Proof
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-[var(--text-quaternary)] text-center">
          Connect Starknet wallet to manage compliance
        </p>
      )}
    </div>
  );
}
