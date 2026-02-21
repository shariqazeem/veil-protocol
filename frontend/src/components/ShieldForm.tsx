"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { generatePrivateNote, saveNote, DENOMINATIONS, DENOMINATION_LABELS } from "@/utils/privacy";
import { signCommitment, computeBtcIdentityHash } from "@/utils/bitcoin";
import { AlertTriangle, ArrowRight, Droplets, CheckCircle, Loader, Shield } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI, ERC20_ABI } from "@/contracts/abi";
import { EXPLORER_TX, isMainnet, NETWORK_LABEL } from "@/utils/network";
import { CallData } from "starknet";

type Phase =
  | "idle"
  | "signing_btc"
  | "generating_proof"
  | "generating_zk"
  | "depositing"
  | "executing_batch"
  | "batch_done"
  | "success"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  signing_btc: "Attesting Bitcoin identity...",
  generating_proof: "Computing Pedersen commitment...",
  generating_zk: "Generating confidential credentials...",
  depositing: "Submitting capital allocation...",
  executing_batch: "Executing batch conversion at market rate...",
  batch_done: "Execution complete — BTC ready for confidential exit",
  success: "Capital allocation confirmed",
  error: "Transaction failed",
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";

interface ShieldFormProps {
  onComplete?: () => void;
}

