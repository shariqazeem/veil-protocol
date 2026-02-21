"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import { useSendTransaction } from "@starknet-react/core";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import {
  generatePrivateNote,
  saveNote,
  DENOMINATIONS,
} from "@/utils/privacy";
import { computeBtcIdentityHash } from "@/utils/bitcoin";
import {
  generateStrategy,
  generateAgentLog,
  parseTargetUsdc,
  type AgentPlan,
  type AgentStep,
  type AgentLogEntry,
  type PoolState,
} from "@/utils/strategyEngine";
import { EXPLORER_TX, RPC_URL } from "@/utils/network";
import { createPaymentPayloadDefault } from "@/utils/x402";
import { encodePaymentSignature, HTTP_HEADERS } from "x402-starknet";
import addresses from "@/contracts/addresses.json";
import { CallData, RpcProvider } from "starknet";
import { motion, AnimatePresence } from "framer-motion";
import { useTelegram } from "@/context/TelegramContext";
import {
  ArrowRight,
  Brain,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  Shield,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Zap,
} from "lucide-react";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "/api/relayer";
const poolAddress = addresses.contracts.shieldedPool;
const usdcAddress = addresses.contracts.usdc;

type StepStatus = "pending" | "waiting" | "executing" | "done" | "error";

interface ExecutionStep extends AgentStep {
  status: StepStatus;
  txHash?: string;
  error?: string;
}

type AgentPhase = "idle" | "thinking" | "planned" | "executing" | "complete";

const EXAMPLE_PROMPTS = [
  "Deposit $100 with max privacy",
  "DCA $50 over 5 deposits",
  "Quick $10 deposit",
  "Spread $200 across tiers",
];

const LOG_DOT_COLORS: Record<AgentLogEntry["type"], string> = {
  observe: "bg-blue-400/60",
  think: "bg-[#4D4DFF]/60",
  decide: "bg-[var(--accent-emerald)]/60",
  act: "bg-[var(--accent-orange)]/60",
  result: "bg-[var(--text-primary)]/40",
};

