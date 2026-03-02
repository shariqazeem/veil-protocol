"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useSmartSend } from "@/hooks/useSmartSend";
import {
  Wallet2, TrendingUp, Loader, RefreshCw, Zap, LogOut, Gift, Plus,
  ChevronDown, ChevronUp, Send, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RPC_URL } from "@/utils/network";
import { RpcProvider, CallData } from "starknet";
import { useToast } from "@/context/ToastContext";
import {
  Staking, Amount, Erc20, mainnetValidators, mainnetTokens,
  type Address, type Token, type PoolMember,
} from "starkzap";

// ── Display tokens (9 from mainnetTokens — always show first 4) ─────
const DISPLAY_TOKENS: Token[] = [
  mainnetTokens.USDC,
  mainnetTokens.ETH,
  mainnetTokens.STRK,
  mainnetTokens.WBTC,
  mainnetTokens.TBTC,
  mainnetTokens.LBTC,
  mainnetTokens.WSTETH,
  mainnetTokens.DAI,
  mainnetTokens.USDT,
];

const CORE_SYMBOLS = new Set(["USDC", "ETH", "STRK", "WBTC"]);

// ── Starkzap token presets (plain, no metadata — proven to work with fromStaker) ──
const TOKENS = [
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: mainnetTokens.USDC.address },
  { symbol: "STRK", name: "Starknet", decimals: 18, address: mainnetTokens.STRK.address },
  { symbol: "ETH", name: "Ethereum", decimals: 18, address: mainnetTokens.ETH.address },
  { symbol: "WBTC", name: "Wrapped BTC", decimals: 8, address: mainnetTokens.WBTC.address },
] as const;

// ── Validators (top 5) ──────────────────────────────────────────────
const VALIDATORS = [
  mainnetValidators.KARNOT,
  mainnetValidators.READY_PREV_ARGENT,
  mainnetValidators.AVNU,
  mainnetValidators.BRAAVOS,
  mainnetValidators.NETHERMIND,
];

// Staking config for Starkzap SDK (mainnet staking manager)
const STAKING_CONFIG = { contract: "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7" as Address };

// STRK token definition for Starkzap Amount (plain, no metadata)
const STRK_TOKEN: Token = { name: "Starknet", symbol: "STRK", decimals: 18, address: TOKENS[1].address as Address };

// Stable provider instance (not recreated each render)
const provider = new RpcProvider({ nodeUrl: RPC_URL });

type TokenBalance = {
  token: Token;
  balance: string;
  raw: bigint;
};

type ValidatorInfo = {
  name: string;
  stakerAddress: string;
  logoUrl: URL | null;
  stakingInstance: Staking | null;
};

type StakingPosition = {
  validatorName: string;
  validatorIndex: number;
  position: PoolMember;
  stakingInstance: Staking;
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

function formatBalance(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, Math.min(decimals, 4));
  const trimmed = fracStr.replace(/0+$/, "");
  if (trimmed === "") return whole.toLocaleString();
  return `${whole.toLocaleString()}.${trimmed}`;
}

