"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Loader, CheckCircle, AlertTriangle, Lock, Unlock, ExternalLink, Bitcoin, Clock, Zap, ShieldCheck, Fingerprint } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { computeBtcIdentityHash } from "@/utils/bitcoin";
import { motion, AnimatePresence } from "framer-motion";
import { markNoteClaimed, computeNullifier, buildMerkleProof } from "@/utils/privacy";
import { generateWithdrawalProof } from "@/utils/zkProver";
import {
  type NoteWithStatus,
  checkAllNoteStatuses,
} from "@/utils/notesManager";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { CallData, RpcProvider, Contract, type Abi, num } from "starknet";

type ClaimPhase = "idle" | "building_proof" | "generating_zk" | "withdrawing" | "success" | "error";

interface ProofDetails {
  calldataElements: number;
  zkCommitment: string;
  zkNullifier: string;
  gasless: boolean;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };
const SEPOLIA_EXPLORER = "https://sepolia.voyager.online/tx/";
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:3001";
const GARAGA_VERIFIER = "0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07";

function truncateHash(h: string, chars = 4): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

function StatusBadge({ status }: { status: NoteWithStatus["status"] }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-900/20 text-amber-400",
    READY: "bg-emerald-900/20 text-emerald-400",
    CLAIMED: "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]",
    STALE: "bg-red-900/20 text-red-400",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending",
    READY: "Ready",
    CLAIMED: "Claimed",
    STALE: "Stale",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[status] ?? styles.PENDING}`}>
      {labels[status] ?? status}
    </span>
  );
}

function CountdownTimer({ withdrawableAt, onReady }: { withdrawableAt: number; onReady: () => void }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const left = withdrawableAt - now;
      if (left <= 0) {
        setRemaining(0);
        onReady();
      } else {
        setRemaining(left);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [withdrawableAt, onReady]);

  if (remaining <= 0) return null;

  return (
    <div className="w-full py-3 rounded-xl text-sm font-medium text-center bg-amber-900/20 text-amber-400 flex items-center justify-center gap-2">
      <Clock size={14} strokeWidth={1.5} />
      <span>Privacy cooldown: {remaining}s remaining</span>
    </div>
  );
}

function NoteCard({
  note,
  onClaim,
  claimingCommitment,
}: {
  note: NoteWithStatus;
  onClaim: (note: NoteWithStatus) => void;
  claimingCommitment: string | null;
}) {
  const isClaiming = claimingCommitment === note.commitment;
  const [cooldownDone, setCooldownDone] = useState(false);

  // Check if cooldown already passed on mount
  const now = Math.floor(Date.now() / 1000);
  const isCooldownActive = note.status === "READY" && note.withdrawableAt && note.withdrawableAt > now && !cooldownDone;
  const canClaim = note.status === "READY" && !isCooldownActive;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {note.status === "CLAIMED" ? (
            <Unlock size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          ) : (
            <Lock size={14} strokeWidth={1.5} className="text-[var(--text-primary)]" />
          )}
          <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-secondary)]">
            {truncateHash(note.commitment)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {note.hasBtcIdentity && (
            <span className="flex items-center gap-1 text-[10px] bg-orange-900/20 text-[var(--accent-orange)] px-2 py-0.5 rounded-full font-medium">
              <Bitcoin size={10} strokeWidth={1.5} />
              BTC
            </span>
          )}
          <StatusBadge status={note.status} />
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">Amount</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
            {(Number(note.amount) / 1_000_000).toLocaleString()} USDC
          </div>
        </div>
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">Batch</span>
          <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
            #{note.batchId}
          </div>
        </div>
        {note.wbtcShare && (
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">BTC Share</span>
            <div className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--accent-orange)] font-tabular">
              {(Number(note.wbtcShare) / 1e8).toFixed(8)} BTC
            </div>
          </div>
        )}
      </div>

      {isCooldownActive && note.withdrawableAt && (
        <CountdownTimer
          withdrawableAt={note.withdrawableAt}
          onReady={() => setCooldownDone(true)}
        />
      )}

      {canClaim && (
        <motion.button
          onClick={() => onClaim(note)}
          disabled={isClaiming}
          className="w-full py-3 bg-[var(--accent-orange)] text-white rounded-xl text-sm font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 cursor-pointer"
          whileHover={{ y: -1, boxShadow: "var(--shadow-elevated)" }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
        >
          {isClaiming ? (
            <Loader size={14} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <Unlock size={14} strokeWidth={1.5} />
          )}
          {isClaiming ? "Building proof..." : "Claim WBTC"}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function UnveilForm() {
  const { address, account, isConnected } = useAccount();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();

  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("idle");
  const [claimingCommitment, setClaimingCommitment] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimedWbtcAmount, setClaimedWbtcAmount] = useState<string | null>(null);
  const [btcWithdrawAddress, setBtcWithdrawAddress] = useState<string>("");
  const [tokenAdded, setTokenAdded] = useState(false);
  const [useRelayer, setUseRelayer] = useState(false);
  const [relayerFee, setRelayerFee] = useState<number | null>(null);
  const [proofDetails, setProofDetails] = useState<ProofDetails | null>(null);
  const [zkTimer, setZkTimer] = useState<number>(0);

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

  // Fetch relayer fee info
  useEffect(() => {
    if (!useRelayer) return;
    async function fetchRelayerInfo() {
      try {
        const res = await fetch(`${RELAYER_URL}/info`);
        const data = await res.json();
        setRelayerFee(data.fee_bps ?? 200);
      } catch {
        setRelayerFee(200); // Default 2%
      }
    }
    fetchRelayerInfo();
  }, [useRelayer]);

  async function handleClaim(note: NoteWithStatus) {
    if (!isConnected || !address) return;
    if (!poolAddress) return;

    setClaimingCommitment(note.commitment);
    setClaimError(null);
    setClaimTxHash(null);
    setClaimedWbtcAmount(null);
    setProofDetails(null);
    setZkTimer(0);

    try {
      setClaimPhase("building_proof");

      const rpc = new RpcProvider({
        nodeUrl: "https://starknet-sepolia-rpc.publicnode.com",
      });
      const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: rpc });
      const onChainLeafCount = Number(await pool.call("get_leaf_count", []));

      const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
        pool.call("get_leaf", [i]).then((leaf) => num.toHex(leaf as bigint))
      );
      const allCommitments = await Promise.all(leafPromises);

      const leafIndex = note.leafIndex ?? 0;

      // Validate leaf index matches on-chain commitment
      if (leafIndex >= allCommitments.length || allCommitments[leafIndex] !== note.commitment) {
        const found = allCommitments.indexOf(note.commitment);
        if (found === -1) {
          throw new Error("Commitment not found on-chain. It may not have been included in a batch yet.");
        }
        // Auto-correct the leaf index
        note.leafIndex = found;
      }
      const validIndex = note.leafIndex ?? leafIndex;

      const { path: merklePath, indices: pathIndices } = buildMerkleProof(
        validIndex,
        allCommitments,
      );

      const denomination = note.denomination ?? 1;
      const btcRecipientHash = btcWithdrawAddress
        ? computeBtcIdentityHash(btcWithdrawAddress)
        : "0x0";

      // Try ZK-private withdrawal first; fall back to legacy if prover unavailable
      const hasZK = !!note.zkCommitment;
      let usedZK = false;

      if (hasZK) {
        // Attempt ZK proof generation — requires prover service running
        try {
          const zkStart = Date.now();
          const timer = setInterval(() => setZkTimer(Math.floor((Date.now() - zkStart) / 1000)), 500);
          setClaimPhase("generating_zk");
          const { proof, zkNullifier } = await generateWithdrawalProof({
            secret: BigInt(note.secret),
            blinder: BigInt(note.blinder),
            denomination: BigInt(denomination),
          });
          clearInterval(timer);
          usedZK = true;

          if (useRelayer) {
            // Gasless via relayer
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: true,
            });
            setClaimPhase("withdrawing");
            const relayRes = await fetch(`${RELAYER_URL}/relay`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                denomination,
                zk_nullifier: zkNullifier,
                zk_commitment: note.zkCommitment!,
                proof,
                merkle_path: merklePath,
                path_indices: pathIndices.map(Number),
                recipient: address,
                btc_recipient_hash: btcRecipientHash,
              }),
            });
            const relayData = await relayRes.json();
            if (!relayData.success) throw new Error(relayData.error ?? "Relayer failed");
            setClaimTxHash(relayData.txHash);
            setClaimedWbtcAmount(note.wbtcShare ?? null);
          } else {
            // ZK-private, user pays gas
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: false,
            });
            setClaimPhase("withdrawing");
            const withdrawCalls = [
              {
                contractAddress: poolAddress,
                entrypoint: "withdraw_private",
                calldata: CallData.compile({
                  denomination,
                  zk_nullifier: zkNullifier,
                  zk_commitment: note.zkCommitment!,
                  proof,
                  merkle_path: merklePath,
                  path_indices: pathIndices,
                  recipient: address,
                  btc_recipient_hash: btcRecipientHash,
                }),
              },
            ];
            const result = await sendAsync(withdrawCalls);
            setClaimTxHash(result.transaction_hash);
            setClaimedWbtcAmount(note.wbtcShare ?? null);
          }
        } catch (zkErr) {
          // Browser proving or calldata server unavailable — fall back to legacy
          const isInfraError = zkErr instanceof TypeError ||
            (zkErr instanceof Error && (
              zkErr.message.includes("fetch") ||
              zkErr.message.includes("network") ||
              zkErr.message.includes("Failed") ||
              zkErr.message.includes("ECONNREFUSED") ||
              zkErr.message.includes("Calldata generation failed") ||
              zkErr.message.includes("Failed to load ZK circuit")
            ));
          if (!isInfraError) throw zkErr; // Re-throw non-infra errors

          console.warn("[unveil] ZK proving unavailable, falling back to Pedersen withdrawal:", zkErr);
          toast("info", "ZK prover unavailable — using Pedersen withdrawal");
          // Fall through to legacy path below
        }
      }

      if (!usedZK) {
        // Legacy Pedersen withdrawal (prover unavailable or non-ZK note)
        const nullifier = computeNullifier(note.secret);
        setClaimPhase("withdrawing");
        const withdrawCalls = [
          {
            contractAddress: poolAddress,
            entrypoint: "withdraw",
            calldata: CallData.compile({
              denomination,
              secret: note.secret,
              blinder: note.blinder,
              nullifier,
              merkle_path: merklePath,
              path_indices: pathIndices,
              recipient: address,
              btc_recipient_hash: btcRecipientHash,
            }),
          },
        ];
        const result = await sendAsync(withdrawCalls);
        setClaimTxHash(result.transaction_hash);
        setClaimedWbtcAmount(note.wbtcShare ?? null);
      }

      await markNoteClaimed(note.commitment, address);
      setClaimPhase("success");
      toast("success", "WBTC withdrawn privately");

      await refreshNotes();
    } catch (err: unknown) {
      setClaimPhase("error");
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      if (msg.includes("too early") || msg.includes("Withdrawal too early")) {
        setClaimError("Privacy cooldown not finished. Wait 60 seconds after batch execution before withdrawing. This prevents timing attacks.");
        toast("error", "Privacy cooldown not finished");
      } else if (msg.includes("nullifier") || msg.includes("already spent")) {
        setClaimError("This note has already been claimed (nullifier spent).");
        toast("error", "Note already claimed");
      } else if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
        setClaimError("Transaction rejected in wallet.");
        toast("error", "Transaction rejected");
      } else {
        setClaimError(msg);
        toast("error", "Withdrawal failed");
      }
    } finally {
      setClaimingCommitment(null);
    }
  }

  const activeNotes = notes.filter((n) => !n.claimed);
  const claimedNotes = notes.filter((n) => n.claimed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          Shielded Notes
        </span>
        <button
          onClick={refreshNotes}
          disabled={loading}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {loading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* Status Banner — ZK Pipeline Visualization */}
      <AnimatePresence>
        {claimPhase !== "idle" && claimPhase !== "success" && claimPhase !== "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3"
          >
            {claimPhase === "building_proof" && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                <span>Reconstructing Merkle tree & building proof...</span>
              </div>
            )}
            {claimPhase === "generating_zk" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <Fingerprint size={14} strokeWidth={1.5} className="text-emerald-400" />
                    <span className="font-medium">Generating Zero-Knowledge Proof</span>
                  </div>
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
                    {zkTimer}s
                  </span>
                </div>
                {/* 3-step pipeline: witness + proof in browser, calldata on server */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Witness", sub: "browser WASM" },
                    { label: "Proof", sub: "browser WASM" },
                    { label: "Calldata", sub: "garaga server" },
                  ].map((step) => (
                    <div
                      key={step.label}
                      className="rounded-lg p-2 text-center border bg-orange-950/20 border-orange-800/30"
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Loader size={10} className="animate-spin text-[var(--accent-orange)]" strokeWidth={2} />
                        <span className="text-[11px] font-semibold text-[var(--accent-orange)]">
                          {step.label}
                        </span>
                      </div>
                      <div className="text-[9px] font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)]">
                        {step.sub}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] text-center">
                  Secrets never leave your browser — only the proof is sent
                </p>
              </div>
            )}
            {claimPhase === "withdrawing" && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                <span>Submitting withdrawal with ZK proof ({proofDetails?.calldataElements ?? "~2835"} calldata elements)...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {claimPhase === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-emerald-900/20 text-sm text-emerald-400 space-y-3 border border-emerald-800/30"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={14} strokeWidth={1.5} />
            <span className="font-medium">WBTC withdrawn privately{btcWithdrawAddress ? " + Bitcoin intent emitted" : ""}</span>
          </div>
          {claimedWbtcAmount && (
            <div className="text-xs text-emerald-400">
              Received: <span className="font-[family-name:var(--font-geist-mono)] font-semibold">{(Number(claimedWbtcAmount) / 1e8).toFixed(8)}</span> BTC
            </div>
          )}
          {claimTxHash && (
            <a
              href={`${SEPOLIA_EXPLORER}${claimTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-[family-name:var(--font-geist-mono)]"
            >
              View on Voyager
              <ExternalLink size={10} strokeWidth={1.5} />
            </a>
          )}

          {/* ZK Proof Details — the "proof of the proof" */}
          {proofDetails && (
            <div className="rounded-lg bg-emerald-900/10 p-3 space-y-2 border border-emerald-800/20">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={11} strokeWidth={2} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">ZK Proof Verified On-Chain</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-[10px] text-emerald-400/60">Proof size</div>
                <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-400">{proofDetails.calldataElements} felt252 values</div>
                <div className="text-[10px] text-emerald-400/60">Verifier</div>
                <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-400">Garaga UltraKeccakZKHonk</div>
                <div className="text-[10px] text-emerald-400/60">Method</div>
                <div className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-400">{proofDetails.gasless ? "Gasless relayer" : "Direct withdrawal"}</div>
              </div>
              <div className="pt-1.5 border-t border-emerald-800/20">
                <div className="text-[9px] text-emerald-400/70 font-medium">
                  Your secret and blinder did NOT appear in this transaction. Only the ZK proof was submitted.
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-emerald-900/10 p-2.5 space-y-1.5 border border-emerald-800/20">
            <div className="text-[10px] text-emerald-400 font-medium">Add WBTC token to your wallet:</div>
            <div className="flex items-center gap-2">
              <code className="text-[10px] font-[family-name:var(--font-geist-mono)] text-emerald-300 bg-emerald-900/30 px-2 py-1 rounded flex-1 truncate">
                {addresses.contracts.wbtc}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(addresses.contracts.wbtc);
                  setTokenAdded(true);
                }}
                className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-900/30 rounded cursor-pointer whitespace-nowrap"
              >
                {tokenAdded ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-[9px] text-emerald-400">
              In Argent/Braavos: Settings → Manage tokens → Add token → paste address
            </div>
          </div>
        </motion.div>
      )}

      {claimPhase === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-red-950/30 text-sm text-red-400 border border-red-900/30"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} strokeWidth={1.5} />
            <span>Withdrawal failed</span>
          </div>
          {claimError && (
            <div className="mt-2 text-xs">{claimError}</div>
          )}
        </motion.div>
      )}

      {/* Relayer Toggle */}
      {activeNotes.some((n) => n.status === "READY" && !!n.zkCommitment) && (
        <div className={`rounded-xl p-4 border transition-all ${
          useRelayer
            ? "bg-orange-950/20 border-orange-800/30"
            : "bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
        }`}>
          <button
            onClick={() => setUseRelayer(!useRelayer)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                useRelayer ? "bg-[var(--accent-orange)]" : "bg-[var(--bg-tertiary)]"
              }`}>
                <Zap size={13} strokeWidth={1.5} className={useRelayer ? "text-white" : "text-[var(--text-tertiary)]"} />
              </div>
              <div className="text-left">
                <span className="text-[12px] font-semibold text-[var(--text-primary)] block leading-tight">
                  Gasless withdrawal
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Relayer pays gas, no wallet signature
                </span>
              </div>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              useRelayer ? "bg-[var(--accent-orange)]" : "bg-[var(--bg-tertiary)]"
            }`}>
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  useRelayer ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
          {useRelayer && (
            <div className="mt-3 pt-3 border-t border-orange-800/20 flex items-center justify-between">
              <span className="text-[10px] text-[var(--accent-orange)]">
                Fee: <strong>{relayerFee ? `${relayerFee / 100}%` : "2%"}</strong> of WBTC
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                Max privacy — no on-chain link to you
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bitcoin Cross-Chain Intent */}
      {activeNotes.some((n) => n.status === "READY") && (
        <div className="rounded-xl p-3.5 bg-orange-900/10 border border-orange-800/20 space-y-2">
          <div className="flex items-center gap-1.5">
            <Bitcoin size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
            <span className="text-[11px] font-semibold text-[var(--accent-orange)] uppercase tracking-wider">
              Bitcoin withdrawal intent (optional)
            </span>
          </div>
          <input
            type="text"
            placeholder="tb1q... or bc1q... (your Bitcoin address)"
            value={btcWithdrawAddress}
            onChange={(e) => setBtcWithdrawAddress(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-[family-name:var(--font-geist-mono)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-orange)]"
          />
          <p className="text-[10px] text-[var(--text-tertiary)]">
            <strong>Optional.</strong> You always receive WBTC on Starknet. This emits a cross-chain intent event that a future bridge can fulfill to send real BTC. No bridge is active yet — this signals bridge-ready design.
          </p>
        </div>
      )}

      {/* Notes */}
      {loading ? (
        <div className="text-center py-10">
          <Loader size={20} className="animate-spin mx-auto text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--text-tertiary)] mt-3">
            Scanning encrypted notes...
          </p>
        </div>
      ) : activeNotes.length === 0 && claimedNotes.length === 0 ? (
        <div className="text-center py-10">
          <Lock size={24} className="mx-auto mb-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">No shielded notes</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Shield assets to create your first note
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeNotes.map((note) => (
            <NoteCard
              key={note.commitment}
              note={note}
              onClaim={handleClaim}
              claimingCommitment={claimingCommitment}
            />
          ))}

          {claimedNotes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-2">
                Previously unveiled ({claimedNotes.length})
              </p>
              {claimedNotes.map((note) => (
                <NoteCard
                  key={note.commitment}
                  note={note}
                  onClaim={handleClaim}
                  claimingCommitment={claimingCommitment}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Connect Starknet wallet to unveil assets
        </p>
      )}
    </div>
  );
}