export default function ShieldForm({ onComplete }: ShieldFormProps) {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();

  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  const [minting, setMinting] = useState(false);

  const poolAddress = addresses.contracts.shieldedPool;
  const usdcAddress = addresses.contracts.usdc;

  const isLiveMode = isMainnet || addresses.network !== "sepolia";

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress || undefined,
    abi: ERC20_ABI,
    functionName: "balance_of",
    args: address ? [address] : [],
    enabled: !!usdcAddress && !!address,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const balance = usdcBalance ? Number(usdcBalance) / 1_000_000 : 0;

  async function handleMintUsdc() {
    if (!address || !usdcAddress) return;
    setMinting(true);
    try {
      const calls = [{
        contractAddress: usdcAddress,
        entrypoint: "mint",
        calldata: CallData.compile({
          to: address,
          amount: { low: 100_000_000_000n, high: 0n },
        }),
      }];
      await sendAsync(calls);
      toast("success", "100,000 Test USDC minted");
      refetchBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mint failed";
      if (msg.includes("reject") || msg.includes("abort")) {
        toast("error", "Transaction rejected");
      } else {
        toast("error", "Failed to mint test USDC");
      }
    }
    setMinting(false);
  }

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        if (data?.bitcoin?.usd) setBtcPrice(Math.round(data.bitcoin.usd));
      } catch {
        setBtcPrice(97000);
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: currentBatchId } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_current_batch_id",
    args: [],
    enabled: !!poolAddress,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const { data: leafCount } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_leaf_count",
    args: [],
    enabled: !!poolAddress,
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

  const { data: anonSet3 } = useReadContract({
    address: poolAddress || undefined,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_anonymity_set",
    args: [3],
    enabled: !!poolAddress,
    refetchInterval: 10_000,
  } as unknown as Parameters<typeof useReadContract>[0]);

  const anonSets: Record<number, number> = {
    0: anonSet0 ? Number(anonSet0) : 0,
    1: anonSet1 ? Number(anonSet1) : 0,
    2: anonSet2 ? Number(anonSet2) : 0,
    3: anonSet3 ? Number(anonSet3) : 0,
  };

  async function executeBatchAutomatically(): Promise<boolean> {
    try {
      const res = await fetch(`${RELAYER_URL}/execute-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setBatchTxHash(data.txHash);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function handleAccumulate() {
    setError(null);
    setTxHash(null);
    setBatchTxHash(null);

    if (!isConnected || !address) {
      setError("Connect your Starknet wallet first");
      return;
    }
    if (!poolAddress || !usdcAddress) {
      setError("Contracts not deployed yet");
      return;
    }

    const rawAmount = BigInt(DENOMINATIONS[selectedTier]);

    try {
      setPhase("generating_proof");
      const batchId = currentBatchId ? Number(currentBatchId) : 0;
      const leafIdx = leafCount ? Number(leafCount) : 0;
      const btcIdHash = bitcoinAddress ? computeBtcIdentityHash(bitcoinAddress) : "0x0";

      setPhase("generating_zk");
      const note = generatePrivateNote(selectedTier, batchId, leafIdx, btcIdHash !== "0x0" ? btcIdHash : undefined);

      if (bitcoinAddress) {
        setPhase("signing_btc");
        await signCommitment(bitcoinAddress, note.commitment);
      }

      // Save note BEFORE submitting deposit tx — prevents fund loss on browser crash
      await saveNote(note, address);

      setPhase("depositing");
      const calls = [
        {
          contractAddress: usdcAddress,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: poolAddress,
            amount: { low: rawAmount, high: 0n },
          }),
        },
        {
          contractAddress: poolAddress,
          entrypoint: "deposit_private",
          calldata: CallData.compile({
            commitment: note.commitment,
            denomination: selectedTier,
            btc_identity_hash: btcIdHash,
            zk_commitment: note.zkCommitment!,
          }),
        },
      ];
      const result = await sendAsync(calls);
      setTxHash(result.transaction_hash);

      setPhase("executing_batch");
      const batchSuccess = await executeBatchAutomatically();

      if (batchSuccess) {
        setPhase("batch_done");
        toast("success", "Capital converted — ready for confidential exit");
        await new Promise(r => setTimeout(r, 1500));
        setPhase("success");
        if (onComplete) onComplete();
      } else {
        toast("info", "Allocation confirmed — batch conversion will execute automatically");
        setPhase("success");
      }
    } catch (err: unknown) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("User abort") || msg.includes("cancelled") || msg.includes("rejected")) {
        setError("Transaction rejected in wallet");
        toast("error", "Transaction rejected");
      } else if (msg.includes("insufficient") || msg.includes("balance")) {
        setError("Insufficient USDC balance");
        toast("error", "Insufficient USDC balance");
      } else {
        setError(msg);
        toast("error", "Transaction failed");
      }
    }
  }

  const isProcessing =
    phase !== "idle" && phase !== "success" && phase !== "error";
  const canAccumulate = isConnected && !isProcessing;

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col items-center justify-center py-16 gap-6"
          >
            {phase === "batch_done" ? (
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[var(--accent-emerald-dim)] border border-[var(--accent-emerald)]/30 flex items-center justify-center animate-glow-pulse-emerald">
                  <CheckCircle size={32} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                </div>
                {/* Success ring ripple */}
                <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-emerald)]/40 animate-success-ring" />
                <div className="absolute inset-0 rounded-full border border-[var(--accent-emerald)]/20 animate-success-ring" style={{ animationDelay: "0.2s" }} />
              </div>
            ) : (
              <div
                className="w-24 h-24 rounded-full animate-processing-orb"
                style={{
                  background: "radial-gradient(circle at 40% 35%, rgba(124,58,237,0.3) 0%, rgba(124,58,237,0.15) 50%, rgba(124,58,237,0.05) 100%)",
                  border: "1px solid rgba(124,58,237,0.3)",
                }}
              />
            )}
            <div className="text-center space-y-1.5">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                {PHASE_LABELS[phase]}
              </p>
              {phase === "executing_batch" && (
                <p className="text-xs text-[var(--accent-emerald)]/60">
                  Swapping via AVNU at live market rate
                </p>
              )}
              {phase !== "batch_done" && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Do not close this window
                </p>
              )}
            </div>
            {/* Step progress indicator */}
            <div className="flex items-center gap-2 mt-2">
              {["Allocate", "Convert", "Ready"].map((step, i) => {
                const stepPhases: Phase[][] = [
                  ["generating_proof", "generating_zk", "signing_btc", "depositing"],
                  ["executing_batch"],
                  ["batch_done"],
                ];
                const isActive = stepPhases[i].includes(phase);
                const isDone = i === 0
                  ? ["executing_batch", "batch_done"].includes(phase)
                  : i === 1
                    ? phase === "batch_done"
                    : false;
                return (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-6 h-px ${isDone || isActive ? "bg-[var(--accent-emerald)]" : "bg-[var(--border-subtle)]"}`} />}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      isDone ? "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)] border-[var(--accent-emerald)]/30"
                        : isActive ? "bg-[var(--accent-primary-dim)] text-[var(--accent-primary)] border-[var(--accent-primary)]/30"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-subtle)]"
                    }`}>
                      {isDone && <CheckCircle size={10} strokeWidth={2} />}
                      {isActive && <Loader size={10} strokeWidth={2} className="animate-spin" />}
                      {step}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
            {/* Faucet — shown when balance is low */}
            {isConnected && balance < 100 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 bg-violet-50 border border-violet-200/60"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Droplets size={14} strokeWidth={1.5} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isLiveMode ? (
                      <>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">
                          {isMainnet ? "Get USDC" : "Get Sepolia USDC"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
                          {isMainnet
                            ? "Bridge USDC to Starknet to start shielding:"
                            : "This demo uses real Sepolia testnet USDC:"}
                        </p>
                        <ol className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 list-decimal list-inside space-y-1">
                          {isMainnet ? (
                            <>
                              <li>Get USDC on Ethereum</li>
                              <li>Bridge to Starknet via{" "}
                                <a href="https://starkgate.starknet.io/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">StarkGate</a>
                              </li>
                            </>
                          ) : (
                            <>
                              <li>Get Sepolia ETH from a{" "}
                                <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">faucet</a>
                              </li>
                              <li>Get Sepolia USDC from{" "}
                                <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Circle Faucet</a>
                              </li>
                              <li>Bridge to Starknet via{" "}
                                <a href="https://sepolia.starkgate.starknet.io/" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">StarkGate</a>
                              </li>
                            </>
                          )}
                        </ol>
                        <span className="text-xs text-[var(--text-tertiary)] font-[family-name:var(--font-geist-mono)]">
                          Balance: {balance.toLocaleString()} USDC
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">
                          Get Test USDC
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                          Mint free test USDC to try the full accumulation flow.
                        </p>
                        <div className="flex items-center gap-3">
                          <motion.button
                            onClick={handleMintUsdc}
                            disabled={minting || !address}
                            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            whileTap={{ scale: 0.97 }}
                            transition={spring}
                          >
                            <Droplets size={12} strokeWidth={2} />
                            {minting ? "Minting..." : "Mint 100K USDC"}
                          </motion.button>
                          <span className="text-xs text-[var(--text-tertiary)] font-[family-name:var(--font-geist-mono)]">
                            Balance: {balance.toLocaleString()} USDC
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* USDC Balance */}
            {isConnected && balance >= 100 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-[var(--text-tertiary)]">
                  {isLiveMode ? `${NETWORK_LABEL} USDC Balance` : "Test USDC Balance"}
                </span>
                <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                  {balance.toLocaleString()} USDC
                </span>
              </div>
            )}

            {/* Tranche Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-[var(--text-tertiary)]">
                  Select Capital Tier
                </span>
                {btcPrice && (
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-[family-name:var(--font-geist-mono)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
                    BTC ${btcPrice.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(DENOMINATIONS).map(([tier, amount]) => {
                  const tierNum = Number(tier);
                  const isSelected = selectedTier === tierNum;
                  const usdcAmount = amount / 1_000_000;
                  const btcEstimate = btcPrice ? (usdcAmount / btcPrice) : null;
                  const anonCount = anonSets[tierNum];
                  const privacyColor = anonCount >= 10 ? "emerald" : anonCount >= 3 ? "amber" : "dim";
                  return (
                    <motion.button
                      key={tier}
                      onClick={() => setSelectedTier(tierNum)}
                      className={`relative py-4 px-2 rounded-xl text-center transition-all cursor-pointer border active:scale-95 ${
                        isSelected
                          ? "bg-violet-600 text-white border-violet-600 shadow-[0_0_20px_rgba(124,58,237,0.2)]"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-violet-300 hover-glow"
                      }`}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                    >
                      <div className="text-xl sm:text-[22px] font-[family-name:var(--font-geist-mono)] font-bold tracking-tight font-tabular">
                        ${usdcAmount.toLocaleString()}
                      </div>
                      {btcEstimate !== null && (
                        <div className={`text-[10px] mt-1 font-[family-name:var(--font-geist-mono)] ${
                          isSelected ? "text-white/50" : "text-[var(--text-quaternary)]"
                        }`}>
                          {btcEstimate.toFixed(btcEstimate < 0.001 ? 6 : 4)} BTC
                        </div>
                      )}
                      {/* Privacy indicator bar */}
                      <div className="mt-2 mx-auto w-full max-w-[48px]">
                        <div className="h-0.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(anonCount / 15, 1) * 100}%`,
                              background: isSelected ? "rgba(255,255,255,0.5)" : privacyColor === "emerald" ? "var(--accent-emerald)" : privacyColor === "amber" ? "var(--accent-amber)" : "var(--text-quaternary)",
                            }}
                          />
                        </div>
                        <div className={`text-[9px] mt-0.5 font-medium ${
                          isSelected ? "text-white/50" : privacyColor === "emerald" ? "text-[var(--accent-emerald)]" : privacyColor === "amber" ? "text-[var(--accent-amber)]" : "text-[var(--text-quaternary)]"
                        }`}>
                          {anonCount} shielded
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-quaternary)]">
                <Shield size={10} strokeWidth={1.5} />
                <span>Fixed tiers make all deposits indistinguishable</span>
              </div>
            </div>

            {/* Accumulate Button */}
            <motion.button
              onClick={handleAccumulate}
              disabled={!canAccumulate}
              className="btn-shimmer w-full py-4 bg-gray-900 text-white rounded-2xl text-[15px] font-semibold tracking-tight
                         disabled:opacity-20 disabled:cursor-not-allowed
                         cursor-pointer transition-all flex items-center justify-center gap-2
                         shadow-lg active:scale-[0.98]"
              whileHover={canAccumulate ? { y: -2, boxShadow: "0 20px 40px rgba(0,0,0,0.15)" } : {}}
              whileTap={canAccumulate ? { scale: 0.98 } : {}}
              transition={spring}
            >
              Shield Capital
              <ArrowRight size={16} strokeWidth={1.5} />
            </motion.button>

            {!isConnected && (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                Connect your Starknet wallet to begin
              </p>
            )}

            {error && phase === "idle" && (
              <p className="text-[12px] text-[var(--accent-red)] text-center">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success / Error States */}
      <AnimatePresence>
        {(phase === "success" || phase === "error") && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="mt-6"
          >
            <div className={`rounded-2xl p-5 border ${
              phase === "success"
                ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/20"
                : "bg-[var(--accent-red)]/10 border-[var(--accent-red)]/20"
            }`}>
              <div className="flex items-center gap-2.5">
                {phase === "success" ? (
                  <CheckCircle size={16} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                ) : (
                  <AlertTriangle size={14} strokeWidth={1.5} className="text-[var(--accent-red)]" />
                )}
                <span className={`text-[13px] font-medium ${
                  phase === "success" ? "text-[var(--accent-emerald)]" : "text-[var(--accent-red)]"
                }`}>
                  {PHASE_LABELS[phase]}
                </span>
              </div>
              {txHash && (
                <a
                  href={`${EXPLORER_TX}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]"
                >
                  Deposit tx &rarr;
                </a>
              )}
              {batchTxHash && (
                <a
                  href={`${EXPLORER_TX}${batchTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)]"
                >
                  Conversion tx &rarr;
                </a>
              )}
              {error && phase === "error" && (
                <p className="mt-2 text-xs text-[var(--accent-red)] break-all">{error}</p>
              )}
              {phase === "success" && (
                <div className="mt-3 space-y-3">
                  {batchTxHash ? (
                    <p className="text-xs text-[var(--accent-emerald)]">
                      Capital converted. Proceed to <strong>Confidential Exit</strong> to claim BTC.
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Capital allocated to privacy pool. Batch conversion will execute automatically.
                      Once converted, use <strong className="text-[var(--text-secondary)]">Confidential Exit</strong> to claim BTC.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setPhase("idle"); setTxHash(null); setBatchTxHash(null); }}
                      className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      Allocate more
                    </button>
                    {batchTxHash && onComplete && (
                      <button
                        onClick={onComplete}
                        className="text-[12px] font-semibold text-[var(--accent-emerald)] hover:text-[var(--accent-emerald)]/80 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        Confidential Exit <ArrowRight size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
