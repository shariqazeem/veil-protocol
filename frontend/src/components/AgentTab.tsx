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
import addresses from "@/contracts/addresses.json";
import { CallData, RpcProvider } from "starknet";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Check,
  ExternalLink,
  Loader2,
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
  think: "bg-[var(--accent-violet)]/60",
  decide: "bg-[var(--accent-emerald)]/60",
  act: "bg-[var(--accent-orange)]/60",
  result: "bg-[var(--text-primary)]/40",
};

export default function AgentTab() {
  const { address, isConnected } = useAccount();
  const { bitcoinAddress } = useWallet();
  const { sendAsync } = useSendTransaction({ calls: [] });
  const { toast } = useToast();
  const searchParams = useSearchParams();

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

  // Render helpers
  const completedSteps = executionSteps.filter((s) => s.status === "done").length;
  const isRunning = agentPhase === "thinking" || agentPhase === "executing";
  const visibleLogs = agentLogs.slice(0, visibleLogCount);

  return (
    <div className="space-y-5">
      {/* Header with live indicators */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-violet-dim)] border border-[var(--accent-violet)]/20 flex items-center justify-center">
            <Brain size={14} strokeWidth={1.5} className="text-[var(--accent-violet)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              AI Strategist
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-[family-name:var(--font-geist-mono)]">
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
                className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] resize-none focus:outline-none focus:border-[var(--accent-violet)]/40 transition-colors"
              />
              <button
                onClick={handlePlanStrategy}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[var(--accent-violet)] hover:bg-[var(--accent-violet)]/80 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center"
              >
                <ArrowRight size={14} strokeWidth={2} className="text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
                >
                  {prompt}
                </button>
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
            <span className="ml-2 text-xs text-[var(--text-quaternary)] font-[family-name:var(--font-geist-mono)]">
              veil-strategist
            </span>
            <div className="ml-auto">
              {isRunning && (
                <Loader2 size={12} strokeWidth={2} className="text-[var(--accent-violet)] animate-spin" />
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
                  <span className="text-xs text-[var(--text-secondary)] leading-relaxed font-[family-name:var(--font-geist-mono)]">
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
                        className="text-xs text-[var(--accent-emerald)]/80 hover:text-[var(--accent-emerald)] font-[family-name:var(--font-geist-mono)] flex items-center gap-1 leading-relaxed"
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
                  <span className="text-xs text-[var(--accent-red)]/80 font-[family-name:var(--font-geist-mono)] leading-relaxed">
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
                    className="text-xs text-[var(--accent-orange)]/80 hover:text-[var(--accent-orange)] font-[family-name:var(--font-geist-mono)] flex items-center gap-1 leading-relaxed"
                  >
                    BTC conversion · {batchTxHash.slice(0, 14)}...
                    <ExternalLink size={8} strokeWidth={2} />
                  </a>
                </motion.div>
              )}

              {/* DCA countdown */}
              {countdown > 0 && (
                <div className="flex items-center gap-2.5 py-1">
                  <Loader2 size={10} strokeWidth={2} className="text-[var(--accent-amber)] animate-spin flex-shrink-0" />
                  <span className="text-xs text-[var(--accent-amber)] font-[family-name:var(--font-geist-mono)]">
                    Next deposit in {countdown}s
                  </span>
                </div>
              )}

              {/* Blinking cursor */}
              {isRunning && countdown === 0 && (
                <div className="flex items-center gap-2.5 py-0.5">
                  <span className="w-1.5 h-3 bg-[var(--accent-violet)]/60 animate-pulse rounded-sm" />
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
                    <span className="text-base font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-primary)] font-tabular">
                      ${plan.strategy.totalUsdc.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-[var(--border-subtle)]" />
                  <div>
                    <span className="text-[11px] text-[var(--text-tertiary)] block">Est. BTC</span>
                    <span className="text-base font-[family-name:var(--font-geist-mono)] font-bold text-[var(--accent-orange)] font-tabular">
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
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)] font-tabular">
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-[family-name:var(--font-geist-mono)] font-medium transition-colors ${
                        status === "done"
                          ? "bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]"
                          : status === "executing" || status === "waiting"
                            ? "bg-[var(--accent-violet-dim)] text-[var(--accent-violet)]"
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
                  className="w-full py-3 bg-[var(--accent-violet)] hover:bg-[var(--accent-violet)]/80 text-white rounded-xl text-sm font-semibold
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
                        className="ml-auto text-xs text-[var(--accent-emerald)]/60 hover:text-[var(--accent-emerald)] font-[family-name:var(--font-geist-mono)] flex items-center gap-1"
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
    </div>
  );
}
