"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { generatePrivateNote, saveNote, DENOMINATIONS, DENOMINATION_LABELS } from "@/utils/privacy";
import { signCommitment, computeBtcIdentityHash } from "@/utils/bitcoin";
import { AlertTriangle, Shield, ExternalLink, Droplets } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import addresses from "@/contracts/addresses.json";
import { SHIELDED_POOL_ABI, ERC20_ABI } from "@/contracts/abi";
import { CallData } from "starknet";

type Phase =
  | "idle"
  | "signing_btc"
  | "generating_proof"
  | "generating_zk"
  | "depositing"
  | "success"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  signing_btc: "Bitcoin wallet signing commitment hash...",
  generating_proof: "Computing Pedersen commitment & BTC identity...",
  generating_zk: "Generating zero-knowledge commitment...",
  depositing: "Depositing to shielded pool & triggering batch swap...",
  success: "Shielded successfully",
  error: "Shield failed",
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const SEPOLIA_EXPLORER = "https://sepolia.starkscan.co/tx/";

export default function ShieldForm() {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();

  const [selectedTier, setSelectedTier] = useState<number>(1); // Default: 1000 USDC
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);

  const [minting, setMinting] = useState(false);

  const poolAddress = addresses.contracts.shieldedPool;
  const usdcAddress = addresses.contracts.usdc;

  // Read USDC balance
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
          amount: { low: 100_000_000_000n, high: 0n }, // 100,000 USDC
        }),
      }];
      await sendAsync(calls);
      toast("success", "100,000 Test USDC minted to your wallet");
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

  // Fetch live BTC price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        if (data?.bitcoin?.usd) setBtcPrice(Math.round(data.bitcoin.usd));
      } catch {
        setBtcPrice(97000); // Fallback
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000); // Refresh every 60s
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

  const anonSets: Record<number, number> = {
    0: anonSet0 ? Number(anonSet0) : 0,
    1: anonSet1 ? Number(anonSet1) : 0,
    2: anonSet2 ? Number(anonSet2) : 0,
  };

  async function handleShield() {
    setError(null);
    setTxHash(null);

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
        // Auto-execute batch (permissionless — anyone can trigger)
        {
          contractAddress: poolAddress,
          entrypoint: "execute_batch",
          calldata: CallData.compile({
            min_wbtc_out: { low: 0n, high: 0n },
            routes: [],
          }),
        },
      ];
      const result = await sendAsync(calls);
      setTxHash(result.transaction_hash);

      // Save note with encryption
      await saveNote(note, address);

      setPhase("success");
      toast("success", "USDC shielded and batch swap triggered");
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
        toast("error", "Shield failed");
      }
    }
  }

  const isProcessing =
    phase !== "idle" && phase !== "success" && phase !== "error";
  const canShield = isConnected && !isProcessing;

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
            <div
              className="w-24 h-24 rounded-full animate-processing-orb"
              style={{
                background: "radial-gradient(circle at 40% 35%, #2A2A30 0%, #1A1A1F 50%, #131316 100%)",
                boxShadow: "0 0 60px rgba(255, 90, 0, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            />
            <div className="text-center space-y-1.5">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                {PHASE_LABELS[phase]}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Do not close this window
              </p>
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
                className="rounded-2xl p-4 bg-orange-950/20 border border-orange-800/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-950/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Droplets size={14} strokeWidth={1.5} className="text-[var(--accent-orange)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5">
                      Get Test USDC
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-3">
                      This is a Sepolia testnet demo. Mint free test USDC to try the full Shield → Batch → Unveil flow.
                    </p>
                    <div className="flex items-center gap-3">
                      <motion.button
                        onClick={handleMintUsdc}
                        disabled={minting || !address}
                        className="px-4 py-2 bg-[var(--accent-orange)] text-white rounded-xl text-[12px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        whileTap={{ scale: 0.97 }}
                        transition={spring}
                      >
                        <Droplets size={12} strokeWidth={2} />
                        {minting ? "Minting..." : "Mint 100K USDC"}
                      </motion.button>
                      <span className="text-[10px] text-[var(--text-quaternary)] font-[family-name:var(--font-geist-mono)]">
                        Balance: {balance.toLocaleString()} USDC
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* USDC Balance indicator */}
            {isConnected && balance >= 100 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] text-[var(--text-tertiary)]">Wallet Balance</span>
                <span className="text-[12px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                  {balance.toLocaleString()} USDC
                </span>
              </div>
            )}

            {/* Denomination Selector */}
            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] block">
                Select Amount
              </span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DENOMINATIONS).map(([tier, amount]) => {
                  const tierNum = Number(tier);
                  const isSelected = selectedTier === tierNum;
                  const usdcAmount = amount / 1_000_000; // Convert from 6-decimal raw to human
                  const btcEstimate = btcPrice ? (usdcAmount / btcPrice) : null;
                  return (
                    <motion.button
                      key={tier}
                      onClick={() => setSelectedTier(tierNum)}
                      className={`relative py-4 rounded-xl text-center transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[var(--accent-orange)] text-white border-[var(--accent-orange)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]"
                      }`}
                      whileTap={{ scale: 0.97 }}
                      transition={spring}
                    >
                      <div className="text-[22px] font-[family-name:var(--font-geist-mono)] font-bold tracking-tight font-tabular">
                        {usdcAmount.toLocaleString()}
                      </div>
                      <div className={`text-[11px] mt-0.5 font-medium ${
                        isSelected ? "text-white/60" : "text-[var(--text-tertiary)]"
                      }`}>
                        USDC
                      </div>
                      {btcEstimate !== null && (
                        <div className={`text-[10px] mt-0.5 font-[family-name:var(--font-geist-mono)] ${
                          isSelected ? "text-white/40" : "text-[var(--text-quaternary)]"
                        }`}>
                          ~{btcEstimate.toFixed(btcEstimate < 0.01 ? 5 : 3)} BTC
                        </div>
                      )}
                      <div className={`text-[10px] mt-1 font-medium ${
                        isSelected
                          ? "text-white/50"
                          : anonSets[tierNum] >= 10
                            ? "text-emerald-500"
                            : anonSets[tierNum] >= 3
                              ? "text-amber-500"
                              : "text-[var(--text-tertiary)]"
                      }`}>
                        {anonSets[tierNum]} in set
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                <span>Fixed denominations ensure all deposits are indistinguishable</span>
              </div>
              {btcPrice && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[var(--text-quaternary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BTC ${btcPrice.toLocaleString()} — live rate applied on-chain at swap
                </div>
              )}
            </div>

            {/* Shield Button */}
            <motion.button
              onClick={handleShield}
              disabled={!canShield}
              className="w-full py-4.5 bg-[var(--accent-orange)] text-white rounded-2xl text-[15px] font-semibold tracking-tight
                         disabled:opacity-20 disabled:cursor-not-allowed
                         cursor-pointer transition-all flex items-center justify-center gap-2"
              whileHover={canShield ? { y: -1, boxShadow: "var(--shadow-xl)" } : {}}
              whileTap={canShield ? { scale: 0.985 } : {}}
              transition={spring}
            >
              <Shield size={16} strokeWidth={1.5} />
              Shield {DENOMINATION_LABELS[selectedTier]}
            </motion.button>

            {/* Wallet Hints */}
            {!isConnected && (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                Connect Starknet wallet to shield assets
              </p>
            )}
            {isConnected && !bitcoinAddress && (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                Bitcoin wallet optional — connect for BTC identity linking
              </p>
            )}

            {error && phase === "idle" && (
              <p className="text-[12px] text-red-500 text-center">{error}</p>
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
            <div className={`rounded-2xl p-5 ${
              phase === "success"
                ? "bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                : "bg-red-950/30 border border-red-900/30"
            }`}>
              <div className="flex items-center gap-2.5">
                {phase === "success" ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
                ) : (
                  <AlertTriangle size={14} strokeWidth={1.5} className="text-red-500" />
                )}
                <span className={`text-[13px] font-medium ${
                  phase === "success" ? "text-[var(--text-primary)]" : "text-red-400"
                }`}>
                  {PHASE_LABELS[phase]}
                </span>
              </div>
              {txHash && (
                <a
                  href={`${SEPOLIA_EXPLORER}${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--accent-orange)] hover:underline font-[family-name:var(--font-geist-mono)]"
                >
                  View on Starkscan
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              )}
              {error && phase === "error" && (
                <p className="mt-2 text-[11px] text-red-500 break-all">{error}</p>
              )}
              {phase === "success" && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Your USDC has been swapped to WBTC via batch execution. A 60-second privacy cooldown
                    is now active — switch to the <strong>Unveil</strong> tab to see the countdown and claim your WBTC.
                  </p>
                  <button
                    onClick={() => { setPhase("idle"); setTxHash(null); }}
                    className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    Shield more
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