export default function PortfolioTab() {
  const { address, isConnected } = useAccount();
  const { sendAsync } = useSmartSend();
  const { toast } = useToast();

  // Balances
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Validators & staking
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [selectedValidator, setSelectedValidator] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStakingBusy] = useState(false);
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staking positions
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showStakeForm, setShowStakeForm] = useState(false);

  // Multi-token staking discovery
  const [stakeableTokens, setStakeableTokens] = useState<Token[]>([]);
  const [selectedStakeToken, setSelectedStakeToken] = useState<number>(0);

  // Send tokens
  const [showSend, setShowSend] = useState(false);
  const [sendToken, setSendToken] = useState<number>(0);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  // Track the current stake token for validator resolution
  const [activeStakeToken, setActiveStakeToken] = useState<Token>(STRK_TOKEN);
  const [resolvingValidators, setResolvingValidators] = useState(false);

  // ── Fetch balances ────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBalances(true);
    try {
      const results: TokenBalance[] = [];
      for (const token of DISPLAY_TOKENS) {
        try {
          const result = await provider.callContract({
            contractAddress: token.address,
            entrypoint: "balance_of",
            calldata: CallData.compile({ account: address }),
          });
          const raw = BigInt(result[0] ?? "0");
          results.push({ token, balance: formatBalance(raw, token.decimals), raw });
        } catch {
          results.push({ token, balance: "0", raw: 0n });
        }
      }
      setBalances(results);
    } catch {
      setError("Failed to fetch balances");
    }
    setLoadingBalances(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
    }
  }, [isConnected, address, fetchBalances]);

  // ── Discover stakeable tokens (UI-only, does NOT trigger validator re-resolution) ──
  useEffect(() => {
    async function discoverTokens() {
      try {
        const tokens = await Staking.activeTokens(
          provider as unknown as Parameters<typeof Staking.activeTokens>[0],
          STAKING_CONFIG,
        );
        if (tokens.length > 0) {
          setStakeableTokens(tokens);
        }
      } catch {
        // Silent — STRK staking still works via the validators resolved below
      }
    }
    discoverTokens();
  }, []);

  // ── Resolve validator staking instances via Starkzap SDK ─────────
  // EXACTLY the old DefiTab pattern: inline async, deps = []
  useEffect(() => {
    async function resolveValidators() {
      const infos: ValidatorInfo[] = [];
      for (const v of VALIDATORS) {
        let stakingInstance: Staking | null = null;
        try {
          stakingInstance = await Staking.fromStaker(
            v.stakerAddress as Address,
            STRK_TOKEN,
            provider as unknown as Parameters<typeof Staking.fromStaker>[2],
            STAKING_CONFIG,
          );
        } catch {
          // If we can't resolve, leave stakingInstance null
        }
        infos.push({ name: v.name, stakerAddress: v.stakerAddress, logoUrl: v.logoUrl, stakingInstance });
      }
      setValidators(infos);
    }
    resolveValidators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when user picks a different stakeable token — re-resolves validators
  async function handleStakeTokenChange(index: number) {
    setSelectedStakeToken(index);
    const token = stakeableTokens[index];
    if (!token) return;
    const plainToken: Token = { name: token.name, symbol: token.symbol, decimals: token.decimals, address: token.address };
    setResolvingValidators(true);
    setActiveStakeToken(plainToken);
    const infos: ValidatorInfo[] = [];
    for (const v of VALIDATORS) {
      let stakingInstance: Staking | null = null;
      try {
        stakingInstance = await Staking.fromStaker(
          v.stakerAddress as Address,
          plainToken,
          provider as unknown as Parameters<typeof Staking.fromStaker>[2],
          STAKING_CONFIG,
        );
      } catch {
        // Pool may not exist for this token/validator combo
      }
      infos.push({ name: v.name, stakerAddress: v.stakerAddress, logoUrl: v.logoUrl, stakingInstance });
    }
    setValidators(infos);
    setSelectedValidator(0);
    setResolvingValidators(false);
  }

  // ── Fetch staking positions ────────────────────────────────────────
  const fetchPositions = useCallback(async () => {
    if (!address || validators.length === 0) return;
    setLoadingPositions(true);
    try {
      const found: StakingPosition[] = [];
      for (let i = 0; i < validators.length; i++) {
        const v = validators[i];
        if (!v.stakingInstance) continue;
        try {
          const walletProxy = { address: address as Address } as Parameters<Staking["getPosition"]>[0];
          const position = await v.stakingInstance.getPosition(walletProxy);
          if (position && (!position.staked.isZero() || !position.unpooling.isZero())) {
            found.push({
              validatorName: v.name,
              validatorIndex: i,
              position,
              stakingInstance: v.stakingInstance,
            });
          }
        } catch {
          // Skip
        }
      }
      setPositions(found);
    } catch {
      // Silently fail
    }
    setLoadingPositions(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, validators]);

  useEffect(() => {
    if (isConnected && address && validators.length > 0) {
      fetchPositions();
    }
  }, [isConnected, address, validators, fetchPositions]);

  // ── Stake tokens ──────────────────────────────────────────────────
  async function handleStake() {
    if (!isConnected || !address || !stakeAmount) return;

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const tokenBal = balances.find((b) => b.token.symbol === activeStakeToken.symbol);
    if (!tokenBal || tokenBal.raw < BigInt(Math.floor(amount * 10 ** activeStakeToken.decimals))) {
      setError(`Insufficient ${activeStakeToken.symbol} balance`);
      return;
    }

    setStakingBusy(true);
    setError(null);
    setStakeSuccess(false);

    try {
      const validator = validators[selectedValidator];
      if (!validator?.stakingInstance) {
        setError("Pool not resolved for this validator. Please wait or select a different validator.");
        setStakingBusy(false);
        return;
      }

      const parsedAmount = Amount.parse(stakeAmount, activeStakeToken);
      const existingPosition = positions.find((p) => p.validatorIndex === selectedValidator);
      const calls = existingPosition
        ? validator.stakingInstance.populateAdd(address as Address, parsedAmount)
        : validator.stakingInstance.populateEnter(address as Address, parsedAmount);

      await sendAsync(calls);
      setStakeSuccess(true);
      setStakeAmount("");
      toast("success", `Staked ${amount} ${activeStakeToken.symbol} with ${validator.name}`);
      setTimeout(() => { fetchBalances(); fetchPositions(); }, 3000);
    } catch (e) {
      setError(`Staking failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setStakingBusy(false);
  }

  // ── Unstake (exit intent) ─────────────────────────────────────────
  async function handleUnstake(pos: StakingPosition) {
    if (!address) return;
    setUnstaking(true);
    setError(null);

    try {
      const unstakeAmt = pos.position.staked.toUnit();
      const strkAmount = Amount.parse(unstakeAmt, pos.position.staked.getDecimals(), pos.position.staked.getSymbol());
      const call = pos.stakingInstance.populateExitIntent(strkAmount);
      await sendAsync([call]);
      toast("success", `Unstake initiated for ${pos.position.staked.toFormatted(true)} from ${pos.validatorName}. Wait for the exit window to complete withdrawal.`);
      setTimeout(() => fetchPositions(), 3000);
    } catch (e) {
      setError(`Unstake failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setUnstaking(false);
  }

  // ── Complete exit (after window) ──────────────────────────────────
  async function handleExit(pos: StakingPosition) {
    if (!address) return;
    setExiting(true);
    setError(null);

    try {
      const call = pos.stakingInstance.populateExit(address as Address);
      await sendAsync([call]);
      toast("success", `Withdrawal completed from ${pos.validatorName}`);
      setTimeout(() => { fetchBalances(); fetchPositions(); }, 3000);
    } catch (e) {
      setError(`Exit failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setExiting(false);
  }

  // ── Claim rewards ─────────────────────────────────────────────────
  async function handleClaimRewards(pos: StakingPosition) {
    if (!address) return;
    setClaiming(true);
    setError(null);

    try {
      const call = pos.stakingInstance.populateClaimRewards(address as Address);
      await sendAsync([call]);
      toast("success", `Rewards claimed from ${pos.validatorName}`);
      setTimeout(() => { fetchBalances(); fetchPositions(); }, 3000);
    } catch (e) {
      setError(`Claim failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setClaiming(false);
  }

  // ── Send tokens ───────────────────────────────────────────────────
  async function handleSend() {
    if (!isConnected || !address || !sendRecipient || !sendAmount) return;

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid send amount");
      return;
    }

    const nonZero = balances.filter((b) => b.raw > 0n);
    const selected = nonZero[sendToken];
    if (!selected) {
      setError("Select a token with balance");
      return;
    }

    if (selected.raw < BigInt(Math.floor(amount * 10 ** selected.token.decimals))) {
      setError(`Insufficient ${selected.token.symbol} balance`);
      return;
    }

    if (!sendRecipient.startsWith("0x") || sendRecipient.length < 10) {
      setError("Enter a valid Starknet address");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const erc20 = new Erc20(
        selected.token,
        provider as unknown as ConstructorParameters<typeof Erc20>[1],
      );
      const parsedAmount = Amount.parse(sendAmount, selected.token);
      const calls = erc20.populateTransfer([{
        to: sendRecipient as Address,
        amount: parsedAmount,
      }]);
      await sendAsync(calls);
      toast("success", `Sent ${amount} ${selected.token.symbol}`);
      setSendAmount("");
      setSendRecipient("");
      setTimeout(() => fetchBalances(), 3000);
    } catch (e) {
      setError(`Send failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setSending(false);
  }

  const hasPositions = positions.length > 0;
  const nonZeroBalances = balances.filter((b) => b.raw > 0n);
  const visibleBalances = balances.filter((b) => b.raw > 0n || CORE_SYMBOLS.has(b.token.symbol));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Wallet2 size={14} strokeWidth={1.5} className="text-[#8B5CF6]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Portfolio
          </span>
          <span className="text-[10px] font-semibold bg-[#8B5CF6]/10 text-[#8B5CF6] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Zap size={8} strokeWidth={2} />
            Starkzap
          </span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Manage tokens, send assets, and stake to earn rewards — powered by Starkzap SDK.
        </p>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 flex items-center justify-between"
          >
            <span className="text-xs text-[var(--accent-red)]">{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--accent-red)]/60 hover:text-[var(--accent-red)] text-xs cursor-pointer">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected ? (
        <div className="text-center py-10">
          <Wallet2 size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">Connect wallet to view portfolio</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Your token balances, send flow, and staking options will appear here
          </p>
        </div>
      ) : (
        <>
          {/* ── A. Token Balances with Logos ──────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Token Balances</span>
              <button
                onClick={fetchBalances}
                disabled={loadingBalances}
                className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} strokeWidth={1.5} className={loadingBalances ? "animate-spin" : ""} />
              </button>
            </div>

            {loadingBalances && balances.length === 0 ? (
              <div className="text-center py-6">
                <Loader size={16} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
                <p className="text-xs text-[var(--text-quaternary)] mt-2">Fetching balances...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleBalances.map((tb) => (
                  <motion.div
                    key={tb.token.symbol}
                    layout
                    className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center gap-1.5">
                      {tb.token.metadata?.logoUrl && (
                        <img
                          src={tb.token.metadata.logoUrl.toString()}
                          alt={tb.token.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {tb.token.symbol}
                      </span>
                    </div>
                    <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                      {tb.balance}
                    </div>
                    <div className="text-[10px] text-[var(--text-quaternary)]">
                      {tb.token.name}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* ── B. Send Tokens (collapsible) ──────────────────────── */}
          <div className="space-y-3">
            <button
              onClick={() => setShowSend(!showSend)}
              className="flex items-center justify-between w-full cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Send size={12} strokeWidth={1.5} className="text-[#8B5CF6]" />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Send Tokens
                </span>
              </div>
              {showSend
                ? <ChevronUp size={12} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />
                : <ChevronDown size={12} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />}
            </button>

            <AnimatePresence>
              {showSend && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] space-y-3"
                >
                  {nonZeroBalances.length === 0 ? (
                    <p className="text-xs text-[var(--text-quaternary)] text-center py-2">
                      No tokens with balance to send
                    </p>
                  ) : (
                    <>
                      {/* Token selector */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Token</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {nonZeroBalances.map((tb, i) => (
                            <button
                              key={tb.token.symbol}
                              onClick={() => setSendToken(i)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                                sendToken === i
                                  ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]"
                                  : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#8B5CF6]/20"
                              }`}
                            >
                              {tb.token.metadata?.logoUrl && (
                                <img
                                  src={tb.token.metadata.logoUrl.toString()}
                                  alt={tb.token.symbol}
                                  width={12}
                                  height={12}
                                  className="rounded-full"
                                />
                              )}
                              {tb.token.symbol}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Recipient */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Recipient Address</span>
                        <input
                          type="text"
                          value={sendRecipient}
                          onChange={(e) => setSendRecipient(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[#8B5CF6]/40 transition-colors"
                        />
                      </div>

                      {/* Amount */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Amount</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                            placeholder="0.0"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[#8B5CF6]/40 transition-colors"
                          />
                          <button
                            onClick={() => {
                              const tb = nonZeroBalances[sendToken];
                              if (tb && tb.raw > 0n) {
                                const maxVal = Number(tb.raw) / 10 ** tb.token.decimals;
                                setSendAmount(maxVal.toFixed(tb.token.decimals <= 6 ? 2 : 4));
                              }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#8B5CF6] hover:text-[#8B5CF6]/80 cursor-pointer"
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      {/* Send button */}
                      <motion.button
                        onClick={handleSend}
                        disabled={sending || !sendAmount || !sendRecipient}
                        className="w-full py-3 text-sm font-semibold rounded-xl bg-[#8B5CF6] text-white hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        whileTap={{ scale: 0.98 }}
                        transition={spring}
                      >
                        {sending ? (
                          <><Loader size={14} className="animate-spin" strokeWidth={1.5} /> Sending...</>
                        ) : (
                          <><ArrowRight size={14} strokeWidth={1.5} /> Send {nonZeroBalances[sendToken]?.token.symbol}</>
                        )}
                      </motion.button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── C. Active Staking Positions ──────────────────────── */}
          {(hasPositions || loadingPositions) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Active Stakes</span>
                </div>
                <button
                  onClick={fetchPositions}
                  disabled={loadingPositions}
                  className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} strokeWidth={1.5} className={loadingPositions ? "animate-spin" : ""} />
                </button>
              </div>

              {loadingPositions && positions.length === 0 ? (
                <div className="text-center py-4">
                  <Loader size={14} className="animate-spin mx-auto text-[var(--text-quaternary)]" strokeWidth={1.5} />
                  <p className="text-[10px] text-[var(--text-quaternary)] mt-1.5">Loading positions...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <motion.div
                      key={pos.validatorName}
                      layout
                      className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] space-y-3"
                    >
                      {/* Validator name + commission */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {pos.validatorName}
                        </span>
                        <span className="text-[10px] text-[var(--text-quaternary)]">
                          {pos.position.commissionPercent}% commission
                        </span>
                      </div>

                      {/* Position details */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-[var(--text-quaternary)]">Staked</span>
                          <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--accent-emerald)]">
                            {pos.position.staked.toFormatted(true)}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-[var(--text-quaternary)]">Rewards</span>
                          <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)]">
                            {pos.position.rewards.toFormatted(true)}
                          </div>
                        </div>
                      </div>

                      {/* Unpooling status */}
                      {!pos.position.unpooling.isZero() && (
                        <div className="rounded-lg p-2.5 bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--accent-amber)]">Unstaking in progress</span>
                            <span className="text-[10px] font-[family-name:var(--font-geist-mono)] text-[var(--accent-amber)]">
                              {pos.position.unpooling.toFormatted(true)}
                            </span>
                          </div>
                          {pos.position.unpoolTime && (
                            <p className="text-[10px] text-[var(--text-quaternary)]">
                              {new Date() >= pos.position.unpoolTime
                                ? "Ready to withdraw!"
                                : `Available after ${pos.position.unpoolTime.toLocaleString()}`}
                            </p>
                          )}
                          {pos.position.unpoolTime && new Date() >= pos.position.unpoolTime && (
                            <motion.button
                              onClick={() => handleExit(pos)}
                              disabled={exiting}
                              className="w-full mt-1 py-2 text-[11px] font-semibold rounded-lg bg-[var(--accent-emerald)] text-white hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                              whileTap={{ scale: 0.98 }}
                              transition={spring}
                            >
                              {exiting ? (
                                <><Loader size={10} className="animate-spin" strokeWidth={1.5} /> Withdrawing...</>
                              ) : (
                                <><LogOut size={10} strokeWidth={1.5} /> Complete Withdrawal</>
                              )}
                            </motion.button>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => handleClaimRewards(pos)}
                          disabled={claiming || pos.position.rewards.isZero()}
                          className="flex-1 py-2 text-[11px] font-semibold rounded-lg bg-[#4D4DFF]/10 text-[#4D4DFF] hover:bg-[#4D4DFF]/20 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                          whileTap={{ scale: 0.98 }}
                          transition={spring}
                        >
                          {claiming ? (
                            <><Loader size={10} className="animate-spin" strokeWidth={1.5} /> Claiming...</>
                          ) : (
                            <><Gift size={10} strokeWidth={1.5} /> Claim Rewards</>
                          )}
                        </motion.button>

                        {pos.position.unpooling.isZero() && (
                          <motion.button
                            onClick={() => handleUnstake(pos)}
                            disabled={unstaking}
                            className="flex-1 py-2 text-[11px] font-semibold rounded-lg bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                            whileTap={{ scale: 0.98 }}
                            transition={spring}
                          >
                            {unstaking ? (
                              <><Loader size={10} className="animate-spin" strokeWidth={1.5} /> Unstaking...</>
                            ) : (
                              <><LogOut size={10} strokeWidth={1.5} /> Unstake All</>
                            )}
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── D. Stake Tokens (collapsible) ────────────────────── */}
          <div className="space-y-3">
            <button
              onClick={() => setShowStakeForm(!showStakeForm)}
              className="flex items-center justify-between w-full cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                {hasPositions ? (
                  <Plus size={12} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                ) : (
                  <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
                )}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {hasPositions ? "Stake More" : "Stake Tokens"}
                </span>
              </div>
              {hasPositions && (
                showStakeForm
                  ? <ChevronUp size={12} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />
                  : <ChevronDown size={12} strokeWidth={1.5} className="text-[var(--text-quaternary)]" />
              )}
            </button>

            <AnimatePresence>
              {(!hasPositions || showStakeForm) && (
                <motion.div
                  initial={hasPositions ? { opacity: 0, height: 0 } : false}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] space-y-3"
                >
                  <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                    Delegate tokens to a validator and earn staking rewards. Your tokens remain under your control.
                  </p>

                  {/* Stakeable token selector (if multiple) */}
                  {stakeableTokens.length > 1 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Stake Token</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {stakeableTokens.map((t, i) => (
                          <button
                            key={t.symbol}
                            onClick={() => handleStakeTokenChange(i)}
                            disabled={resolvingValidators}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border disabled:opacity-50 ${
                              selectedStakeToken === i
                                ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]"
                                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-emerald)]/20"
                            }`}
                          >
                            {t.metadata?.logoUrl && (
                              <img
                                src={t.metadata.logoUrl.toString()}
                                alt={t.symbol}
                                width={12}
                                height={12}
                                className="rounded-full"
                              />
                            )}
                            {t.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validator selection */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Select Validator</span>
                      {resolvingValidators && (
                        <Loader size={10} className="animate-spin text-[var(--text-quaternary)]" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {validators.map((v, i) => {
                        const existingPos = positions.find((p) => p.validatorIndex === i);
                        const hasPool = !!v.stakingInstance;
                        // Only disable validators when user explicitly picked a non-STRK token
                        // For STRK (initial load), all validators remain selectable
                        const isNonStrk = activeStakeToken.symbol !== "STRK";
                        const isDisabled = resolvingValidators || (isNonStrk && !hasPool);
                        return (
                          <button
                            key={v.stakerAddress}
                            onClick={() => setSelectedValidator(i)}
                            disabled={isDisabled}
                            className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer border flex items-center gap-2 ${
                              isDisabled
                                ? "opacity-40 cursor-not-allowed bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-quaternary)]"
                                : selectedValidator === i
                                  ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]"
                                  : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-emerald)]/20"
                            }`}
                          >
                            {v.logoUrl && (
                              <img
                                src={v.logoUrl.toString()}
                                alt={v.name}
                                width={16}
                                height={16}
                                className="rounded-full"
                              />
                            )}
                            <span>{v.name}</span>
                            {isNonStrk && !hasPool && (
                              <span className="text-[10px] text-[var(--text-quaternary)]">
                                (no {activeStakeToken.symbol} pool)
                              </span>
                            )}
                            {existingPos && (
                              <span className="text-[10px] text-[var(--text-quaternary)]">
                                ({existingPos.position.staked.toFormatted(true)} staked)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount input */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Amount ({activeStakeToken.symbol})</span>
                    <div className="relative">
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.0"
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-[family-name:var(--font-geist-mono)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-emerald)]/40 transition-colors"
                      />
                      <button
                        onClick={() => {
                          const tokenBal = balances.find((b) => b.token.symbol === activeStakeToken.symbol);
                          if (tokenBal && tokenBal.raw > 0n) {
                            const isGasToken = activeStakeToken.symbol === "STRK" || activeStakeToken.symbol === "ETH";
                            const reserve = isGasToken ? BigInt(10 ** activeStakeToken.decimals) : 0n;
                            const maxStake = tokenBal.raw > reserve ? tokenBal.raw - reserve : 0n;
                            if (maxStake > 0n) {
                              setStakeAmount((Number(maxStake) / 10 ** activeStakeToken.decimals).toFixed(2));
                            }
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#4D4DFF] hover:text-[#4D4DFF]/80 cursor-pointer"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Stake button */}
                  <motion.button
                    onClick={handleStake}
                    disabled={staking || !stakeAmount || resolvingValidators}
                    className="w-full py-3 text-sm font-semibold rounded-xl bg-[var(--accent-emerald)] text-white hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                    transition={spring}
                  >
                    {staking ? (
                      <>
                        <Loader size={14} className="animate-spin" strokeWidth={1.5} />
                        Staking...
                      </>
                    ) : stakeSuccess ? (
                      "Staked Successfully!"
                    ) : (
                      <>
                        <TrendingUp size={14} strokeWidth={1.5} />
                        {positions.find((p) => p.validatorIndex === selectedValidator) ? "Add to Stake" : `Stake ${activeStakeToken.symbol}`}
                      </>
                    )}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
