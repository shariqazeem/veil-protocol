"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useSmartSend } from "@/hooks/useSmartSend";
import { Loader, CheckCircle, AlertTriangle, Lock, Unlock, ExternalLink, Bitcoin, Clock, Zap, ShieldCheck, Fingerprint, Download, Upload } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { computeBtcIdentityHash } from "@/utils/bitcoin";
import { motion, AnimatePresence } from "framer-motion";
import { markNoteClaimed, buildMerkleProof, loadNotes, loadNotesEncrypted, saveNotesEncrypted, type GhostNote } from "@/utils/privacy";
import { generateWithdrawalProof, preloadZKProver } from "@/utils/zkProver";
import {
  type NoteWithStatus,
  checkAllNoteStatuses,
} from "@/utils/notesManager";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import { EXPLORER_TX, RPC_URL } from "@/utils/network";

import { CallData, RpcProvider, Contract, type Abi, num } from "starknet";

type WithdrawMode = "wbtc" | "btc_intent";
type ClaimPhase = "idle" | "building_proof" | "generating_zk" | "withdrawing" | "success" | "error";

interface ProofDetails {
  calldataElements: number;
  zkCommitment: string;
  zkNullifier: string;
  gasless: boolean;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };
const TX_EXPLORER = EXPLORER_TX;
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";
const GARAGA_VERIFIER = addresses.contracts.garagaVerifier;

function truncateHash(h: string, chars = 4): string {
  if (h.length <= chars * 2 + 2) return h;
  return `${h.slice(0, chars + 2)}...${h.slice(-chars)}`;
}

