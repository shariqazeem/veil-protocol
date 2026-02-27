"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useSmartSend } from "@/hooks/useSmartSend";
import { Coins, TrendingUp, Loader, RefreshCw, Zap, LogOut, Gift, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RPC_URL } from "@/utils/network";
import { RpcProvider, CallData } from "starknet";
import { useToast } from "@/context/ToastContext";
import { Staking, Amount, mainnetValidators, type Address, type Token, type PoolMember } from "starkzap";

// ── Starkzap token presets (mainnet addresses) ──────────────────────
const TOKENS = [
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb" },
  { symbol: "STRK", name: "Starknet", decimals: 18, address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" },
  { symbol: "ETH", name: "Ethereum", decimals: 18, address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
  { symbol: "WBTC", name: "Wrapped BTC", decimals: 8, address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac" },
] as const;

// ── Starkzap validator presets (top 5 from mainnetValidators) ───────
const VALIDATORS = [
  mainnetValidators.KARNOT,
  mainnetValidators.READY_PREV_ARGENT,
  mainnetValidators.AVNU,
  mainnetValidators.BRAAVOS,
  mainnetValidators.NETHERMIND,
];

// Staking config for Starkzap SDK (mainnet staking manager)
const STAKING_CONFIG = { contract: "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7" as Address };

// STRK token definition for Starkzap Amount
const STRK_TOKEN: Token = { name: "Starknet", symbol: "STRK", decimals: 18, address: TOKENS[1].address as Address };

type TokenBalance = {
  symbol: string;
  name: string;
  balance: string;
  raw: bigint;
};

type ValidatorInfo = {
  name: string;
  stakerAddress: string;
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

export default function DefiTab() {
  const { address, isConnected } = useAccount();
  const { sendAsync } = useSmartSend();
  const { toast } = useToast();

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [selectedValidator, setSelectedValidator] = useState<number>(0);
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staking positions
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [showStakeForm, setShowStakeForm] = useState(false);

  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  // ── Fetch balances ────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBalances(true);
    try {
      const results: TokenBalance[] = [];
      for (const token of TOKENS) {
        try {
          const result = await provider.callContract({
            contractAddress: token.address,
            entrypoint: "balance_of",
            calldata: CallData.compile({ account: address }),
          });
          const raw = BigInt(result[0] ?? "0");
          results.push({
            symbol: token.symbol,
            name: token.name,
            balance: formatBalance(raw, token.decimals),
            raw,
          });
        } catch {
          results.push({ symbol: token.symbol, name: token.name, balance: "0", raw: 0n });
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

  // ── Resolve validator staking instances via Starkzap SDK ─────────
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
        infos.push({ name: v.name, stakerAddress: v.stakerAddress, stakingInstance });
      }
      setValidators(infos);
    }
    resolveValidators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          // Create a minimal wallet-like object for getPosition
          const walletProxy = { address: address as Address } as Parameters<Staking["getPosition"]>[0];
          const position = await v.stakingInstance.getPosition(walletProxy);
          if (position && !position.staked.isZero()) {
            found.push({
              validatorName: v.name,
              validatorIndex: i,
              position,
              stakingInstance: v.stakingInstance,
            });
          }
        } catch {
          // Skip if can't fetch
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

  // ── Stake STRK (enter or add) ──────────────────────────────────────
  async function handleStake() {
    if (!isConnected || !address || !stakeAmount) return;

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    const strkBalance = balances.find((b) => b.symbol === "STRK");
    if (!strkBalance || strkBalance.raw < BigInt(Math.floor(amount * 1e18))) {
      setError("Insufficient STRK balance");
      return;
    }

    setStaking(true);
    setError(null);
    setStakeSuccess(false);

    try {
      const validator = validators[selectedValidator];

      if (!validator?.stakingInstance) {
        setError("Pool not resolved for this validator. Please wait or select a different validator.");
        setStaking(false);
        return;
      }

      const strkAmount = Amount.parse(stakeAmount, STRK_TOKEN);

      // Check if already a member — use populateAdd if so, populateEnter if not
      const existingPosition = positions.find((p) => p.validatorIndex === selectedValidator);
      const calls = existingPosition
        ? validator.stakingInstance.populateAdd(address as Address, strkAmount)
        : validator.stakingInstance.populateEnter(address as Address, strkAmount);

      await sendAsync(calls);
      setStakeSuccess(true);
      setStakeAmount("");
      toast("success", `Staked ${amount} STRK with ${validator.name}`);
      setTimeout(() => { fetchBalances(); fetchPositions(); }, 3000);
    } catch (e) {
      setError(`Staking failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setStaking(false);
  }

  // ── Unstake (exit intent) ──────────────────────────────────────────
  async function handleUnstake(pos: StakingPosition) {
    if (!address || !unstakeAmount) return;

    const amount = parseFloat(unstakeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid unstake amount");
      return;
    }

    setUnstaking(true);
    setError(null);

    try {
      const strkAmount = Amount.parse(unstakeAmount, STRK_TOKEN);
      const call = pos.stakingInstance.populateExitIntent(strkAmount);
      await sendAsync([call]);
      setUnstakeAmount("");
      toast("success", `Unstake initiated for ${amount} STRK from ${pos.validatorName}. Wait for the exit window to complete withdrawal.`);
      setTimeout(() => fetchPositions(), 3000);
    } catch (e) {
      setError(`Unstake failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setUnstaking(false);
  }

  // ── Complete exit (after window) ───────────────────────────────────
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

  // ── Claim rewards ──────────────────────────────────────────────────
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

  const hasPositions = positions.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Coins size={14} strokeWidth={1.5} className="text-[#4D4DFF]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            DeFi Dashboard
          </span>
          <span className="text-[10px] font-semibold bg-[#4D4DFF]/10 text-[#4D4DFF] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Zap size={8} strokeWidth={2} />
            Starkzap
          </span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Check your token balances and stake STRK to earn rewards — powered by the Starkzap SDK.
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
          <Coins size={24} className="mx-auto mb-3 text-[var(--text-quaternary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">Connect wallet to view balances</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Your token balances and staking options will appear here
          </p>
        </div>
      ) : (
        <>
          {/* ── Token Balances ──────────────────────────────────────── */}
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
                {balances.map((token) => (
                  <motion.div
                    key={token.symbol}
                    layout
                    className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {token.symbol}
                      </span>
                    </div>
                    <div className="text-[13px] font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-primary)] font-tabular">
                      {token.balance}
                    </div>
                    <div className="text-[10px] text-[var(--text-quaternary)]">
                      {token.name}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* ── Active Staking Positions ────────────────────────────── */}
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
                        {/* Claim Rewards */}
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

                        {/* Unstake */}
                        {pos.position.unpooling.isZero() && (
                          <motion.button
                            onClick={() => {
                              setUnstakeAmount(pos.position.staked.toUnit());
                              handleUnstake(pos);
                            }}
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

          {/* ── STRK Staking ───────────────────────────────────────── */}
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
                  {hasPositions ? "Stake More STRK" : "Stake STRK"}
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
                    Delegate STRK to a validator and earn staking rewards. Your tokens remain under your control.
                  </p>

                  {/* Validator selection */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Select Validator</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {validators.map((v, i) => {
                        const existingPos = positions.find((p) => p.validatorIndex === i);
                        return (
                          <button
                            key={v.stakerAddress}
                            onClick={() => setSelectedValidator(i)}
                            className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                              selectedValidator === i
                                ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]"
                                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-emerald)]/20"
                            }`}
                          >
                            <span>{v.name}</span>
                            {existingPos && (
                              <span className="ml-2 text-[10px] text-[var(--text-quaternary)]">
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
                    <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Amount (STRK)</span>
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
                          const strk = balances.find((b) => b.symbol === "STRK");
                          if (strk && strk.raw > 0n) {
                            const maxStake = strk.raw - BigInt(1e18);
                            if (maxStake > 0n) {
                              setStakeAmount((Number(maxStake) / 1e18).toFixed(2));
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
                    disabled={staking || !stakeAmount}
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
                        {positions.find((p) => p.validatorIndex === selectedValidator) ? "Add to Stake" : "Stake STRK"}
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
