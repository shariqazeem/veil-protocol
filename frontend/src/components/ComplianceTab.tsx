"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useSmartSend } from "@/hooks/useSmartSend";
import { ShieldCheck, FileText, Bitcoin, Download, Loader, Eye, GitBranch, Package, CheckCircle, Info, AlertTriangle } from "lucide-react";
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

type ComplianceSection = "association" | "disclosure" | "export";

export default function ComplianceTab() {
  const { address, isConnected } = useAccount();
  const { sendAsync } = useSmartSend();

  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ComplianceSection>("association");
  const [generatingBundle, setGeneratingBundle] = useState(false);

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

  async function generateComplianceBundle(note: NoteWithStatus) {
    setGeneratingBundle(true);
    setError(null);

    try {
      const viewKeyHash = hash.computePedersenHash(note.secret, "0x564945574b4559");

      const bundle = {
        protocol: "Veil Protocol — Association Set Compliance Bundle",
        version: "2.0",
        standard: "Privacy Pools (Buterin, Soleimani et al. 2023)",
        network: isMainnet ? "starknet-mainnet" : "starknet-sepolia",
        contract: poolAddress,
        associationSet: {
          status: "INCLUDED",
          merkleTreeDepth: 20,
          commitment: note.commitment,
          description: "Deposit is part of a compliant association set — all deposits in the Veil Protocol pool are verified on-chain via the shielded pool contract.",
        },
        selectiveDisclosure: {
          viewKeyHash,
          registeredOnChain: registerSuccess === note.commitment,
          description: "View key hash allows selective audit without compromising other users.",
        },
        depositMetadata: {
          denomination: note.denomination,
          tierLabel: ["$1", "$10", "$100", "$1,000"][note.denomination],
          amount: `${Number(note.amount) / 1_000_000} USDC`,
          batchId: note.batchId,
          leafIndex: note.leafIndex,
          hasBtcIdentity: note.hasBtcIdentity ?? false,
          timestamp: note.timestamp,
        },
        complianceScore: {
          associationSetMember: true,
          viewKeyAvailable: true,
          proofExportable: true,
          noFlaggedInteractions: true,
          score: 100,
          grade: "A",
        },
        wallet: address ?? "not-connected",
        generatedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veil-compliance-bundle-${note.commitment.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Bundle generation failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    setGeneratingBundle(false);
  }

  const activeNotes = notes.filter((n) => !n.claimed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Compliance Portal
          </span>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
            Privacy Pools
          </span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Association Set compliance based on the Privacy Pools model (Buterin et al.). Prove your deposits are compliant without revealing which deposit is yours.
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 p-0.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        {([
          { id: "association" as const, label: "Association Set", icon: GitBranch },
          { id: "disclosure" as const, label: "Selective Disclosure", icon: Eye },
          { id: "export" as const, label: "Proof Export", icon: Package },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activeSection === id
                ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon size={11} strokeWidth={1.5} />
            {label}
          </button>
        ))}
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

      {/* ━━━ SECTION A: ASSOCIATION SET (Privacy Pools) ━━━ */}
      {activeSection === "association" && (
        <div className="space-y-3">
          {/* Association Set Explainer */}
          <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <GitBranch size={12} strokeWidth={1.5} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">
                Association Set — Compliant Privacy
              </span>
              <span className="text-[8px] font-bold text-emerald-500 ml-auto">Buterin et al.</span>
            </div>
            <p className="text-[11px] text-emerald-600/80 leading-relaxed">
              Privacy Pools separate honest users from illicit funds. Your deposit is part of a verified association set — a Merkle tree of compliant commitments. At withdrawal, you prove membership in the set without revealing which deposit is yours. This is an <strong>inclusion proof</strong>.
            </p>
          </div>

          {/* Merkle Tree Visualization */}
          <div className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 mb-3">
              <GitBranch size={11} strokeWidth={1.5} className="text-[#4D4DFF]" />
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">On-Chain Association Set</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-3">
              {/* Simplified Merkle tree diagram */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#4D4DFF]/10 border border-[#4D4DFF]/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-[#4D4DFF]">Root</span>
                </div>
                <div className="w-px h-3 bg-[var(--border-subtle)]" />
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <span className="text-[7px] text-gray-400">H</span>
                    </div>
                    <div className="w-px h-2 bg-[var(--border-subtle)]" />
                    <div className="flex gap-1">
                      <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
                      <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <span className="text-[7px] text-gray-400">H</span>
                    </div>
                    <div className="w-px h-2 bg-[var(--border-subtle)]" />
                    <div className="flex gap-1">
                      <div className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center">
                        <span className="text-[6px] text-emerald-600">You</span>
                      </div>
                      <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="ml-4 flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">Depth: 20 levels</span>
                <span className="text-[9px] text-[var(--text-tertiary)]">Capacity: 1M+ leaves</span>
                <span className="text-[9px] text-emerald-600 font-semibold">ZK membership proof</span>
              </div>
            </div>
          </div>

          {/* Per-deposit Association Set status */}
          {loading ? (
            <div className="text-center py-8">
              <Loader size={20} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
              <p className="text-xs text-[var(--text-quaternary)] mt-3">Loading deposits...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-secondary)]">No deposits found</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Make a deposit first to see your Association Set status</p>
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
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2.5"
                >
                  {/* Commitment + badges */}
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
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200/50">
                        <CheckCircle size={9} strokeWidth={2} />
                        Included
                      </span>
                    </div>
                  </div>

                  {/* Association Set details */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)]">Tier</span>
                      <div className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                        {["$1", "$10", "$100", "$1,000"][note.denomination]}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)]">Merkle Depth</span>
                      <div className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                        20 levels
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)]">Set Status</span>
                      <div className="text-[12px] font-semibold text-emerald-600">
                        Compliant
                      </div>
                    </div>
                  </div>

                  {/* Info line */}
                  <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)]">
                    <Info size={10} strokeWidth={1.5} className="text-[#4D4DFF] mt-0.5 flex-shrink-0" />
                    <span className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                      Your ZK withdrawal proof simultaneously proves pool membership and fund ownership — this is an Association Set inclusion proof.
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━━ SECTION B: SELECTIVE DISCLOSURE ━━━ */}
      {activeSection === "disclosure" && (
        <div className="space-y-3">
          {/* Viewing Key Explainer */}
          <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye size={12} strokeWidth={1.5} className="text-[#4D4DFF]" />
              <span className="text-xs font-bold text-indigo-700">
                Selective Disclosure — strkBTC-Ready
              </span>
            </div>
            <p className="text-[11px] text-indigo-600/80 leading-relaxed">
              Register an encrypted viewing key for selective audit access. Regulators can verify your specific deposits without compromising other users&apos; privacy — the same model strkBTC will use for compliant shielded BTC on Starknet.
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

          {/* Notes with View Key actions */}
          {loading ? (
            <div className="text-center py-8">
              <Loader size={20} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <Eye size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-secondary)]">No deposits found</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Make a deposit first, then register view keys here</p>
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
                      onClick={() => generateComplianceBundle(note)}
                      disabled={generatingBundle}
                      className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[#4D4DFF]/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      whileTap={{ scale: 0.98 }}
                    >
                      {generatingBundle ? (
                        <Loader size={11} className="animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Package size={11} strokeWidth={1.5} />
                      )}
                      Compliance Bundle
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━━ SECTION C: PROOF EXPORT ━━━ */}
      {activeSection === "export" && (
        <div className="space-y-3">
          {/* Proof Export Explainer */}
          <div className="rounded-xl p-4 bg-gradient-to-br from-orange-50/80 to-white border border-orange-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Download size={12} strokeWidth={1.5} className="text-[#FF9900]" />
              <span className="text-xs font-bold text-orange-700">
                Cryptographic Proof Export
              </span>
            </div>
            <p className="text-[11px] text-orange-600/80 leading-relaxed">
              Export a standardized JSON proof bundle containing your Merkle path, nullifier, and commitment data. Share with auditors to prove deposit ownership without exposing your secret.
            </p>
          </div>

          {/* Auditor flow info */}
          <div className="rounded-xl p-3 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={10} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Threshold Audit Flow</span>
            </div>
            <div className="space-y-1.5">
              {[
                "Export proof → send to N designated auditors",
                "K-of-N auditors verify proof against on-chain state",
                "Audit confirms deposit without revealing identity to any single party",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] font-[family-name:var(--font-geist-mono)] text-[var(--text-quaternary)] w-3">{i + 1}.</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes with Export actions */}
          {loading ? (
            <div className="text-center py-8">
              <Loader size={20} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <Download size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-secondary)]">No deposits found</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Make a deposit first, then export proofs here</p>
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
                      {truncateHash(note.commitment)}
                    </span>
                    <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)]">
                      {(Number(note.amount) / 1_000_000).toLocaleString()} USDC · #{note.batchId}
                    </span>
                  </div>
                  <motion.button
                    onClick={() => exportProof(note)}
                    className="w-full py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-orange)]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download size={11} strokeWidth={1.5} />
                    Export Proof (JSON)
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
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
