"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useSmartSend } from "@/hooks/useSmartSend";
import { Coins, TrendingUp, Loader, RefreshCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RPC_URL } from "@/utils/network";
import { RpcProvider, CallData } from "starknet";
import { useToast } from "@/context/ToastContext";

// ── Starkzap token presets (mainnet addresses) ──────────────────────
const TOKENS = [
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb" },
  { symbol: "STRK", name: "Starknet", decimals: 18, address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" },
  { symbol: "ETH", name: "Ethereum", decimals: 18, address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
  { symbol: "WBTC", name: "Wrapped BTC", decimals: 8, address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac" },
] as const;

// ── Starkzap validator presets (top 5) ──────────────────────────────
const VALIDATORS = [
  { name: "Karnot", stakerAddress: "0x072543946080646d1aac08bb4ba6f6531b2b29ce41ebfe72b8a6506500d5220e" },
  { name: "Ready (prev. Argent)", stakerAddress: "0x00d3b910d8c528bf0216866053c3821ac6c97983dc096bff642e9a3549210ee7" },
  { name: "AVNU", stakerAddress: "0x036963c7b56f08105ffdd7f12560924bdc0cb29ce210417ecbc8bf3c7e4b9090" },
  { name: "Braavos", stakerAddress: "0x0474d6a0978dfd80227b163b58d2cd13c0e0ab3715eb42a9e8f12735a1d1d702" },
  { name: "Nethermind", stakerAddress: "0x01d6e3ae9fcc0bf72067cd5f3d7e2fe7c253a80b8e4e17a37a76e1e0b054e8b4" },
] as const;

// Staking manager contract (mainnet)
const STAKING_CONTRACT = "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7";

type TokenBalance = {
  symbol: string;
  name: string;
  balance: string;
  raw: bigint;
};

type ValidatorInfo = {
  name: string;
  stakerAddress: string;
  poolAddress: string | null;
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

function formatBalance(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, Math.min(decimals, 4));
  // Trim trailing zeros
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

  // ── Resolve validator pool addresses from staking manager ────────
  useEffect(() => {
    async function resolveValidators() {
      const infos: ValidatorInfo[] = [];
      for (const v of VALIDATORS) {
        let poolAddress: string | null = null;
        try {
          // Call state_of on staking manager to get StakerInfo
          // StakerInfo layout: reward_address, operational_address, unstake_time (Option<u64>), amount_own, index, unclaimed_rewards_own, pool_info (Option<StakerPoolInfo>)
          // StakerPoolInfo layout: pool_contract, amount, unclaimed_rewards, commission
          const result = await provider.callContract({
            contractAddress: STAKING_CONTRACT,
            entrypoint: "state_of",
            calldata: CallData.compile({ staker_address: v.stakerAddress }),
          });
          // Parse result array to find pool_contract
          // result[0] = reward_address
          // result[1] = operational_address
          // result[2] = unstake_time Option flag (0=None, 1=Some)
          // result[2+1?] = unstake_time value if Some
          // Then: amount_own, index, unclaimed_rewards_own
          // Then: pool_info Option flag (0=None, 1=Some)
          // If Some: pool_contract, amount, unclaimed_rewards, commission
          let idx = 0;
          idx++; // reward_address [0]
          idx++; // operational_address [1]
          const unstakeFlag = Number(BigInt(result[idx])); // [2]
          idx++;
          if (unstakeFlag === 1) idx++; // skip unstake_time value
          idx++; // amount_own
          idx++; // index
          idx++; // unclaimed_rewards_own
          const poolFlag = Number(BigInt(result[idx])); // pool_info Option flag
          idx++;
          if (poolFlag === 1) {
            poolAddress = result[idx]; // pool_contract address
          }
        } catch {
          // If we can't resolve, leave poolAddress null
        }
        infos.push({ name: v.name, stakerAddress: v.stakerAddress, poolAddress });
      }
      setValidators(infos);
    }
    resolveValidators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stake STRK ────────────────────────────────────────────────────
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
      const amountWei = BigInt(Math.floor(amount * 1e18));
      const strkAddress = TOKENS.find((t) => t.symbol === "STRK")!.address;

      if (!validator.poolAddress) {
        setError("Pool address not resolved for this validator. Please try again or select a different validator.");
        setStaking(false);
        return;
      }

      // 1. Approve STRK to the validator's POOL contract (not staking manager)
      // 2. Call enter_delegation_pool on the POOL contract
      //    - reward_address: user's address (where rewards go)
      //    - amount: u128 (single felt, not u256)
      const calls = [
        {
          contractAddress: strkAddress,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: validator.poolAddress,
            amount: { low: (amountWei & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toString(), high: (amountWei >> 128n).toString() },
          }),
        },
        {
          contractAddress: validator.poolAddress,
          entrypoint: "enter_delegation_pool",
          calldata: CallData.compile({
            reward_address: address,
            amount: amountWei.toString(),
          }),
        },
      ];

      await sendAsync(calls);
      setStakeSuccess(true);
      setStakeAmount("");
      toast("success", `Staked ${amount} STRK with ${validator.name}`);
      // Refresh balances
      setTimeout(fetchBalances, 3000);
    } catch (e) {
      setError(`Staking failed: ${e instanceof Error ? e.message : "Transaction rejected"}`);
    }
    setStaking(false);
  }

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

          {/* ── STRK Staking ───────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} strokeWidth={1.5} className="text-[var(--accent-emerald)]" />
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Stake STRK</span>
            </div>

            <div className="rounded-xl p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] space-y-3">
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Delegate STRK to a validator and earn staking rewards. Your tokens remain under your control.
              </p>

              {/* Validator selection */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Select Validator</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {validators.map((v, i) => (
                    <button
                      key={v.stakerAddress}
                      onClick={() => setSelectedValidator(i)}
                      className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                        selectedValidator === i
                          ? "bg-[var(--accent-emerald-dim)] border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]"
                          : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-emerald)]/20"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
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
                        // Leave some for gas
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
                    Stake STRK
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