function StatusBadge({ status }: { status: NoteWithStatus["status"] }) {
  const styles: Record<string, string> = {
    PENDING: "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20",
    READY: "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/20",
    CLAIMED: "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]",
    STALE: "bg-[var(--accent-red)]/15 text-[var(--accent-red)] border border-[var(--accent-red)]/20",
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
    <div className="w-full py-3 rounded-xl text-sm font-medium text-center bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20 flex items-center justify-center gap-2">
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

  const now = Math.floor(Date.now() / 1000);
  const isCooldownActive = note.status === "READY" && note.withdrawableAt && note.withdrawableAt > now && !cooldownDone;
  const canClaim = note.status === "READY" && !isCooldownActive;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={spring}
      className={`bg-[var(--bg-tertiary)] border rounded-xl p-4 space-y-3 transition-all ${
        note.status === "READY"
          ? "border-[var(--accent-emerald)]/20 hover:border-[var(--accent-emerald)]/40"
          : "border-[var(--border-subtle)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {note.status === "CLAIMED" ? (
            <Unlock size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
          ) : (
            <Lock size={14} strokeWidth={1.5} className={note.status === "READY" ? "text-[var(--accent-emerald)]" : "text-[var(--text-primary)]"} />
          )}
          <span className="text-xs font-['JetBrains_Mono'] text-[var(--text-secondary)]">
            {truncateHash(note.commitment)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {note.hasBtcIdentity && (
            <span className="flex items-center gap-1 text-xs bg-[var(--accent-orange-dim)] text-[var(--accent-orange)] px-2 py-0.5 rounded-full font-medium border border-[var(--accent-orange)]/20">
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
          <div className="font-['JetBrains_Mono'] font-semibold text-[var(--text-primary)] font-tabular">
            {(Number(note.amount) / 1_000_000).toLocaleString()} USDC
          </div>
        </div>
        <div>
          <span className="text-xs text-[var(--text-tertiary)]">Batch</span>
          <div className="font-['JetBrains_Mono'] font-semibold text-[var(--text-primary)] font-tabular">
            #{note.batchId}
          </div>
        </div>
        {note.wbtcShare && (
          <div>
            <span className="text-xs text-[var(--text-tertiary)]">BTC Share</span>
            <div className="font-['JetBrains_Mono'] font-semibold text-[#FF9900] font-tabular">
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
          className="btn-shimmer w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2 cursor-pointer
                     shadow-lg hover:shadow-[var(--shadow-emerald)] transition-all duration-300"
          whileHover={{ y: -2, boxShadow: "0 20px 40px rgba(18,212,131,0.18)" }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
        >
          {isClaiming ? (
            <Loader size={14} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <Unlock size={14} strokeWidth={1.5} />
          )}
          {isClaiming ? "Building proof..." : "Execute Exit"}
        </motion.button>
      )}
    </motion.div>
  );
}

interface UnveilFormProps {
  prefillNoteIdx?: number | null;
  onPrefillConsumed?: () => void;
}

export default function UnveilForm({ prefillNoteIdx, onPrefillConsumed }: UnveilFormProps = {}) {
  const { address, account, isConnected } = useAccount();
  const { sendAsync, isGasless } = useSmartSend();
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
  const [withdrawMode, setWithdrawMode] = useState<WithdrawMode>("wbtc");
  const [intentStatus, setIntentStatus] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<number | null>(null);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

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

  useEffect(() => {
    preloadZKProver();
  }, []);

  // Pre-fill note selection from deep link / URL params
  useEffect(() => {
    if (prefillNoteIdx !== null && prefillNoteIdx !== undefined && prefillNoteIdx >= 0 && notes.length > 0) {
      const activeNotes = notes.filter((n) => !n.claimed);
      if (prefillNoteIdx < activeNotes.length) {
        // Auto-trigger claim for the pre-selected note
        // For now, just scroll to it — actual auto-selection happens via the UI
        onPrefillConsumed?.();
      }
    }
  }, [prefillNoteIdx, notes, onPrefillConsumed]);

  useEffect(() => {
    if (!useRelayer) return;
    async function fetchRelayerInfo() {
      try {
        const res = await fetch(`${RELAYER_URL}/info`);
        const data = await res.json();
        setRelayerFee(data.fee_bps ?? 200);
      } catch {
        setRelayerFee(200);
      }
    }
    fetchRelayerInfo();
  }, [useRelayer]);

  useEffect(() => {
    if (intentId === null || !poolAddress) return;
    let cancelled = false;

    async function pollIntent() {
      const rpc = new RpcProvider({ nodeUrl: RPC_URL });
      const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: rpc });

      while (!cancelled) {
        try {
          const intent = await pool.call("get_intent", [intentId!]);
          const status = Number((intent as any).status ?? 0);
          const labels: Record<number, string> = { 0: "CREATED", 1: "CLAIMED", 2: "SETTLED", 3: "EXPIRED" };
          setIntentStatus(labels[status] ?? "UNKNOWN");
          if (status >= 2) break;
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }

    pollIntent();
    return () => { cancelled = true; };
  }, [intentId, poolAddress]);

  async function handleClaim(note: NoteWithStatus) {
    if (!isConnected || !address) return;
    if (!poolAddress) return;

    const isBtcIntent = withdrawMode === "btc_intent" && btcWithdrawAddress.trim().length > 0;

    setClaimingCommitment(note.commitment);
    setClaimError(null);
    setClaimTxHash(null);
    setClaimedWbtcAmount(null);
    setProofDetails(null);
    setZkTimer(0);
    setIntentStatus(null);
    setIntentId(null);

    try {
      setClaimPhase("building_proof");

      const rpc = new RpcProvider({
        nodeUrl: RPC_URL,
      });
      const pool = new Contract({ abi: SHIELDED_POOL_ABI as unknown as Abi, address: poolAddress, providerOrAccount: rpc });
      const onChainLeafCount = Number(await pool.call("get_leaf_count", []));

      const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
        pool.call("get_leaf", [i]).then((leaf) => num.toHex(leaf as bigint))
      );
      const allCommitments = await Promise.all(leafPromises);

      const leafIndex = note.leafIndex ?? 0;

      if (leafIndex >= allCommitments.length || allCommitments[leafIndex] !== note.commitment) {
        const found = allCommitments.indexOf(note.commitment);
        if (found === -1) {
          throw new Error("Commitment not found on-chain. It may not have been included in a batch yet.");
        }
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

      const hasZK = !!note.zkCommitment;
      let usedZK = false;

      if (hasZK) {
        try {
          const zkStart = Date.now();
          const timer = setInterval(() => setZkTimer(Math.floor((Date.now() - zkStart) / 1000)), 500);
          setClaimPhase("generating_zk");
          console.log("[unveil] Step 1: generating ZK proof...");
          const { proof, zkNullifier } = await generateWithdrawalProof({
            secret: BigInt(note.secret),
            blinder: BigInt(note.blinder),
            denomination: BigInt(denomination),
            recipient: BigInt(address),
          });
          clearInterval(timer);
          usedZK = true;
          console.log("[unveil] Step 2: ZK proof generated, proof length:", proof.length);

          if (isBtcIntent) {
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: useRelayer,
            });
            setClaimPhase("withdrawing");

            if (useRelayer) {
              const relayRes = await fetch(`${RELAYER_URL}/relay-intent`, {
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
                  btc_address_hash: btcRecipientHash,
                }),
              });
              const relayData = await relayRes.json();
              if (!relayData.success) throw new Error(relayData.error ?? "Relayer failed");
              setClaimTxHash(relayData.txHash);
            } else {
              const intentCalls = [
                {
                  contractAddress: poolAddress,
                  entrypoint: "withdraw_with_btc_intent",
                  calldata: CallData.compile({
                    denomination,
                    zk_nullifier: zkNullifier,
                    zk_commitment: note.zkCommitment!,
                    proof,
                    merkle_path: merklePath,
                    path_indices: pathIndices,
                    recipient: address,
                    btc_address_hash: btcRecipientHash,
                  }),
                },
              ];
              const result = await sendAsync(intentCalls);
              setClaimTxHash(result.transaction_hash);
            }

            try {
              const countAfter = Number(await pool.call("get_intent_count", []));
              setIntentId(countAfter - 1);
              setIntentStatus("CREATED");
            } catch { /* ignore */ }

            setClaimedWbtcAmount(note.wbtcShare ?? null);
          } else if (useRelayer) {
            console.log("[unveil] Step 3: using gasless relayer (2% fee)");
            setProofDetails({
              calldataElements: proof.length,
              zkCommitment: note.zkCommitment!,
              zkNullifier,
              gasless: true,
            });
            setClaimPhase("withdrawing");

            console.log("[unveil] Step 4: sending relay request...");
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
            console.log("[unveil] Step 5: relay response:", relayData);
            if (!relayData.success) throw new Error(relayData.error ?? "Relayer failed");
            setClaimTxHash(relayData.txHash);
            setClaimedWbtcAmount(note.wbtcShare ?? null);
          } else {
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
          console.error("[unveil] Withdrawal error:", zkErr);
          const errMsg = zkErr instanceof Error ? zkErr.message : String(zkErr);
          // Provide more specific error messages based on the failure point
          if (errMsg.includes("addInvokeTransaction") || errMsg.includes("estimateFee") || errMsg.includes("relay") || errMsg.includes("Relayer") || errMsg.includes("Resources bounds") || errMsg.includes("Cannot mix BigInt")) {
            throw new Error(`Withdrawal failed: ${errMsg.slice(0, 250)}`);
          }
          if (errMsg.includes("Calldata") || errMsg.includes("calldata") || errMsg.includes("503")) {
            throw new Error(`Garaga calldata generation failed: ${errMsg.slice(0, 150)}. The ZK proof server may be unavailable.`);
          }
          throw new Error(`ZK proof generation failed: ${errMsg.slice(0, 120)}. Please try again or check that the relayer is running.`);
        }
      }

      if (!usedZK) {
        throw new Error("This note does not have a ZK commitment. Only ZK-private withdrawals are supported.");
      }

      await markNoteClaimed(note.commitment, address);
      setClaimPhase("success");
      toast("success", isBtcIntent ? "Settlement initiated — solver will fulfill" : "Confidential exit executed");

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

  // Auto-exit: process all ready notes one-by-one in sequence.
  // Groth16 verification is too expensive to batch (multicall costs MORE).
  // This automates clicking "Execute Exit" on each — one button, sequential txs.
  async function handleBatchClaim() {
    if (!isConnected || !address || !poolAddress) return;

    const readyNotes = notes.filter(
      (n) => n.status === "READY" && !n.claimed && !!n.zkCommitment,
    );
    if (readyNotes.length < 2) return;

    setBatchClaiming(true);
    setBatchProgress({ current: 0, total: readyNotes.length });
    setClaimError(null);
    setClaimTxHash(null);
    setClaimPhase("building_proof");

    try {
      // Fetch on-chain leaves once (shared across all proofs)
      const rpc = new RpcProvider({ nodeUrl: RPC_URL });
      const pool = new Contract({
        abi: SHIELDED_POOL_ABI as unknown as Abi,
        address: poolAddress,
        providerOrAccount: rpc,
      });
      const onChainLeafCount = Number(await pool.call("get_leaf_count", []));
      const leafPromises = Array.from({ length: onChainLeafCount }, (_, i) =>
        pool.call("get_leaf", [i]).then((leaf) => num.toHex(leaf as bigint)),
      );
      const allCommitments = await Promise.all(leafPromises);

      const btcRecipientHash = btcWithdrawAddress
        ? computeBtcIdentityHash(btcWithdrawAddress)
        : "0x0";

      let lastTxHash = "";
      let totalClaimed = 0;

      // Process each note individually: build proof → send tx → next
      for (let i = 0; i < readyNotes.length; i++) {
        const note = readyNotes[i];
        setBatchProgress({ current: i + 1, total: readyNotes.length });
        setClaimPhase("generating_zk");

        // Resolve leaf index
        let validIndex = note.leafIndex ?? 0;
        if (
          validIndex >= allCommitments.length ||
          allCommitments[validIndex] !== note.commitment
        ) {
          const found = allCommitments.indexOf(note.commitment);
          if (found === -1) continue;
          validIndex = found;
        }

        const { path: merklePath, indices: pathIndices } = buildMerkleProof(
          validIndex,
          allCommitments,
        );

        const denomination = note.denomination ?? 1;

        try {
          const { proof, zkNullifier } = await generateWithdrawalProof({
            secret: BigInt(note.secret),
            blinder: BigInt(note.blinder),
            denomination: BigInt(denomination),
            recipient: BigInt(address),
          });

          setClaimPhase("withdrawing");
          const result = await sendAsync([{
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
          }]);

          lastTxHash = result.transaction_hash;
          await markNoteClaimed(note.commitment, address);
          totalClaimed++;

          // Brief pause between txs
          if (i < readyNotes.length - 1) {
            setClaimPhase("building_proof");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
            throw err; // Stop the whole batch if user rejects
          }
          console.error(`[auto-exit] Note ${i} failed:`, err);
          // Continue with remaining notes
        }
      }

      if (totalClaimed === 0) {
        throw new Error("No exits succeeded. Try individual exits.");
      }

      setClaimTxHash(lastTxHash);
      setClaimPhase("success");
      toast(
        "success",
        `Auto-exit: ${totalClaimed}/${readyNotes.length} positions claimed`,
      );
      await refreshNotes();
    } catch (err: unknown) {
      setClaimPhase("error");
      const msg = err instanceof Error ? err.message : "Auto-exit failed";
      if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
        setClaimError("Transaction rejected in wallet.");
        toast("error", "Transaction rejected");
      } else {
        setClaimError(msg);
        toast("error", "Auto-exit failed");
      }
    } finally {
      setBatchClaiming(false);
      setBatchProgress(null);
    }
  }

  const activeNotes = notes.filter((n) => !n.claimed);
  const claimedNotes = notes.filter((n) => n.claimed);
  const readyNotes = activeNotes.filter((n) => n.status === "READY" && !!n.zkCommitment);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-tertiary)]">
          Active Allocations
        </span>
        <button
          onClick={refreshNotes}
          disabled={loading}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {loading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* ZK Pipeline Visualization — the cinematic moment */}
      <AnimatePresence>
        {claimPhase !== "idle" && claimPhase !== "success" && claimPhase !== "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-medium)] space-y-3"
          >
            {claimPhase === "building_proof" && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                <span>Reconstructing Merkle tree & building proof...</span>
              </div>
            )}
            {claimPhase === "generating_zk" && (
              <div className="space-y-0">
                {/* Terminal chrome — macOS style dots */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-t-lg border-b border-gray-700/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="ml-2 text-[10px] text-gray-500 font-['JetBrains_Mono']">
                    veil-zk-prover
                  </span>
                  <span className="ml-auto text-[10px] font-['JetBrains_Mono'] text-emerald-400 font-tabular animate-pulse">
                    [{String(Math.floor(zkTimer / 60)).padStart(2, "0")}:{String(zkTimer % 60).padStart(2, "0")}]
                  </span>
                </div>

                {/* Terminal body with streaming log entries */}
                <div className="relative bg-gray-900 rounded-b-lg p-3 overflow-hidden">
                  {/* Scan-line overlay */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
                    <div className="w-full h-8 bg-gradient-to-b from-white to-transparent animate-scan-line" />
                  </div>

                  <div className="space-y-1.5 font-['JetBrains_Mono'] text-[11px]">
                    {[
                      { time: 0, msg: "Initializing Noir witness computation..." },
                      { time: 2, msg: "Computing Pedersen commitment hash..." },
                      { time: 4, msg: "Generating UltraKeccakZKHonk proof via bb.js WASM..." },
                      { time: 6, msg: "Serializing proof for Garaga on-chain verifier..." },
                    ].map((entry, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: zkTimer >= entry.time ? 1 : 0.3, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.15 }}
                        className="flex items-start gap-2"
                      >
                        <span className="text-gray-600 flex-shrink-0">
                          [{String(Math.floor(entry.time / 60)).padStart(2, "0")}:{String(entry.time % 60).padStart(2, "0")}]
                        </span>
                        <span className={zkTimer >= entry.time ? "text-emerald-400" : "text-gray-600"}>
                          {entry.msg}
                        </span>
                        {zkTimer >= entry.time && zkTimer < (entry.time + 2) && i === Math.min(Math.floor(zkTimer / 2), 3) && (
                          <Loader size={10} className="animate-spin text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
                        )}
                      </motion.div>
                    ))}

                    {/* Blinking cursor */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">[{String(Math.floor(zkTimer / 60)).padStart(2, "0")}:{String(zkTimer % 60).padStart(2, "0")}]</span>
                      <span className="w-1.5 h-3.5 bg-emerald-400/80 rounded-sm typewriter-cursor" />
                    </div>
                  </div>

                  {/* Footer badge */}
                  <div className="mt-3 pt-2 border-t border-gray-700/40 flex items-center justify-center gap-1.5">
                    <Lock size={9} strokeWidth={2} className="text-gray-500" />
                    <span className="text-[10px] text-gray-500">
                      Secrets never leave your browser — only the proof is sent
                    </span>
                  </div>
                </div>
              </div>
            )}
            {claimPhase === "withdrawing" && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size={14} className="animate-spin text-[#4D4DFF]" strokeWidth={1.5} />
                <span>Executing confidential exit ({proofDetails?.calldataElements ?? "~2835"} calldata elements)...</span>
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
          className="rounded-xl p-5 bg-[var(--accent-emerald-dim)] text-sm space-y-4 border border-[var(--accent-emerald)]/20 shadow-[var(--glow-emerald)]"
        >
          <div className="text-center space-y-3 py-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-14 h-14 rounded-full bg-[var(--accent-emerald-dim)] border border-[var(--accent-emerald)]/30 flex items-center justify-center mx-auto animate-glow-pulse-emerald"
            >
              <CheckCircle size={24} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
            </motion.div>
            <div className="text-[15px] font-bold text-[var(--accent-emerald)]">
              Confidential Exit Complete
            </div>
            <div className="flex items-center justify-center gap-4">
              {[
                { label: "Withdrawal Unlinkable", icon: Lock },
                { label: "Position Size Obfuscated", icon: ShieldCheck },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon size={10} strokeWidth={2} className="text-[var(--accent-emerald)]" />
                  <span className="text-xs font-medium text-[var(--accent-emerald)]/80">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--accent-emerald)]/60 font-medium">
              No on-chain observer can link this exit to your deposit.
            </p>
          </div>

          {claimedWbtcAmount && (
            <div className="text-center text-xs text-[var(--accent-emerald)]">
              Amount: <span className="font-['JetBrains_Mono'] font-semibold text-[14px]">{(Number(claimedWbtcAmount) / 1e8).toFixed(8)}</span> BTC
            </div>
          )}

          {claimTxHash && (
            <a
              href={`${TX_EXPLORER}${claimTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-[var(--accent-emerald)] hover:underline font-['JetBrains_Mono']"
            >
              View on Voyager
              <ExternalLink size={10} strokeWidth={1.5} />
            </a>
          )}

          {proofDetails && (
            <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 space-y-2 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <Fingerprint size={11} strokeWidth={2} className="text-[var(--accent-emerald)]" />
                <span className="text-xs font-semibold text-[var(--accent-emerald)]">ZK Proof Verified On-Chain</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-xs text-[var(--text-tertiary)]">Proof size</div>
                <div className="text-xs font-['JetBrains_Mono'] text-[var(--text-primary)]">{proofDetails.calldataElements} felt252</div>
                <div className="text-xs text-[var(--text-tertiary)]">Verifier</div>
                <div className="text-xs font-['JetBrains_Mono'] text-[var(--text-primary)]">Garaga UltraKeccakZKHonk</div>
                <div className="text-xs text-[var(--text-tertiary)]">Method</div>
                <div className="text-xs font-['JetBrains_Mono'] text-[var(--text-primary)]">{proofDetails.gasless ? "Gasless relayer" : "Direct"}</div>
              </div>
              <div className="pt-1.5 border-t border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--accent-emerald)]/70 font-medium">
                  Your secret and blinder did NOT appear in this transaction. Only the ZK proof was submitted.
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-[var(--bg-tertiary)] p-2.5 space-y-1.5 border border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-secondary)] font-medium">Add BTC token to your wallet:</div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-['JetBrains_Mono'] text-[#4D4DFF] bg-[var(--bg-elevated)] px-2 py-1 rounded flex-1 truncate">
                {addresses.contracts.wbtc}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(addresses.contracts.wbtc);
                  setTokenAdded(true);
                }}
                className="text-xs font-medium text-[#4D4DFF] hover:text-[#4D4DFF] px-2 py-1 bg-[var(--bg-elevated)] rounded cursor-pointer whitespace-nowrap border border-[var(--border-subtle)]"
              >
                {tokenAdded ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              In Argent/Braavos: Settings &rarr; Manage tokens &rarr; Add token &rarr; paste address
            </div>
          </div>
        </motion.div>
      )}

      {claimPhase === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-xl p-4 bg-[var(--accent-red)]/10 text-sm text-[var(--accent-red)] border border-[var(--accent-red)]/20"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} strokeWidth={1.5} />
            <span>Claim failed</span>
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
            ? "bg-indigo-50 border-indigo-200/50"
            : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
        }`}>
          <button
            onClick={() => setUseRelayer(!useRelayer)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                useRelayer ? "bg-[#4D4DFF]" : "bg-[var(--bg-elevated)]"
              }`}>
                <Zap size={13} strokeWidth={1.5} className={useRelayer ? "text-white" : "text-[var(--text-tertiary)]"} />
              </div>
              <div className="text-left">
                <span className="text-[12px] font-semibold text-[var(--text-primary)] block leading-tight">
                  Gasless withdrawal
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  Relayer pays gas, no wallet signature
                </span>
              </div>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              useRelayer ? "bg-[#4D4DFF]" : "bg-[var(--bg-elevated)]"
            }`}>
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  useRelayer ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
          {useRelayer && (
            <div className="mt-3 pt-3 border-t border-indigo-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4D4DFF]">
                  Fee: {relayerFee ? `${relayerFee / 100}%` : "2%"} of WBTC deducted from withdrawal
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  Best for $100+ withdrawals
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Withdrawal Mode Selector */}
      {activeNotes.some((n) => n.status === "READY") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setWithdrawMode("wbtc")}
              className={`rounded-xl p-3 text-left transition-all cursor-pointer border ${
                withdrawMode === "wbtc"
                  ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/20"
                  : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Unlock size={12} strokeWidth={1.5} className={withdrawMode === "wbtc" ? "text-[var(--accent-emerald)]" : "text-[var(--text-tertiary)]"} />
                <span className={`text-xs font-semibold ${
                  withdrawMode === "wbtc" ? "text-[var(--accent-emerald)]" : "text-[var(--text-tertiary)]"
                }`}>
                  Starknet Settlement
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Receive BTC on Starknet
              </p>
            </button>
            <button
              onClick={() => setWithdrawMode("btc_intent")}
              className={`rounded-xl p-3 text-left transition-all cursor-pointer border ${
                withdrawMode === "btc_intent"
                  ? "bg-[var(--accent-orange-dim)] border-[var(--accent-orange)]/20"
                  : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Bitcoin size={12} strokeWidth={1.5} className={withdrawMode === "btc_intent" ? "text-[var(--accent-orange)]" : "text-[var(--text-tertiary)]"} />
                <span className={`text-xs font-semibold ${
                  withdrawMode === "btc_intent" ? "text-[var(--accent-orange)]" : "text-[var(--text-tertiary)]"
                }`}>
                  Bitcoin Settlement
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Settle to native Bitcoin
              </p>
            </button>
          </div>

          {withdrawMode === "btc_intent" && (
            <div className="rounded-xl p-3.5 bg-[var(--accent-orange-dim)] border border-[var(--accent-orange)]/20 space-y-2">
              <div className="flex items-center gap-1.5">
                <Bitcoin size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                <span className="text-xs font-semibold text-[var(--accent-orange)]">
                  Bitcoin Address
                </span>
              </div>
              <input
                type="text"
                placeholder="bc1q... (your Bitcoin address)"
                value={btcWithdrawAddress}
                onChange={(e) => setBtcWithdrawAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border-medium)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] font-['JetBrains_Mono'] focus:outline-none focus:ring-1 focus:ring-[var(--accent-orange)]"
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Your BTC is locked in escrow. A solver sends native Bitcoin to this address, an oracle confirms settlement, and the solver receives the escrowed BTC.
              </p>
            </div>
          )}

          {intentStatus && (
            <div className="rounded-xl p-3.5 bg-[var(--accent-orange-dim)] border border-[var(--accent-orange)]/20 space-y-2">
              <div className="flex items-center gap-1.5">
                <Zap size={12} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                <span className="text-xs font-semibold text-[var(--accent-orange)]">
                  Intent #{intentId} Settlement
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["CREATED", "CLAIMED", "SETTLED"].map((step) => {
                  const steps = ["CREATED", "CLAIMED", "SETTLED"];
                  const currentIdx = steps.indexOf(intentStatus ?? "");
                  const stepIdx = steps.indexOf(step);
                  const isActive = stepIdx <= currentIdx;
                  const isCurrent = step === intentStatus;
                  return (
                    <div
                      key={step}
                      className={`rounded-lg p-2 text-center border transition-all ${
                        isCurrent
                          ? "bg-[var(--accent-orange-dim)] border-[var(--accent-orange)]/30"
                          : isActive
                          ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/20"
                          : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        {isCurrent && intentStatus !== "SETTLED" ? (
                          <Loader size={9} className="animate-spin text-[var(--accent-orange)]" strokeWidth={2} />
                        ) : isActive ? (
                          <CheckCircle size={9} className="text-[var(--accent-emerald)]" strokeWidth={2} />
                        ) : null}
                        <span className={`text-xs font-semibold ${
                          isCurrent ? "text-[var(--accent-orange)]" : isActive ? "text-[var(--accent-emerald)]" : "text-[var(--text-tertiary)]"
                        }`}>
                          {step}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className={`rounded-lg p-2 text-center border transition-all ${
                  intentStatus === "EXPIRED"
                    ? "bg-[var(--accent-red)]/10 border-[var(--accent-red)]/20"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
                }`}>
                  <span className={`text-xs font-semibold ${
                    intentStatus === "EXPIRED" ? "text-[var(--accent-red)]" : "text-[var(--text-tertiary)]"
                  }`}>
                    {intentStatus === "EXPIRED" ? "EXPIRED" : "TIMEOUT"}
                  </span>
                </div>
              </div>
              {intentStatus === "SETTLED" && (
                <p className="text-xs text-[var(--accent-emerald)] font-medium">
                  Bitcoin sent! Settlement complete.
                </p>
              )}
              {intentStatus === "EXPIRED" && (
                <p className="text-xs text-[var(--accent-red)] font-medium">
                  No solver filled the intent. BTC refunded to your address.
                </p>
              )}
              {(intentStatus === "CREATED" || intentStatus === "CLAIMED") && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {intentStatus === "CREATED"
                    ? "Waiting for a solver to claim and send BTC..."
                    : "Solver claimed — waiting for BTC confirmation..."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Gasless badge */}
      {isGasless && isConnected && !loading && activeNotes.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--accent-emerald)] font-medium">
          <Zap size={10} strokeWidth={2} />
          Gas paid in USDC via AVNU Paymaster
        </div>
      )}

      {/* Notes */}
      {loading ? (
        <div className="text-center py-10">
          <Loader size={20} className="animate-spin mx-auto text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-xs text-[var(--text-tertiary)] mt-3">
            Loading allocations...
          </p>
        </div>
      ) : activeNotes.length === 0 && claimedNotes.length === 0 ? (
        <div className="text-center py-10">
          <Lock size={24} className="mx-auto mb-3 text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">No allocations found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Allocate capital first to create positions
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Auto Exit — shown when 2+ notes are ready */}
          {readyNotes.length >= 2 && !batchClaiming && claimPhase === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--accent-emerald)]/20 space-y-2"
            >
              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Auto Exit All
                </span>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  Claim all {readyNotes.length} positions sequentially — one click, approve each tx in wallet
                </p>
              </div>
              <motion.button
                onClick={handleBatchClaim}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold
                           flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                whileHover={{ y: -2, boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
              >
                <Zap size={14} strokeWidth={1.5} />
                Auto Exit All ({readyNotes.length} positions)
              </motion.button>
            </motion.div>
          )}

          {/* Auto-exit progress indicator */}
          {batchClaiming && batchProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[#4D4DFF]/20 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size={14} className="animate-spin text-[#4D4DFF]" strokeWidth={1.5} />
                <span>
                  {claimPhase === "withdrawing"
                    ? `Exit ${batchProgress.current}/${batchProgress.total} — confirm in wallet...`
                    : `Building proof ${batchProgress.current}/${batchProgress.total}...`}
                </span>
              </div>
              <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#4D4DFF] transition-all"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </motion.div>
          )}

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
                Previously claimed ({claimedNotes.length})
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

      {/* Note Export / Import */}
      {isConnected && (
        <div className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] space-y-3">
          <span className="text-xs font-semibold text-[var(--text-secondary)] block">
            Note Backup
          </span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const allNotes = address
                  ? await loadNotesEncrypted(address)
                  : loadNotes();
                if (allNotes.length === 0) {
                  toast("error", "No notes to export");
                  return;
                }
                const blob = new Blob([JSON.stringify(allNotes, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `veil-notes-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast("success", `Exported ${allNotes.length} notes`);
              }}
              className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download size={11} strokeWidth={1.5} />
              Export Notes
            </button>
            <label className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[#4D4DFF]/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
              <Upload size={11} strokeWidth={1.5} />
              Import Notes
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const imported: GhostNote[] = JSON.parse(text);
                    if (!Array.isArray(imported) || imported.length === 0) {
                      toast("error", "Invalid note file");
                      return;
                    }
                    const existing = address
                      ? await loadNotesEncrypted(address)
                      : loadNotes();
                    const existingCommitments = new Set(existing.map(n => n.commitment));
                    const newNotes = imported.filter(n => n.commitment && !existingCommitments.has(n.commitment));
                    if (newNotes.length === 0) {
                      toast("info", "All notes already exist locally");
                      return;
                    }
                    const merged = [...existing, ...newNotes];
                    if (address) {
                      await saveNotesEncrypted(merged, address);
                    } else {
                      localStorage.setItem("ghost-notes", JSON.stringify(merged));
                    }
                    toast("success", `Imported ${newNotes.length} new notes`);
                    refreshNotes();
                  } catch {
                    toast("error", "Failed to parse note file");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Export your notes before clearing browser data. You need them to withdraw.
          </p>
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Connect wallet to execute confidential exit
        </p>
      )}
    </div>
  );
}
