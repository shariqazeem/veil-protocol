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
  MessageCircle,
  Eye,
  Send,
} from "lucide-react";
import { loadNotes } from "@/utils/privacy";
import type { ChatResponse, ChatCard } from "@/utils/privacyChat";
import type { DepositInfo } from "@/utils/privacyScore";
import type { PrivacyScore, PoolHealthScore, WithdrawalRecommendation, PrivacyThreat } from "@/utils/privacyScore";

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

type AgentMode = "chat" | "deposit";

// Chat message types
interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  cards?: ChatCard[];
  suggestions?: string[];
  loading?: boolean;
}

// Severity color maps
const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-[#FF9900]",
  info: "text-blue-400",
};
const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/20",
  warning: "bg-orange-500/10 border-orange-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
};
const FACTOR_STATUS_COLORS: Record<string, string> = {
  safe: "bg-[var(--accent-emerald)]",
  moderate: "bg-[#FF9900]",
  warning: "bg-orange-500",
  critical: "bg-red-500",
};

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
  const [countdown, setCountdown] = useState(0);

  // Premium x402 analysis state
  const [premiumData, setPremiumData] = useState<Record<string, unknown> | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  // x402 flow phases: idle → requesting → signing → settling → complete
  type X402Phase = "idle" | "requesting" | "signing" | "settling" | "complete";
  const [x402Phase, setX402Phase] = useState<X402Phase>("idle");
  const [x402TxHash, setX402TxHash] = useState<string | null>(null);

  // Agent mode: chat (privacy AI) or deposit (strategist)
  const [agentMode, setAgentMode] = useState<AgentMode>("chat");

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef(0);

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

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Send chat message
  async function handleChatSend(overrideInput?: string) {
    const msg = (overrideInput ?? chatInput).trim();
    if (!msg || chatLoading) return;

    const userMsg: ChatMessage = { id: ++chatIdRef.current, role: "user", text: msg };
    const loadingMsg: ChatMessage = { id: ++chatIdRef.current, role: "agent", text: "", loading: true };
    setChatMessages((prev) => [...prev, userMsg, loadingMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      // Load user deposits from localStorage and convert to DepositInfo[]
      let deposits: DepositInfo[] = [];
      try {
        const notes = loadNotes();
        deposits = notes
          .filter((n) => !n.claimed)
          .map((n) => ({
            tier: n.denomination,
            depositTimestamp: n.timestamp,
            leafIndex: n.leafIndex,
            claimed: n.claimed,
          }));
      } catch { /* localStorage may be unavailable */ }

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: msg,
          deposits,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data: ChatResponse & { timestamp: number } = await res.json();

      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: data.message, cards: data.cards, suggestions: data.suggestions, loading: false }
            : m,
        ),
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: "Something went wrong. Please try again.", loading: false }
            : m,
        ),
      );
    }

    setChatLoading(false);
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

      // Step 2: Direct STRK transfer to treasury for premium access
      setX402Phase("signing");

      const strkToken = "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";
      const feeAmount = requirements.amount; // atomic units string
      const transferResult = await sendAsync([{
        contractAddress: strkToken,
        entrypoint: "transfer",
        calldata: CallData.compile({
          recipient: requirements.payTo,
          amount: { low: feeAmount, high: "0" },
        }),
      }]);

      // Step 3: Re-request premium endpoint with payment tx hash
      setX402Phase("settling");

      // Load deposits from localStorage
      let userDeposits: Array<{ tier: number; depositTimestamp: number; leafIndex: number; claimed: boolean }> = [];
      try {
        const notes = loadNotes();
        userDeposits = notes.filter(n => !n.claimed).map(n => ({
          tier: n.denomination,
          depositTimestamp: n.timestamp,
          leafIndex: n.leafIndex,
          claimed: n.claimed,
        }));
      } catch { /* localStorage may be unavailable */ }

      // Parse target amount from user input
      const targetUsdc = parseTargetUsdc(input || "") ?? 100;

      const paidRes = await fetch(
        `/api/agent/premium-strategy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: input || "analyze pool",
            payment_tx: transferResult.transaction_hash,
            target_usdc: targetUsdc,
            deposits: userDeposits,
          }),
        },
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
      {/* Header with mode tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[rgba(77,77,255,0.08)] border border-[#4D4DFF]/20 flex items-center justify-center">
              <Shield size={14} strokeWidth={1.5} className="text-[#4D4DFF]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                Privacy Agent
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

        {/* Mode tabs */}
        <div className="flex gap-1 p-0.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <button
            onClick={() => setAgentMode("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              agentMode === "chat"
                ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <MessageCircle size={12} strokeWidth={1.5} />
            Privacy Chat
          </button>
          <button
            onClick={() => setAgentMode("deposit")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              agentMode === "deposit"
                ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Brain size={12} strokeWidth={1.5} />
            Deposit Strategist
          </button>
        </div>
      </div>

      {/* ━━━ PRIVACY CHAT MODE ━━━ */}
      {agentMode === "chat" && (
        <div className="space-y-3">
          {/* Chat messages */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5">
                <Eye size={12} strokeWidth={1.5} className="text-[#4D4DFF]" />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Privacy Agent</span>
              </div>
              <span className="text-[10px] text-[var(--text-quaternary)] font-['JetBrains_Mono'] ml-auto">
                on-chain analysis
              </span>
            </div>

            <div ref={chatRef} className="max-h-96 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[rgba(77,77,255,0.06)] border border-[#4D4DFF]/15 flex items-center justify-center mx-auto">
                    <Shield size={20} strokeWidth={1.5} className="text-[#4D4DFF]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Your Privacy Agent
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs mx-auto leading-relaxed">
                      Ask about your anonymity, withdrawal timing, pool health, or deposit strategies. All analysis is powered by real on-chain data.
                    </p>
                  </div>
                </div>
              )}

              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                    {/* Message bubble */}
                    <div className={`rounded-2xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-[#4D4DFF] text-white rounded-br-md"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-bl-md"
                    }`}>
                      {msg.loading ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4D4DFF] animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4D4DFF] animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4D4DFF] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : (
                        <div className="text-xs leading-relaxed whitespace-pre-wrap">
                          {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                            part.startsWith("**") && part.endsWith("**")
                              ? <strong key={i}>{part.slice(2, -2)}</strong>
                              : part,
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cards */}
                    {msg.cards && msg.cards.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.cards.map((card, ci) => (
                          <ChatCardRenderer key={ci} card={card} />
                        ))}
                      </div>
                    )}

                    {/* Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && !msg.loading && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleChatSend(s)}
                            className="px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Chat input */}
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder="Ask about your privacy, pool health, threats..."
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[#4D4DFF]/40 transition-colors"
            />
            <button
              onClick={() => handleChatSend()}
              disabled={!chatInput.trim() || chatLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#4D4DFF] hover:bg-[#4D4DFF]/80 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center"
            >
              {chatLoading ? (
                <Loader2 size={13} strokeWidth={2} className="text-white animate-spin" />
              ) : (
                <Send size={13} strokeWidth={2} className="text-white" />
              )}
            </button>
          </div>

          {/* Quick prompts for empty state */}
          {chatMessages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[
                "Check pool health",
                "How private am I?",
                "When should I withdraw?",
                "What is k-anonymity?",
              ].map((prompt) => (
                <motion.button
                  key={prompt}
                  onClick={() => handleChatSend(prompt)}
                  className="px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━━ DEPOSIT STRATEGIST MODE ━━━ */}
      {agentMode === "deposit" && (<>


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
                Paid via x402 protocol — direct STRK micropayment on Starknet
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
                    { id: "signing" as X402Phase, label: "Authorize $0.01 micropayment", detail: "Your wallet sends STRK transfer to treasury" },
                    { id: "settling" as X402Phase, label: "Verify & return analysis", detail: "Server verifies on-chain transfer, returns premium data" },
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

              {/* YOUR PRIVACY POSITION */}
              {(() => {
                const pd = premiumData as Record<string, unknown>;
                const yourDeposits = pd.your_deposits as Record<string, unknown> | undefined;
                const depositList = (yourDeposits?.deposits ?? []) as Array<Record<string, unknown>>;
                const optPlan = pd.optimal_plan as Record<string, unknown> | undefined;
                const planSteps = (optPlan?.steps ?? []) as Array<Record<string, unknown>>;
                const btcProj = pd.btc_projection as Record<string, unknown> | undefined;
                const threatList = (pd.threats ?? []) as string[];
                const recs = (pd.recommendations ?? []) as string[];
                const yourAmount = Number(pd.your_amount ?? 0);

                return (
                  <>
                    {/* Privacy Score Summary */}
                    {depositList.length > 0 && (
                      <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] font-semibold text-[var(--text-tertiary)]">Your Privacy Position</div>
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            Number(yourDeposits?.avg_privacy_score ?? 0) >= 70 ? "bg-emerald-100 text-emerald-700" :
                            Number(yourDeposits?.avg_privacy_score ?? 0) >= 45 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          }`}>
                            {String(yourDeposits?.avg_privacy_score ?? 0)}/100 {String(yourDeposits?.overall_rating ?? "")}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {depositList.map((dep, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-primary)]">
                              <div className="text-[11px] font-['JetBrains_Mono'] font-bold text-[var(--text-secondary)] w-8">{String(dep.label)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${
                                      Number(dep.privacyScore) >= 70 ? "bg-emerald-500" :
                                      Number(dep.privacyScore) >= 45 ? "bg-amber-500" : "bg-red-500"
                                    }`} style={{ width: `${dep.privacyScore}%` }} />
                                  </div>
                                  <span className="text-[9px] font-['JetBrains_Mono'] text-[var(--text-quaternary)] w-6">{String(dep.privacyScore)}</span>
                                </div>
                                <div className="flex gap-3 mt-0.5">
                                  <span className="text-[8px] text-[var(--text-quaternary)]">{String(dep.hoursElapsed)}h elapsed</span>
                                  <span className="text-[8px] text-[var(--text-quaternary)]">{String(dep.depositsSince)} deposits since</span>
                                </div>
                              </div>
                              <div className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${
                                dep.withdrawSafe ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {dep.withdrawSafe ? "SAFE" : "WAIT"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {depositList.length === 0 && (
                      <div className="rounded-xl bg-blue-50/60 border border-blue-200/30 p-2.5">
                        <div className="text-[10px] font-semibold text-blue-600 mb-1">No Deposits Detected</div>
                        <div className="text-[10px] text-blue-500/80">Shield USDC first, then premium analysis will score each deposit individually.</div>
                      </div>
                    )}

                    {/* Threats */}
                    {threatList.length > 0 && (
                      <div className="rounded-xl bg-red-50/60 border border-red-200/30 p-2.5">
                        <div className="text-[10px] font-semibold text-red-600 mb-1.5">Threats Detected</div>
                        {threatList.map((t, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-500/90 mb-0.5">
                            <span className="flex-shrink-0">!</span>{t}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Optimal Plan for YOUR Amount */}
                    {planSteps.length > 0 && yourAmount > 0 && (
                      <div className="rounded-xl bg-[var(--bg-tertiary)] p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] font-semibold text-[var(--text-tertiary)]">Optimal Plan for ${yourAmount}</div>
                          <div className="text-[9px] font-['JetBrains_Mono'] text-[var(--text-quaternary)]">
                            {String(optPlan?.deposit_count ?? 0)} deposits
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {planSteps.map((step, i) => (
                            <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--bg-primary)]">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-['JetBrains_Mono'] font-bold text-[#FF9900]">{String(step.count)}x</span>
                                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{String(step.label)}</span>
                              </div>
                              <div className="text-[9px] text-emerald-600">{String(step.privacyGain)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--border-subtle)]">
                          <span className="text-[10px] text-[var(--text-quaternary)]">Total: ${String(optPlan?.total_usdc ?? 0)}</span>
                          <span className="text-[10px] font-['JetBrains_Mono'] text-[#FF9900] font-semibold">
                            ≈ {String(optPlan?.estimated_btc ?? "0")} BTC
                          </span>
                        </div>
                      </div>
                    )}

                    {/* YOUR BTC Projection */}
                    {btcProj && (
                      <div className="rounded-xl bg-amber-50/60 border border-orange-200/30 p-2.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles size={10} className="text-[#FF9900]" />
                          <span className="text-[10px] font-semibold text-[#FF9900]">Your BTC Projection</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[9px] text-[var(--text-quaternary)]">Single ${String(btcProj.your_amount)}</div>
                            <div className="text-[11px] font-['JetBrains_Mono'] font-bold text-orange-700">{String(btcProj.btc_estimate)}</div>
                            <div className="text-[8px] text-[var(--text-quaternary)]">BTC</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-[var(--text-quaternary)]">30-day DCA</div>
                            <div className="text-[11px] font-['JetBrains_Mono'] font-bold text-orange-700">{String(btcProj.dca_projection_30d)}</div>
                            <div className="text-[8px] text-[var(--text-quaternary)]">BTC</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-[var(--text-quaternary)]">90-day DCA</div>
                            <div className="text-[11px] font-['JetBrains_Mono'] font-bold text-orange-700">{String(btcProj.dca_projection_90d)}</div>
                            <div className="text-[8px] text-[var(--text-quaternary)]">BTC</div>
                          </div>
                        </div>
                        <div className="text-[8px] text-[var(--text-quaternary)] mt-1.5">
                          BTC @ ${Number(btcProj.btc_price).toLocaleString()} · {String(btcProj.slippage)}
                        </div>
                      </div>
                    )}

                    {/* Personalized Recommendations */}
                    {recs.length > 0 && (
                      <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/30 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <TrendingUp size={10} className="text-emerald-500" />
                          <span className="text-[10px] font-semibold text-emerald-600">Your Next Steps</span>
                        </div>
                        <div className="space-y-1">
                          {recs.map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] text-[var(--text-secondary)]">
                              <span className="text-emerald-500 mt-0.5 flex-shrink-0">{i + 1}.</span>{rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={9} className="text-[#FF9900]" />
                  <span className="text-[10px] text-[var(--text-quaternary)]">
                    Paid via x402 on Starknet · direct transfer
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

      </>)}

      {/* Persistent AI Strategist Status Bar */}
      <div className="sticky bottom-0 z-10 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 px-4 py-2.5 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-[#12D483] animate-pulse-dot flex-shrink-0" />
        <span className="text-[11px] font-['JetBrains_Mono'] text-gray-300 font-medium tracking-wide">
          PRIVACY AGENT ONLINE
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

// ─────────────────────────────────────────────────────────────────────────────
// ChatCardRenderer — renders structured data cards in chat
// ─────────────────────────────────────────────────────────────────────────────

function ChatCardRenderer({ card }: { card: ChatCard }) {
  if (card.type === "privacy_score") return <PrivacyScoreCard score={card.data} tier={card.tier} />;
  if (card.type === "pool_health") return <PoolHealthCard health={card.data} />;
  if (card.type === "withdrawal_rec") return <WithdrawalRecCard rec={card.data} tier={card.tier} />;
  if (card.type === "threats") return <ThreatsCard threats={card.data} />;
  if (card.type === "metric") return <MetricCard label={card.label} value={card.value} status={card.status} />;
  return null;
}

function PrivacyScoreCard({ score, tier }: { score: PrivacyScore; tier: number }) {
  const tierLabel = ["$1", "$10", "$100", "$1,000"][tier];
  const ratingColor = score.overall >= 75 ? "text-emerald-500" : score.overall >= 50 ? "text-[#FF9900]" : "text-red-500";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} strokeWidth={1.5} className="text-[#4D4DFF]" />
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{tierLabel} Privacy Score</span>
        </div>
        <span className={`text-lg font-bold font-['JetBrains_Mono'] ${ratingColor}`}>{score.overall}</span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${score.overall >= 75 ? "bg-emerald-500" : score.overall >= 50 ? "bg-[#FF9900]" : "bg-red-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${score.overall}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* Factor breakdown */}
      <div className="space-y-1.5">
        {score.factors.map((f) => (
          <div key={f.name} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${FACTOR_STATUS_COLORS[f.status]}`} />
            <span className="text-[10px] text-[var(--text-tertiary)] flex-1">{f.name}</span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-[var(--text-secondary)] font-semibold">{f.score}/{f.maxScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoolHealthCard({ health }: { health: PoolHealthScore }) {
  const ratingColor = health.overall >= 75 ? "text-emerald-500" : health.overall >= 50 ? "text-[#FF9900]" : "text-red-500";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={12} strokeWidth={1.5} className="text-[#4D4DFF]" />
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Pool Health</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${ratingColor}`}>{health.rating}</span>
          <span className="text-[10px] font-['JetBrains_Mono'] text-[var(--text-quaternary)]">{health.overall}/100</span>
        </div>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {health.tiers.map((t) => (
          <div key={t.tier} className="text-center rounded-lg bg-[var(--bg-tertiary)] p-1.5">
            <div className="text-[10px] font-['JetBrains_Mono'] font-bold text-[var(--text-secondary)]">{t.label}</div>
            <div className="text-[11px] font-bold font-['JetBrains_Mono'] text-[#4D4DFF]">{t.participants}</div>
            <div className={`text-[8px] font-semibold ${
              t.unlinkability === "Strong" || t.unlinkability === "Excellent" ? "text-emerald-500" :
              t.unlinkability === "Good" || t.unlinkability === "Moderate" ? "text-[#FF9900]" : "text-red-400"
            }`}>{t.unlinkability}</div>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap gap-1.5">
        {health.metrics.slice(0, 3).map((m) => (
          <span key={m.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[9px] text-[var(--text-tertiary)]">
            <span className={`w-1 h-1 rounded-full ${m.status === "good" ? "bg-emerald-500" : m.status === "moderate" ? "bg-[#FF9900]" : "bg-red-500"}`} />
            {m.label}: {m.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function WithdrawalRecCard({ rec, tier }: { rec: WithdrawalRecommendation; tier: number }) {
  const tierLabel = ["$1", "$10", "$100", "$1,000"][tier];

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      rec.shouldWithdraw
        ? "border-emerald-200/50 bg-emerald-50/30"
        : "border-orange-200/50 bg-orange-50/30"
    }`}>
      <div className="flex items-center gap-2">
        {rec.shouldWithdraw ? (
          <Check size={14} strokeWidth={2} className="text-emerald-500" />
        ) : (
          <AlertTriangle size={14} strokeWidth={1.5} className="text-[#FF9900]" />
        )}
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          {tierLabel}: {rec.shouldWithdraw ? "Safe to withdraw" : "Wait recommended"}
        </span>
        <span className="ml-auto text-[10px] font-['JetBrains_Mono'] text-[var(--text-tertiary)]">
          {rec.currentScore}/100
        </span>
      </div>

      <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
        {rec.waitRecommendation}
      </p>

      {rec.risks.length > 0 && (
        <div className="space-y-0.5">
          {rec.risks.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[9px] text-red-500/80">
              <span className="mt-0.5">!</span> {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreatsCard({ threats }: { threats: PrivacyThreat[] }) {
  if (threats.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={12} strokeWidth={1.5} className="text-[#FF9900]" />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          {threats.length} Privacy Concern{threats.length > 1 ? "s" : ""}
        </span>
      </div>
      {threats.map((t, i) => (
        <div key={i} className={`rounded-lg border p-2 ${SEVERITY_BG[t.severity]}`}>
          <div className={`text-[10px] font-semibold ${SEVERITY_COLORS[t.severity]}`}>{t.title}</div>
          <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5">{t.description}</div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, status }: { label: string; value: string; status: "good" | "moderate" | "warning" }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <span className={`w-1.5 h-1.5 rounded-full ${status === "good" ? "bg-emerald-500" : status === "moderate" ? "bg-[#FF9900]" : "bg-red-500"}`} />
      <span className="text-[10px] text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[11px] font-['JetBrains_Mono'] font-bold text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}