export default function AgentTab() {
  const { address, isConnected, account } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { isTelegram, webApp } = useTelegram();

  // State
  const [input, setInput] = useState("");
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [visibleLogCount, setVisibleLogCount] = useState(0);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null);
  const [btcPrice, setBtcPrice] = useState(0);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [countdown, setCountdown] = useState(0);

  // Premium x402 analysis state
  const [premiumData, setPremiumData] = useState<Record<string, unknown> | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  // x402 flow phases: idle → requesting → signing → settling → complete
  type X402Phase = "idle" | "requesting" | "signing" | "settling" | "complete";
  const [x402Phase, setX402Phase] = useState<X402Phase>("idle");
  const [x402TxHash, setX402TxHash] = useState<string | null>(null);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch pool state
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/agent/status");
        if (!res.ok) return;
        const data = await res.json();
        setPoolState({
          pendingUsdc: data.pendingUsdc,
          batchCount: data.batchCount,
          leafCount: data.leafCount,
          anonSets: data.anonSets,
          btcPrice: data.btcPrice,
        });
        setBtcPrice(data.btcPrice);
      } catch {
        setBtcPrice(0);
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-load strategy from URL params and trigger planning
  const deepLinkTriggered = useRef(false);
  useEffect(() => {
    const encoded = searchParams.get("strategy");
    if (!encoded || input || deepLinkTriggered.current) return;
    try {
      const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
      const decoded = JSON.parse(json);
      if (decoded.input && typeof decoded.input === "string") {
        deepLinkTriggered.current = true;
        setInput(decoded.input);
        window.history.replaceState({}, "", "/app");
      }
    } catch { /* ignore */ }
  }, [searchParams, input]);

  // Auto-trigger strategy planning once deep link input is set and BTC price is available
  useEffect(() => {
    if (!deepLinkTriggered.current || !input || agentPhase !== "idle") return;
    if (!btcPrice || btcPrice <= 0) return;
    // Clear flag so it only fires once, then trigger planning
    deepLinkTriggered.current = false;
    handlePlanStrategy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, btcPrice, agentPhase]);

  // Stream logs
  useEffect(() => {
    if (agentLogs.length === 0 || visibleLogCount >= agentLogs.length) return;
    const timer = setTimeout(() => {
      setVisibleLogCount((c) => c + 1);
    }, 120 + Math.random() * 180);
    return () => clearTimeout(timer);
  }, [agentLogs, visibleLogCount]);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLogCount, executionSteps]);

  // Logs done → show plan
  useEffect(() => {
    if (agentPhase === "thinking" && visibleLogCount >= agentLogs.length && agentLogs.length > 0) {
      setAgentPhase("planned");
    }
  }, [agentPhase, visibleLogCount, agentLogs.length]);

  function emitLog(type: AgentLogEntry["type"], message: string) {
    const entry: AgentLogEntry = { timestamp: Date.now(), type, message };
    setAgentLogs((prev) => [...prev, entry]);
    setVisibleLogCount((c) => c + 1);
  }

  // Plan generation
  async function handlePlanStrategy() {
    const target = parseTargetUsdc(input);
    if (!target || target <= 0) {
      toast("error", "Please describe an amount — e.g. '$50' or '100 dollars'");
      return;
    }
    if (!btcPrice || btcPrice <= 0) {
      toast("error", "Fetching live BTC price... please wait a moment");
      return;
    }

    setPlan(null);
    setExecutionSteps([]);
    setBatchTxHash(null);
    setAgentPhase("thinking");

    const state = poolState ?? {
      pendingUsdc: 0, batchCount: 0, leafCount: 0,
      anonSets: { 0: 0, 1: 0, 2: 0 }, btcPrice: btcPrice || 0,
    };

    const logs = generateAgentLog(target, state, btcPrice || 0, input);
    setAgentLogs(logs);
    setVisibleLogCount(0);

    const result = generateStrategy(target, state, btcPrice || 0, input);
    setPlan(result);
  }

  // x402 Premium Strategy Analysis — Real Payment Flow
  // Tries x402 paymaster flow first; falls back to direct wallet transfer
  async function handlePremiumAnalysis() {
    setPremiumError(null);
    setPremiumData(null);
    setX402TxHash(null);

    if (!account || !isConnected || !address) {
      setPremiumError("Connect your wallet to unlock premium analysis");
      return;
    }

    try {
      // Step 1: Hit x402-gated endpoint → receive real 402 Payment Required
      setX402Phase("requesting");
      const initialRes = await fetch(`/api/agent/premium-strategy?input=${encodeURIComponent(input || "analyze pool")}`);

      if (initialRes.status !== 402) {
        if (initialRes.ok) {
          setPremiumData(await initialRes.json());
          setX402Phase("complete");
          return;
        }
        throw new Error(`Unexpected response: ${initialRes.status}`);
      }

      const paymentRequired = await initialRes.json();
      const requirements = paymentRequired.accepts?.[0];
      if (!requirements) throw new Error("Invalid 402 response — no payment requirements");

      // Step 2: Build x402 payment via paymaster (default mode — user pays gas in STRK)
      setX402Phase("signing");

      const network = requirements.network?.includes("mainnet")
        ? ("starknet:mainnet" as const)
        : ("starknet:sepolia" as const);
      const payload = await createPaymentPayloadDefault(account, requirements, network);
      const x402Header = encodePaymentSignature(payload);

      // Step 3: Re-request premium endpoint with x402 payment header — server settles
      setX402Phase("settling");

      const paidRes = await fetch(
        `/api/agent/premium-strategy?input=${encodeURIComponent(input || "analyze pool")}`,
        { headers: { [HTTP_HEADERS.PAYMENT_SIGNATURE]: x402Header } },
      );

      if (!paidRes.ok) {
        const errData = await paidRes.json().catch(() => ({}));
        throw new Error(errData.error ?? errData.reason ?? `Payment failed (${paidRes.status})`);
      }

      const analysis = await paidRes.json();
      setPremiumData(analysis);

      const txHash = analysis.payment?.transaction ?? null;
      if (txHash) setX402TxHash(txHash);
      setX402Phase("complete");
      toast("success", "Premium analysis unlocked");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg.includes("reject") || msg.includes("abort") || msg.includes("cancel") || msg.includes("denied") || msg.includes("REFUSED")) {
        setPremiumError("Payment cancelled — you were not charged");
      } else {
        setPremiumError(msg);
      }
      setX402Phase("idle");
    }
  }

  // Strategy execution (same logic, no UI changes needed)
  const executeStrategy = useCallback(async () => {
    if (!plan || !isConnected || !address) return;

    setAgentPhase("executing");
    const steps: ExecutionStep[] = plan.strategy.steps.map((s) => ({
      ...s, status: "pending" as StepStatus,
    }));
    setExecutionSteps(steps);

    const isDCA = steps.length > 1 && steps.some((s) => s.delaySeconds > 0);
    emitLog("act", `Initiating execution: ${steps.length} deposit${steps.length > 1 ? "s" : ""}`);

    try {
      const btcIdHash = bitcoinAddress ? computeBtcIdentityHash(bitcoinAddress) : "0x0";

      if (isDCA) {
        emitLog("think", `Autonomous DCA with temporal decorrelation`);

        const totalRaw = steps.reduce((sum, s) => sum + BigInt(DENOMINATIONS[s.tier]), 0n);

        emitLog("act", `Requesting USDC approval for $${plan.strategy.totalUsdc}`);
        const relayerInfoRes = await fetch(`${RELAYER_URL}/info`);
        const relayerInfo = await relayerInfoRes.json();
        const relayerAddress = relayerInfo.relayerAddress;
        if (!relayerAddress) throw new Error("Relayer not available");

        const approveCalls = [{
          contractAddress: usdcAddress,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: relayerAddress,
            amount: { low: totalRaw, high: 0n },
          }),
        }];

        const approveResult = await sendAsync(approveCalls);
        emitLog("think", `Waiting for on-chain confirmation...`);

        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        await provider.waitForTransaction(approveResult.transaction_hash);
        emitLog("result", `Approved — relayer executing autonomously`);

        for (let i = 0; i < steps.length; i++) {
          if (i > 0 && steps[i].delaySeconds > 0) {
            const delay = steps[i].delaySeconds;
            emitLog("think", `Waiting ${delay}s before next deposit...`);

            setExecutionSteps((prev) =>
              prev.map((s, idx) => idx === i ? { ...s, status: "waiting" } : s)
            );
            setCurrentStepIdx(i);

            for (let sec = delay; sec > 0; sec--) {
              setCountdown(sec);
              await new Promise((r) => setTimeout(r, 1000));
            }
            setCountdown(0);
          }

          const note = generatePrivateNote(steps[i].tier, 0, 0, btcIdHash !== "0x0" ? btcIdHash : undefined);
          const rawAmount = DENOMINATIONS[steps[i].tier].toString();

          setExecutionSteps((prev) =>
            prev.map((s, idx) => idx === i ? { ...s, status: "executing" } : s)
          );
          setCurrentStepIdx(i);
          emitLog("act", `Deposit ${i + 1}/${steps.length}: ${steps[i].label} USDC`);

          const res = await fetch(`${RELAYER_URL}/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              depositor: address,
              commitment: note.commitment,
              denomination: steps[i].tier,
              btc_identity_hash: btcIdHash,
              zk_commitment: note.zkCommitment!,
              usdc_amount: rawAmount,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error ?? "Relayer deposit failed");

          await saveNote(note, address);

          setExecutionSteps((prev) =>
            prev.map((s, idx) => idx === i ? { ...s, status: "done", txHash: data.txHash } : s)
          );
          emitLog("result", `Confirmed: ${data.txHash.slice(0, 18)}...`);
        }

        emitLog("result", `All ${steps.length} deposits confirmed`);
      } else {
        emitLog("think", `Batching ${steps.length} deposit${steps.length > 1 ? "s" : ""} in single transaction`);

        const notes = [];
        const allCalls = [];

        for (let i = 0; i < steps.length; i++) {
          const note = generatePrivateNote(steps[i].tier, 0, 0, btcIdHash !== "0x0" ? btcIdHash : undefined);
          notes.push(note);

          const rawAmount = BigInt(DENOMINATIONS[steps[i].tier]);

          allCalls.push({
            contractAddress: usdcAddress,
            entrypoint: "approve",
            calldata: CallData.compile({
              spender: poolAddress,
              amount: { low: rawAmount, high: 0n },
            }),
          });
          allCalls.push({
            contractAddress: poolAddress,
            entrypoint: "deposit_private",
            calldata: CallData.compile({
              commitment: note.commitment,
              denomination: steps[i].tier,
              btc_identity_hash: btcIdHash,
              zk_commitment: note.zkCommitment!,
            }),
          });

          emitLog("act", `Prepared deposit ${i + 1}/${steps.length}: ${steps[i].label} USDC`);
        }

        emitLog("act", `Submitting multicall...`);

        const updatedSteps = steps.map((s) => ({ ...s, status: "executing" as StepStatus }));
        setExecutionSteps(updatedSteps);

        const result = await sendAsync(allCalls);

        for (const note of notes) {
          await saveNote(note, address);
        }

        const doneSteps = updatedSteps.map((s) => ({
          ...s, status: "done" as StepStatus, txHash: result.transaction_hash,
        }));
        setExecutionSteps(doneSteps);
        emitLog("result", `All deposits confirmed: ${result.transaction_hash.slice(0, 18)}...`);
      }

      emitLog("act", "Triggering batch conversion...");
      try {
        const res = await fetch(`${RELAYER_URL}/execute-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (data.success) {
          setBatchTxHash(data.txHash);
          emitLog("result", `Converted to BTC: ${data.txHash.slice(0, 14)}...`);
          toast("success", "Batch converted — BTC ready for exit");
        } else {
          emitLog("result", "Batch queued for automatic execution");
        }
      } catch {
        emitLog("result", "Batch queued for automatic execution");
      }
      emitLog("result", "Complete. Proceed to Confidential Exit.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setExecutionSteps((prev) =>
        prev.map((s) => s.status !== "done" ? { ...s, status: "error" as StepStatus, error: msg } : s)
      );

      if (msg.includes("reject") || msg.includes("abort") || msg.includes("cancel") || msg.includes("REFUSED")) {
        emitLog("result", "Rejected by wallet.");
        toast("error", "Transaction rejected");
      } else {
        emitLog("result", `Failed: ${msg.slice(0, 80)}`);
        toast("error", "Execution failed");
      }
    }

    setAgentPhase("complete");
    setCurrentStepIdx(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isConnected, address, bitcoinAddress, sendAsync, toast]);

  // Telegram MainButton integration
  useEffect(() => {
    if (!isTelegram || !webApp) return;
    const mb = webApp.MainButton;

    if (agentPhase === "planned" && isConnected) {
      mb.setText("Confirm & Execute");
      mb.show();
      mb.enable();
      const handler = () => { executeStrategy(); };
      mb.onClick(handler);
      return () => {
        mb.offClick(handler);
        mb.hide();
      };
    } else if (agentPhase === "complete") {
      mb.setText("Close");
      mb.show();
      mb.enable();
      const handler = () => webApp.close();
      mb.onClick(handler);
      return () => {
        mb.offClick(handler);
        mb.hide();
      };
    } else {
      mb.hide();
    }
  }, [isTelegram, webApp, agentPhase, isConnected, executeStrategy]);

  // Render helpers
  const completedSteps = executionSteps.filter((s) => s.status === "done").length;
  const isRunning = agentPhase === "thinking" || agentPhase === "executing";
  const visibleLogs = agentLogs.slice(0, visibleLogCount);

  return (
    <div className="space-y-5">
      {/* Header with live indicators */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[rgba(77,77,255,0.08)] border border-[#4D4DFF]/20 flex items-center justify-center">
            <Brain size={14} strokeWidth={1.5} className="text-[#4D4DFF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              AI Strategist
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-['JetBrains_Mono']">
              {btcPrice > 0
                ? `BTC $${btcPrice.toLocaleString()}`
                : "Connecting..."
              }
              {poolState && ` · ${poolState.leafCount} notes`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-emerald-dim)] border border-[var(--accent-emerald)]/15">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse-dot" />
          <span className="text-[10px] text-[var(--accent-emerald)] font-semibold uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Input — idle state */}
      <AnimatePresence mode="wait">
        {agentPhase === "idle" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. $50 max privacy, DCA $100 over 5 deposits..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePlanStrategy();
                  }
                }}
                className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] resize-none focus:outline-none focus:border-[#4D4DFF]/40 transition-colors"
              />
              <button
                onClick={handlePlanStrategy}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#4D4DFF] hover:bg-[#4D4DFF]/80 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center"
              >
                <ArrowRight size={14} strokeWidth={2} className="text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <motion.button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal — active states */}
      {agentPhase !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
        >
          {/* Terminal chrome — macOS style dots */}
          <div className="px-4 py-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            </div>
            <span className="ml-2 text-xs text-[var(--text-quaternary)] font-['JetBrains_Mono']">
              veil-strategist
            </span>
            <div className="ml-auto">
              {isRunning && (
                <Loader2 size={12} strokeWidth={2} className="text-[#4D4DFF] animate-spin" />
              )}
              {agentPhase === "complete" && (
                <Check size={12} strokeWidth={2} className="text-[var(--accent-emerald)]" />
              )}
            </div>
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="px-4 pb-4 max-h-64 overflow-y-auto scrollbar-thin"
          >
            <div className="space-y-1">
              {visibleLogs.map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 py-0.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${LOG_DOT_COLORS[log.type]}`} />
                  <span className="text-xs text-[var(--text-secondary)] leading-relaxed font-['JetBrains_Mono']">
                    {log.message}
                  </span>
                </motion.div>
              ))}

              {/* TX results */}
              {executionSteps.map((step, idx) => {
                if (step.status === "done" && step.txHash) {
                  const isDuplicate = idx > 0 && executionSteps[idx - 1]?.txHash === step.txHash;
                  if (isDuplicate) return null;
                  const count = executionSteps.filter((s) => s.txHash === step.txHash).length;
                  return (
                    <motion.div
                      key={`tx-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2.5 py-0.5"
                    >
                      <Check size={10} strokeWidth={2.5} className="text-[var(--accent-emerald)] mt-1 flex-shrink-0" />
                      <a
                        href={`${EXPLORER_TX}${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent-emerald)]/80 hover:text-[var(--accent-emerald)] font-['JetBrains_Mono'] flex items-center gap-1 leading-relaxed"
                      >
                        {count > 1 ? `${count} deposits` : `Deposit ${idx + 1}`} · {step.txHash.slice(0, 14)}...
                        <ExternalLink size={8} strokeWidth={2} />
                      </a>
                    </motion.div>
                  );
                }
                return null;
              })}

              {/* Errors */}
              {executionSteps.some((s) => s.status === "error") && (
                <div className="flex items-start gap-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[var(--accent-red)]" />
                  <span className="text-xs text-[var(--accent-red)]/80 font-['JetBrains_Mono'] leading-relaxed">
                    {executionSteps.find((s) => s.status === "error")?.error?.slice(0, 80)}
                  </span>
                </div>
              )}

              {/* Batch tx */}
              {batchTxHash && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[var(--accent-orange)]" />
                  <a
                    href={`${EXPLORER_TX}${batchTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent-orange)]/80 hover:text-[var(--accent-orange)] font-['JetBrains_Mono'] flex items-center gap-1 leading-relaxed"
                  >
                    BTC conversion · {batchTxHash.slice(0, 14)}...
                    <ExternalLink size={8} strokeWidth={2} />
                  </a>
                </motion.div>
              )}

              {/* DCA countdown */}
              {countdown > 0 && (
                <div className="flex items-center gap-2.5 py-1">
                  <Loader2 size={10} strokeWidth={2} className="text-[#FF9900] animate-spin flex-shrink-0" />
                  <span className="text-xs text-[#FF9900] font-['JetBrains_Mono']">
                    Next deposit in {countdown}s
                  </span>
                </div>
              )}

              {/* Blinking cursor */}
              {isRunning && countdown === 0 && (
                <div className="flex items-center gap-2.5 py-0.5">
                  <span className="w-1.5 h-3 bg-[#4D4DFF]/60 animate-pulse rounded-sm" />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Strategy card */}
      <AnimatePresence>
        {plan && agentPhase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
          >
            {/* Progress bar — thin, elegant */}
            {executionSteps.length > 0 && (
              <div className="h-0.5 bg-[var(--bg-elevated)]">
                <motion.div
                  className="h-full bg-[var(--accent-emerald)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedSteps / executionSteps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Metrics row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[11px] text-[var(--text-tertiary)] block">Total</span>
                    <span className="text-base font-['JetBrains_Mono'] font-bold text-[var(--text-primary)] font-tabular">
                      ${plan.strategy.totalUsdc.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[var(--border-subtle)]" />
                  <div>
                    <span className="text-[11px] text-[var(--text-tertiary)] block">Est. BTC</span>
                    <span className="text-base font-['JetBrains_Mono'] font-bold text-[var(--accent-orange)] font-tabular">
                      {plan.strategy.estimatedBtc}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[var(--border-subtle)]" />
                  <div>
                    <span className="text-[11px] text-[var(--text-tertiary)] block">Privacy</span>
                    <span className="text-sm font-semibold text-[var(--accent-emerald)]">
                      {plan.strategy.privacyScore.split("(")[0].trim()}
                    </span>
                  </div>
                </div>

                {executionSteps.length > 0 && (
                  <span className="text-xs font-['JetBrains_Mono'] text-[var(--text-tertiary)] font-tabular">
                    {completedSteps}/{executionSteps.length}
                  </span>
                )}
              </div>

              {/* Deposit breakdown — pill list */}
              <div className="flex flex-wrap gap-1.5">
                {plan.strategy.steps.map((step, i) => {
                  const status = executionSteps[i]?.status;
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-['JetBrains_Mono'] font-medium transition-colors ${
                        status === "done"
                          ? "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]"
                          : status === "executing" || status === "waiting"
                            ? "bg-[rgba(77,77,255,0.08)] text-[#4D4DFF]"
                            : status === "error"
                              ? "bg-red-500/10 text-[var(--accent-red)]"
                              : "bg-[var(--bg-elevated)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      {status === "done" && <Check size={9} strokeWidth={3} />}
                      {(status === "executing" || status === "waiting") && <Loader2 size={9} strokeWidth={2} className="animate-spin" />}
                      ${step.label}
                    </span>
                  );
                })}
              </div>

              {/* Execute button */}
              {agentPhase === "planned" && (
                <motion.button
                  onClick={executeStrategy}
                  disabled={!isConnected}
                  className="w-full py-3 bg-[#4D4DFF] hover:bg-[#4D4DFF]/80 text-white rounded-xl text-sm font-semibold
                             disabled:opacity-30 disabled:cursor-not-allowed
                             cursor-pointer transition-all flex items-center justify-center gap-2"
                  whileTap={isConnected ? { scale: 0.985 } : {}}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Confirm &amp; Execute
                </motion.button>
              )}

              {/* Complete state */}
              {agentPhase === "complete" && (
                <div className="space-y-3">
                  {batchTxHash && (
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-[var(--accent-emerald-dim)] border border-[var(--accent-emerald)]/10">
                      <Check size={12} strokeWidth={2} className="text-[var(--accent-emerald)]" />
                      <span className="text-xs font-medium text-[var(--accent-emerald)]">
                        BTC conversion complete
                      </span>
                      <a
                        href={`${EXPLORER_TX}${batchTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-[var(--accent-emerald)]/60 hover:text-[var(--accent-emerald)] font-['JetBrains_Mono'] flex items-center gap-1"
                      >
                        View <ExternalLink size={8} strokeWidth={2} />
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setAgentPhase("idle");
                        setPlan(null);
                        setAgentLogs([]);
                        setVisibleLogCount(0);
                        setExecutionSteps([]);
                        setBatchTxHash(null);
                        setInput("");
                      }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                    >
                      New Strategy
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-quaternary)] text-center">
                    Go to <span className="text-[var(--accent-emerald)]">Confidential Exit</span> to claim BTC
                  </p>
                </div>
              )}

              {!isConnected && agentPhase === "planned" && (
                <p className="text-xs text-[var(--text-quaternary)] text-center">
                  Connect wallet to execute
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* x402 Premium Intelligence — Real Micropayment Flow */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: agentPhase === "idle" ? 0 : 0.2 }}
        className="rounded-2xl border border-orange-200/60 bg-gradient-to-b from-orange-50/50 to-[var(--bg-secondary)] overflow-hidden"
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                <CreditCard size={11} strokeWidth={1.5} className="text-[#FF9900]" />
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)]">Premium Intelligence</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">x402</span>
            </div>
            {x402Phase === "complete" && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/50">
                <Check size={9} strokeWidth={2.5} className="text-emerald-500" />
                <span className="text-[9px] text-emerald-600 font-bold">SETTLED</span>
              </div>
            )}
          </div>

          {/* Idle — unlock button */}
          {x402Phase === "idle" && !premiumData && !premiumError && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Pay <span className="text-[#FF9900] font-semibold">$0.01</span> via x402 micropayment to unlock real-time pool intelligence — risk scoring, per-tier unlinkability, optimal timing, and BTC projections.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: TrendingUp, label: "Strategy Score", desc: "Personalized risk analysis" },
                  { icon: Shield, label: "Tier Unlinkability", desc: "Per-tier analysis" },
                  { icon: Brain, label: "Entry Timing", desc: "Optimal deposit window" },
                  { icon: Sparkles, label: "BTC Projections", desc: "Yield estimates" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-tertiary)]/60">
                    <Icon size={11} strokeWidth={1.5} className="text-[#FF9900] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-semibold text-[var(--text-secondary)]">{label}</div>
                      <div className="text-[9px] text-[var(--text-quaternary)]">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={handlePremiumAnalysis}
                disabled={!isConnected}
                className="w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2
                           bg-gradient-to-r from-orange-500 to-orange-500 text-white
                           hover:from-[#FF9900] hover:to-orange-600
                           disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed
                           shadow-md hover:shadow-lg
                           cursor-pointer transition-all"
                whileTap={isConnected ? { scale: 0.985 } : {}}
              >
                <Zap size={13} strokeWidth={2} />
                {isConnected ? "Unlock Premium Analysis · $0.01" : "Connect Wallet to Unlock"}
              </motion.button>
              <p className="text-[10px] text-[var(--text-quaternary)] text-center">
                Paid via x402 protocol — AVNU paymaster settles on Starknet
              </p>
            </div>
          )}

          {/* Active payment flow — step indicators */}
          {x402Phase !== "idle" && x402Phase !== "complete" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-[var(--bg-tertiary)] border border-orange-200/40 p-3.5">
                <div className="space-y-2.5">
                  {[
                    { id: "requesting" as X402Phase, label: "Request premium endpoint", detail: "Server responds with 402 Payment Required" },
                    { id: "signing" as X402Phase, label: "Authorize $0.01 micropayment", detail: "Your wallet signs the x402 payment via AVNU paymaster" },
                    { id: "settling" as X402Phase, label: "Verify & settle on-chain", detail: "Server verifies signature, settles payment, returns analysis" },
                  ].map(({ id, label, detail }, i) => {
                    const phases: X402Phase[] = ["requesting", "signing", "settling"];
                    const currentIdx = phases.indexOf(x402Phase);
                    const stepIdx = phases.indexOf(id);
                    const isDone = stepIdx < currentIdx;
                    const isActive = id === x402Phase;

                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: isDone || isActive ? 1 : 0.4 }}
                        className="flex items-start gap-3"
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all duration-300 ${
                          isDone ? "bg-emerald-500 text-white" :
                          isActive ? "bg-[#FF9900] text-white" :
                          "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]"
                        }`}>
                          {isDone ? <Check size={10} strokeWidth={3} /> : isActive ? <Loader2 size={10} strokeWidth={2} className="animate-spin" /> : i + 1}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className={`text-[11px] font-semibold ${isDone ? "text-emerald-600" : isActive ? "text-orange-700" : "text-[var(--text-quaternary)]"}`}>
                            {label}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isDone ? "text-[var(--text-tertiary)]" : "text-[var(--text-quaternary)]"}`}>
                            {detail}
                          </div>
                          {isActive && (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: "100%" }}
                              transition={{ duration: x402Phase === "signing" ? 10 : 3, ease: "linear" }}
                              className="h-0.5 bg-[#FF9900] rounded-full mt-2"
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 py-1">
                <Loader2 size={11} className="animate-spin text-[#FF9900]" />
                <span className="text-[11px] text-[#FF9900] font-medium">
                  {x402Phase === "requesting" && "Hitting x402-gated endpoint..."}
                  {x402Phase === "signing" && "Approve in your wallet..."}
                  {x402Phase === "settling" && "Verifying payment on-chain..."}
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {premiumError && (
            <div className="flex items-start gap-2 py-2">
              <AlertTriangle size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs text-red-600">{premiumError}</span>
                <button
                  onClick={() => { setPremiumError(null); setX402Phase("idle"); }}
                  className="block text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-1 cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Premium Analysis Results — Real data from on-chain payment */}
          {premiumData && !!(premiumData as Record<string, unknown>).premium && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              {/* Settlement confirmation */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200/50 p-2.5">
                <div className="flex items-center gap-2">
                  <Check size={12} strokeWidth={2.5} className="text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-emerald-700">Payment settled on-chain</span>
                    <span className="text-[10px] text-emerald-600/70 ml-2">
                      {String(((premiumData as Record<string, unknown>).payment as Record<string, unknown>)?.amount ?? "$0.01")}
                    </span>
                  </div>
                  {x402TxHash && (
                    <a
                      href={`${EXPLORER_TX}${x402TxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-['JetBrains_Mono'] text-emerald-500 hover:text-emerald-700 flex items-center gap-0.5 flex-shrink-0"
                    >
                      View tx <ExternalLink size={7} strokeWidth={2} />
                    </a>
                  )}
                </div>
                {String(((premiumData as Record<string, unknown>).payment as Record<string, unknown>)?.payer || "") !== "" && (
                  <div className="text-[9px] font-['JetBrains_Mono'] text-emerald-500/60 mt-1 truncate">
                    Payer: {String(((premiumData as Record<string, unknown>).payment as Record<string, unknown>).payer).slice(0, 20)}...
                  </div>
                )}
              </div>

              {/* Pool Health + CSI */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                  <div className="text-[10px] text-[var(--text-quaternary)] mb-1">Pool Health</div>
                  <div className="text-lg font-bold text-emerald-600">
                    {String(((premiumData as Record<string, unknown>).pool as Record<string, unknown>)?.health && (((premiumData as Record<string, unknown>).pool as Record<string, unknown>).health as Record<string, unknown>)?.rating || "—")}
                  </div>
                  <div className="text-[10px] text-[var(--text-quaternary)] font-['JetBrains_Mono']">
                    Score: {String(((premiumData as Record<string, unknown>).pool as Record<string, unknown>)?.health && (((premiumData as Record<string, unknown>).pool as Record<string, unknown>).health as Record<string, unknown>)?.score || "0")}/100
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                  <div className="text-[10px] text-[var(--text-quaternary)] mb-1">CSI Score</div>
                  <div className="text-lg font-bold font-['JetBrains_Mono'] text-[#4D4DFF]">
                    {String(((premiumData as Record<string, unknown>).pool as Record<string, unknown>)?.csi ?? "—")}
                  </div>
                  <div className="text-[10px] text-[var(--text-quaternary)]">Composite Security Index</div>
                </div>
              </div>

              {/* Tier Analysis */}
              {Array.isArray((premiumData as Record<string, unknown>).tier_analysis) && (
                <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                  <div className="text-[10px] font-semibold text-[var(--text-tertiary)] mb-2">Per-Tier Unlinkability</div>
                  <div className="grid grid-cols-4 gap-2">
                    {((premiumData as Record<string, unknown>).tier_analysis as Array<Record<string, unknown>>).map((tier) => (
                      <div key={String(tier.label)} className="text-center">
                        <div className="text-[11px] font-['JetBrains_Mono'] font-bold text-[var(--text-secondary)]">{String(tier.label)}</div>
                        <div className={`text-[10px] font-semibold ${
                          String(tier.unlinkability) === "Strong" ? "text-emerald-500" :
                          String(tier.unlinkability) === "Good" ? "text-blue-500" :
                          String(tier.unlinkability) === "Moderate" ? "text-[#FF9900]" : "text-red-400"
                        }`}>
                          {String(tier.unlinkability)}
                        </div>
                        <div className="text-[9px] text-[var(--text-quaternary)]">{String(tier.participants)} deposits</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BTC Projections */}
              {!!(premiumData as Record<string, unknown>).btc && (() => {
                const btcData = (premiumData as Record<string, unknown>).btc as Record<string, unknown>;
                const projections = btcData?.projections as Record<string, string> | undefined;
                const slippage = btcData?.slippage_estimate ? String(btcData.slippage_estimate) : "";
                return (
                  <div className="rounded-xl bg-amber-50/60 border border-orange-200/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={10} className="text-[#FF9900]" />
                      <span className="text-[10px] font-semibold text-[#FF9900]">BTC Projections</span>
                    </div>
                    {projections && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {Object.entries(projections).map(([label, btcAmt]) => (
                          <div key={label}>
                            <div className="text-[10px] text-[var(--text-quaternary)]">{label.replace("_deposit", "").replace("$", "")}</div>
                            <div className="text-[10px] font-['JetBrains_Mono'] font-bold text-orange-700">{btcAmt} BTC</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {slippage && (
                      <div className="text-[9px] text-[var(--text-quaternary)] mt-1.5">
                        Slippage: {slippage}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Timing */}
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/30 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={10} className="text-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-600">Optimal Timing</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {String(((premiumData as Record<string, unknown>).timing as Record<string, unknown>)?.advice ?? "—")}
                </p>
              </div>

              {/* Recommendations */}
              {Array.isArray((premiumData as Record<string, unknown>).recommendations) && (
                <div className="space-y-1">
                  {((premiumData as Record<string, unknown>).recommendations as string[]).slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-[var(--text-tertiary)]">
                      <span className="text-[#FF9900] mt-0.5 flex-shrink-0">•</span>
                      {rec}
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={9} className="text-[#FF9900]" />
                  <span className="text-[10px] text-[var(--text-quaternary)]">
                    Paid via x402 on Starknet · AVNU paymaster
                  </span>
                </div>
                <button
                  onClick={() => { setPremiumData(null); setX402Phase("idle"); setX402TxHash(null); }}
                  className="text-[10px] text-[#FF9900] hover:text-orange-700 cursor-pointer font-semibold"
                >
                  Buy Again
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Persistent AI Strategist Status Bar */}
      <div className="sticky bottom-0 z-10 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 px-4 py-2.5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-[#12D483] animate-pulse-dot flex-shrink-0" />
        <span className="text-[11px] font-['JetBrains_Mono'] text-gray-300 font-medium tracking-wide">
          VEIL STRATEGIST ONLINE
        </span>
        <span className="w-px h-3 bg-gray-600" />
        <span className="text-[11px] font-['JetBrains_Mono'] text-gray-400 font-tabular">
          {btcPrice > 0 ? `BTC $${btcPrice.toLocaleString()}` : "..."}
        </span>
        <span className="w-px h-3 bg-gray-600" />
        <span className="text-[11px] font-['JetBrains_Mono'] text-gray-400 font-tabular">
          Pool: {poolState?.leafCount ?? 0} commits
        </span>
      </div>
    </div>
  );
}
