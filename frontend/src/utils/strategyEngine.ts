/**
 * Veil Strategist — Deterministic AI Strategy Engine
 *
 * Generates structured accumulation plans from natural language input.
 * No external API dependency — all logic is deterministic with
 * template-based narrative generation for typewriter display.
 *
 * Supports 5 strategy types:
 *   1. privacy_first  — highest anonymity set tier, all deposits there
 *   2. efficiency     — largest affordable tier, single multicall
 *   3. stealth_dca    — randomize across tiers for cross-pool obfuscation
 *   4. whale          — spread across ALL tiers to strengthen protocol-wide anonymity
 *   5. balanced       — (default) optimal tier by amount
 */

import { DENOMINATIONS, DENOMINATION_LABELS } from "./privacy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StrategyType =
  | "privacy_first"
  | "efficiency"
  | "stealth_dca"
  | "whale"
  | "balanced";

export interface PoolState {
  pendingUsdc: number;   // in human-readable USD (not raw 6-decimal)
  batchCount: number;
  leafCount: number;
  anonSets: Record<number, number>; // tier -> count
  btcPrice: number;
}

export interface AgentStep {
  tier: number;           // 0, 1, 2, or 3
  label: string;          // "$1", "$10", "$100", "$1,000"
  usdcAmount: number;     // human-readable
  delaySeconds: number;   // randomized delay before this step
  description: string;    // e.g. "Deposit $10 into tier 1 (anonymity set: 5)"
}

export interface AgentPlan {
  analysis: string;
  strategy: {
    totalUsdc: number;
    steps: AgentStep[];
    estimatedBtc: string;
    privacyScore: string;
    csiImpact: string;
    riskScore?: number;
    riskFactors?: string[];
  };
  reasoning: string;
}

/** Individual log line emitted during agent "thinking" */
export interface AgentLogEntry {
  timestamp: number;
  type: "think" | "observe" | "decide" | "act" | "result";
  message: string;
}

/** Pool health assessment */
export interface PoolHealth {
  rating: "Excellent" | "Strong" | "Moderate" | "Weak";
  score: number;
  weakestTier: { tier: number; label: string; count: number } | null;
  strongestTier: { tier: number; label: string; count: number } | null;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Intent Parsing — Enhanced NLP
// ---------------------------------------------------------------------------

/** Word-number map for natural language parsing */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  thousand: 1000, "a thousand": 1000, "a hundred": 100,
};

/** Extract a target USD amount from natural language. */
export function parseTargetUsdc(input: string, btcPrice?: number): number | null {
  const lower = input.toLowerCase().trim();

  // BTC-denominated: "0.5 BTC", "half a bitcoin"
  if (btcPrice && btcPrice > 0) {
    const btcMatch = lower.match(/([\d.]+)\s*(?:btc|bitcoin)/i);
    if (btcMatch) {
      return Math.round(parseFloat(btcMatch[1]) * btcPrice);
    }
    if (/half\s+a?\s*bitcoin/i.test(lower)) {
      return Math.round(0.5 * btcPrice);
    }
  }

  // Shorthand: "all in", "max out" -> $1,000
  if (/all\s*in|max\s*out|maximum/i.test(lower)) {
    return 1000;
  }

  // Standard dollar patterns
  const patterns = [
    /\$\s?([\d,]+(?:\.\d+)?)/,
    /([\d,]+(?:\.\d+)?)\s*(?:dollars?|usd|usdc)/i,
    /accumulate\s+([\d,]+)/i,
    /invest\s+([\d,]+)/i,
    /deposit\s+([\d,]+)/i,
    /dca\s+([\d,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ""));
    }
  }

  // Word numbers: "fifty dollars", "a hundred", "a thousand"
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (lower.includes(word)) {
      return num;
    }
  }

  // Bare number fallback
  const bareNumber = input.match(/\b(\d+(?:\.\d+)?)\b/);
  if (bareNumber) {
    return parseFloat(bareNumber[1]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Strategy Detection — Weighted Multi-Keyword System
// ---------------------------------------------------------------------------

interface StrategyScores {
  privacy_first: number;
  efficiency: number;
  stealth_dca: number;
  whale: number;
  balanced: number;
}

/** Detect strategy type from user input with weighted keyword scoring. */
export function detectStrategyType(input: string, targetUsdc: number): StrategyType {
  const lower = input.toLowerCase();
  const scores: StrategyScores = { privacy_first: 0, efficiency: 0, stealth_dca: 0, whale: 0, balanced: 0 };

  // Privacy keywords
  if (/\bmax\w*\s+privac/i.test(lower)) scores.privacy_first += 4;
  else if (/privac/i.test(lower)) scores.privacy_first += 3;
  if (/anonym/i.test(lower)) scores.privacy_first += 3;
  if (/stealth/i.test(lower)) scores.privacy_first += 2;
  if (/hidden|invisible|untrace/i.test(lower)) scores.privacy_first += 2;
  if (/strongest\s+(?:pool|set|tier)/i.test(lower)) scores.privacy_first += 3;

  // Efficiency keywords
  if (/efficien/i.test(lower)) scores.efficiency += 3;
  if (/\bfast\b/i.test(lower)) scores.efficiency += 2;
  if (/\bquick\b/i.test(lower)) scores.efficiency += 2;
  if (/\bcheap\b/i.test(lower)) scores.efficiency += 2;
  if (/\bgas\b/i.test(lower)) scores.efficiency += 1;
  if (/single\s+(?:tx|transaction)/i.test(lower)) scores.efficiency += 2;

  // DCA keywords
  if (/\bdca\b/i.test(lower)) scores.stealth_dca += 4;
  if (/spread/i.test(lower)) scores.stealth_dca += 2;
  if (/over\s+(?:time|\d+)/i.test(lower)) scores.stealth_dca += 3;
  if (/split/i.test(lower)) scores.stealth_dca += 2;
  if (/multiple/i.test(lower)) scores.stealth_dca += 2;
  if (/diversif/i.test(lower)) scores.stealth_dca += 2;
  if (/gradual/i.test(lower)) scores.stealth_dca += 2;

  // Whale auto-detection
  if (targetUsdc >= 500) scores.whale += 2;
  if (targetUsdc >= 1000) scores.whale += 2;
  if (/whale|big|large|massive/i.test(lower)) scores.whale += 3;

  // Balanced hints
  if (/balanced?|optimal|recommend/i.test(lower)) scores.balanced += 3;

  // Find highest score
  const entries = Object.entries(scores) as [StrategyType, number][];
  const max = entries.reduce((best, curr) => curr[1] > best[1] ? curr : best, entries[4]);

  // Default to balanced if no strong signal
  if (max[1] === 0) return "balanced";
  return max[0];
}

/** Detect if user wants a DCA / spread pattern. */
function wantsDCA(input: string): { isDCA: boolean; depositCount?: number } {
  const dcaMatch = input.match(/(\d+)\s*(?:deposits?|steps?|tranches?|times?)/i);
  if (dcaMatch) return { isDCA: true, depositCount: parseInt(dcaMatch[1]) };
  if (/dca|spread|split|multiple|gradual/i.test(input)) return { isDCA: true };
  return { isDCA: false };
}

// ---------------------------------------------------------------------------
// Pool Health Assessment
// ---------------------------------------------------------------------------

export function computePoolHealth(poolState: PoolState): PoolHealth {
  const tiers = [
    { tier: 0, label: "$1", count: poolState.anonSets[0] ?? 0 },
    { tier: 1, label: "$10", count: poolState.anonSets[1] ?? 0 },
    { tier: 2, label: "$100", count: poolState.anonSets[2] ?? 0 },
    { tier: 3, label: "$1,000", count: poolState.anonSets[3] ?? 0 },
  ];

  const totalAnon = tiers.reduce((s, t) => s + t.count, 0);
  const activeTiers = tiers.filter(t => t.count > 0).length;
  const maxAnon = Math.max(...tiers.map(t => t.count));
  const minAnon = Math.min(...tiers.map(t => t.count));

  const weakest = [...tiers].sort((a, b) => a.count - b.count)[0];
  const strongest = [...tiers].sort((a, b) => b.count - a.count)[0];

  // Score 0-100 based on total participants, tier balance, and coverage
  let score = 0;
  score += Math.min(totalAnon * 2, 40);       // up to 40 from total participants
  score += activeTiers * 10;                    // up to 30 from tier coverage
  score += Math.min(minAnon * 5, 30);          // up to 30 from weakest tier

  const rating: PoolHealth["rating"] =
    score >= 80 ? "Excellent" :
    score >= 50 ? "Strong" :
    score >= 25 ? "Moderate" : "Weak";

  let recommendation: string;
  if (score >= 80) {
    recommendation = "All tiers have strong anonymity sets. Any strategy is viable.";
  } else if (weakest.count <= 2) {
    recommendation = `${weakest.label} pool needs participants — contributing here maximizes marginal privacy impact.`;
  } else if (activeTiers < 4) {
    recommendation = "Some tiers are empty. Whale distribution across all tiers would strengthen protocol-wide privacy.";
  } else {
    recommendation = `Growing coverage. The ${weakest.label} tier would benefit most from additional deposits.`;
  }

  return {
    rating,
    score,
    weakestTier: weakest,
    strongestTier: strongest,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Risk Assessment
// ---------------------------------------------------------------------------

export function assessRisk(
  steps: AgentStep[],
  poolState: PoolState,
  btcPrice: number,
): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Single-tier concentration
  const tiersUsed = new Set(steps.map(s => s.tier));
  if (tiersUsed.size === 1 && steps.length > 2) {
    score += 15;
    factors.push("Single-tier concentration — all deposits in one pool");
  }

  // Low anonymity set in target tier
  for (const tier of tiersUsed) {
    const anonSet = poolState.anonSets[tier] ?? 0;
    if (anonSet < 3) {
      score += 25;
      factors.push(`Low anonymity set in ${DENOMINATION_LABELS[tier]} tier (${anonSet} participants)`);
    } else if (anonSet < 5) {
      score += 10;
      factors.push(`Growing anonymity set in ${DENOMINATION_LABELS[tier]} tier (${anonSet} participants)`);
    }
  }

  // No temporal decorrelation
  const hasDelays = steps.some(s => s.delaySeconds > 0);
  if (!hasDelays && steps.length > 1) {
    score += 10;
    factors.push("No temporal decorrelation — all deposits in same block");
  }

  // Large single position
  const totalUsdc = steps.reduce((s, step) => s + step.usdcAmount, 0);
  if (totalUsdc >= 500) {
    score += 10;
    factors.push("Large position — may draw attention if anonymity sets are small");
  }

  // Low BTC price confidence
  if (btcPrice <= 0) {
    score += 20;
    factors.push("BTC price unavailable — conversion estimates uncertain");
  }

  if (factors.length === 0) {
    factors.push("No significant risk factors identified");
  }

  return { score: Math.min(score, 100), factors };
}

// ---------------------------------------------------------------------------
// Tranche Optimization
// ---------------------------------------------------------------------------

interface TierOption {
  tier: number;
  label: string;
  usdcPerDeposit: number;
  anonSet: number;
}

function getTierOptions(poolState: PoolState): TierOption[] {
  return Object.entries(DENOMINATIONS).map(([tier, rawAmount]) => ({
    tier: Number(tier),
    label: DENOMINATION_LABELS[Number(tier)],
    usdcPerDeposit: rawAmount / 1_000_000,
    anonSet: poolState.anonSets[Number(tier)] ?? 0,
  }));
}

/** Pick the best tier based on strategy type. */
function selectOptimalTier(
  targetUsdc: number,
  poolState: PoolState,
  strategyType: StrategyType,
): TierOption {
  const tiers = getTierOptions(poolState);
  const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);

  if (affordable.length === 0) return tiers[0];

  switch (strategyType) {
    case "privacy_first":
      return affordable.reduce((best, t) =>
        t.anonSet > best.anonSet ? t : best
      );

    case "efficiency":
    case "stealth_dca":
    case "whale":
    case "balanced":
    default:
      return affordable[affordable.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Step Generation per Strategy Type
// ---------------------------------------------------------------------------

function generateSteps(
  targetUsdc: number,
  poolState: PoolState,
  strategyType: StrategyType,
  requestedCount?: number,
): AgentStep[] {
  const tiers = getTierOptions(poolState);
  const steps: AgentStep[] = [];

  switch (strategyType) {
    case "privacy_first": {
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;

      // Smart tier selection: if all anon sets are small (< 5), prefer the
      // largest affordable tier — joining a $10 pool with 0 participants is
      // better UX than 30x $1 deposits, and the marginal privacy is the same.
      const bestAnon = affordable.reduce((best, t) =>
        t.anonSet > best.anonSet ? t : best
      );
      const chosen = bestAnon.anonSet < 5
        ? affordable[affordable.length - 1] // largest affordable tier
        : bestAnon;                          // tier with strongest anon set

      let numDeposits = Math.floor(targetUsdc / chosen.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = Math.min(requestedCount, 10);
      numDeposits = Math.min(numDeposits, 10); // hard cap

      for (let i = 0; i < numDeposits; i++) {
        steps.push({
          tier: chosen.tier,
          label: chosen.label,
          usdcAmount: chosen.usdcPerDeposit,
          delaySeconds: i === 0 ? 0 : randomDelay(30, 90),
          description: `Deposit ${chosen.label} into tier ${chosen.tier} — privacy-first (${chosen.anonSet + i + 1} participants)`,
        });
      }
      break;
    }

    case "efficiency": {
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      const largest = affordable[affordable.length - 1];
      let numDeposits = Math.floor(targetUsdc / largest.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = Math.min(requestedCount, 10);
      numDeposits = Math.min(numDeposits, 10);
      for (let i = 0; i < numDeposits; i++) {
        steps.push({
          tier: largest.tier,
          label: largest.label,
          usdcAmount: largest.usdcPerDeposit,
          delaySeconds: 0,
          description: `Deposit ${largest.label} into tier ${largest.tier} — efficient single batch`,
        });
      }
      break;
    }

    case "stealth_dca": {
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      let remaining = targetUsdc;
      let depositIdx = 0;
      const maxDeposits = Math.min(requestedCount && requestedCount > 0 ? requestedCount : 5, 10);

      while (remaining > 0 && depositIdx < maxDeposits) {
        const available = affordable.filter((t) => t.usdcPerDeposit <= remaining);
        if (available.length === 0) break;
        const pick = available[Math.floor(Math.random() * available.length)];
        steps.push({
          tier: pick.tier,
          label: pick.label,
          usdcAmount: pick.usdcPerDeposit,
          delaySeconds: depositIdx === 0 ? 0 : randomDelay(45, 180),
          description: `Deposit ${pick.label} into tier ${pick.tier} — cross-pool obfuscation (set: ${pick.anonSet + 1})`,
        });
        remaining -= pick.usdcPerDeposit;
        depositIdx++;
      }
      break;
    }

    case "whale": {
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      let remaining = targetUsdc;
      let depositIdx = 0;
      const sortedDesc = [...affordable].sort((a, b) => b.usdcPerDeposit - a.usdcPerDeposit);
      let tierIdx = 0;

      while (remaining > 0 && depositIdx < 10) {
        const current = sortedDesc[tierIdx % sortedDesc.length];
        if (current.usdcPerDeposit > remaining) {
          const smaller = sortedDesc.find((t) => t.usdcPerDeposit <= remaining);
          if (!smaller) break;
          steps.push({
            tier: smaller.tier,
            label: smaller.label,
            usdcAmount: smaller.usdcPerDeposit,
            delaySeconds: depositIdx === 0 ? 0 : randomDelay(20, 90),
            description: `Deposit ${smaller.label} into tier ${smaller.tier} — protocol-wide liquidity (whale distribution)`,
          });
          remaining -= smaller.usdcPerDeposit;
        } else {
          steps.push({
            tier: current.tier,
            label: current.label,
            usdcAmount: current.usdcPerDeposit,
            delaySeconds: depositIdx === 0 ? 0 : randomDelay(20, 90),
            description: `Deposit ${current.label} into tier ${current.tier} — protocol-wide liquidity (whale distribution)`,
          });
          remaining -= current.usdcPerDeposit;
        }
        tierIdx++;
        depositIdx++;
      }
      break;
    }

    case "balanced":
    default: {
      const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
      if (affordable.length === 0) break;
      const tier = affordable[affordable.length - 1];
      let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
      if (numDeposits < 1) numDeposits = 1;
      if (requestedCount && requestedCount > 0) numDeposits = Math.min(requestedCount, 10);
      numDeposits = Math.min(numDeposits, 10);
      for (let i = 0; i < numDeposits; i++) {
        const delay = i === 0 ? 0 : randomDelay(30, 120);
        steps.push({
          tier: tier.tier,
          label: tier.label,
          usdcAmount: tier.usdcPerDeposit,
          delaySeconds: delay,
          description: `Deposit ${tier.label} into tier ${tier.tier} (anonymity set: ${tier.anonSet + i + 1})`,
        });
      }
      break;
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Delay Randomization
// ---------------------------------------------------------------------------

function randomDelay(minSeconds: number, maxSeconds: number): number {
  return Math.floor(minSeconds + Math.random() * (maxSeconds - minSeconds));
}

// ---------------------------------------------------------------------------
// CSI Calculation
// ---------------------------------------------------------------------------

function computeCSI(anonSets: Record<number, number>): number {
  const values = Object.values(anonSets);
  const activeTranches = values.filter((a) => a > 0).length;
  const maxParticipants = Math.max(...values, 0);
  return maxParticipants * activeTranches;
}

// ---------------------------------------------------------------------------
// Strategy-specific narrative helpers
// ---------------------------------------------------------------------------

const STRATEGY_LABELS: Record<StrategyType, string> = {
  privacy_first: "Privacy-First",
  efficiency: "Efficiency",
  stealth_dca: "Stealth DCA",
  whale: "Whale Distribution",
  balanced: "Balanced",
};

const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  privacy_first: "Maximizing anonymity set size — all deposits target the strongest pool.",
  efficiency: "Single atomic multicall — minimum gas, maximum speed.",
  stealth_dca: "Cross-pool obfuscation — randomized tiers with temporal decorrelation.",
  whale: "Protocol-wide liquidity injection — strengthening every anonymity tier.",
  balanced: "Optimal balance of privacy coverage and execution efficiency.",
};

// ---------------------------------------------------------------------------
// Narrative Variation Templates
// ---------------------------------------------------------------------------

const OBSERVE_TEMPLATES = {
  intent: [
    (input: string) => `Parsing intent: "${input}"`,
    (input: string) => `Analyzing request: "${input}"`,
    (input: string) => `Processing directive: "${input}"`,
  ],
  target: [
    (target: number) => `Target: $${target} USDC -> BTC accumulation`,
    (target: number) => `Objective: convert $${target} USDC to confidential BTC position`,
    (target: number) => `Goal identified: $${target} USDC deployment into shielded pool`,
  ],
  btcPrice: [
    (price: string) => `Live BTC: $${price} (CoinGecko)`,
    (price: string) => `Current BTC market rate: $${price}`,
    (price: string) => `BTC spot price: $${price} — rates locked at batch conversion`,
  ],
};

const THINK_TEMPLATES = {
  evaluating: [
    (label: string) => `Evaluating 4 anonymity tiers for ${label} optimization...`,
    (label: string) => `Scanning pool topology for ${label} strategy deployment...`,
    (label: string) => `Analyzing tier composition — ${label} constraints applied...`,
  ],
  csi: [
    (csi: number) => `Current Confidentiality Strength Index: ${csi}`,
    (csi: number) => `Protocol CSI score: ${csi} — ${csi >= 30 ? "strong foundation" : csi >= 15 ? "growing coverage" : "early stage, high marginal impact"}`,
  ],
};

const DECIDE_TEMPLATES = {
  plan: [
    (count: number, total: number, tiers: number) => `Plan: ${count} deposits = $${total} USDC across ${tiers} tier(s)`,
    (count: number, total: number, tiers: number) => `Execution plan: ${count}x deposits totaling $${total} USDC, ${tiers} tier(s) engaged`,
  ],
  btcEstimate: [
    (btc: string) => `Estimated yield: ${btc} BTC (1% slippage buffer)`,
    (btc: string) => `Projected BTC acquisition: ${btc} (after protocol + DEX slippage)`,
  ],
};

// ---------------------------------------------------------------------------
// Agent Thinking Loop — generates log entries for streaming display
// ---------------------------------------------------------------------------

export function generateAgentLog(
  targetUsdc: number,
  poolState: PoolState,
  btcPrice: number,
  userInput: string,
): AgentLogEntry[] {
  const logs: AgentLogEntry[] = [];
  let t = Date.now();
  const tick = () => { t += 120 + Math.random() * 300; return t; };

  const strategyType = detectStrategyType(userInput, targetUsdc);
  const { isDCA, depositCount: requestedCount } = wantsDCA(userInput);
  const tiers = getTierOptions(poolState);
  const health = computePoolHealth(poolState);

  // Phase 1: Observation — with narrative variation
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.intent)(userInput) });
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.target)(targetUsdc) });
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.btcPrice)(btcPrice.toLocaleString()) });
  logs.push({ timestamp: tick(), type: "observe", message: `Pool state: ${poolState.leafCount} commitments, ${Object.values(poolState.anonSets).reduce((s, v) => s + v, 0)} active participants` });
  logs.push({ timestamp: tick(), type: "observe", message: `Detected strategy: ${STRATEGY_LABELS[strategyType]}` });

  // Phase 2: Analysis — with pool health integration
  logs.push({ timestamp: tick(), type: "think", message: pickRandom(THINK_TEMPLATES.evaluating)(STRATEGY_LABELS[strategyType]) });

  for (const tier of tiers) {
    const strength = tier.anonSet >= 10 ? "STRONG" : tier.anonSet >= 5 ? "GOOD" : tier.anonSet >= 3 ? "MODERATE" : "LOW";
    logs.push({ timestamp: tick(), type: "think", message: `  ${tier.label} pool: ${tier.anonSet} participants -> ${strength} unlinkability` });
  }

  if (poolState.pendingUsdc > 0) {
    logs.push({ timestamp: tick(), type: "think", message: `Pending pool: $${poolState.pendingUsdc.toFixed(2)} awaiting batch conversion` });
  }

  const csi = computeCSI(poolState.anonSets);
  logs.push({ timestamp: tick(), type: "think", message: pickRandom(THINK_TEMPLATES.csi)(csi) });

  // Pool health insight
  logs.push({ timestamp: tick(), type: "think", message: `Pool health: ${health.rating} (score: ${health.score}/100)` });
  if (health.weakestTier && health.weakestTier.count < 5) {
    logs.push({ timestamp: tick(), type: "think", message: `Insight: ${health.recommendation}` });
  }

  // Strategy-specific thinking logs
  switch (strategyType) {
    case "privacy_first":
      logs.push({ timestamp: tick(), type: "think", message: pickRandom([
        `Privacy-first mode: routing all deposits to highest anonymity set.`,
        `Maximum privacy protocol: concentrating in strongest tier for optimal cover.`,
      ]) });
      logs.push({ timestamp: tick(), type: "think", message: pickRandom([
        `Sacrificing efficiency for maximum unlinkability guarantee.`,
        `Trade-off accepted: higher gas cost for stronger anonymity guarantees.`,
      ]) });
      break;
    case "efficiency":
      logs.push({ timestamp: tick(), type: "think", message: `Efficiency mode: selecting largest tier for minimum transaction count.` });
      logs.push({ timestamp: tick(), type: "think", message: `All deposits batched atomically — zero delays, single confirmation.` });
      break;
    case "stealth_dca":
      logs.push({ timestamp: tick(), type: "think", message: pickRandom([
        `Stealth DCA: randomizing tier selection for cross-pool obfuscation.`,
        `Cross-pool scatter pattern: deposits distributed unpredictably across tiers.`,
      ]) });
      logs.push({ timestamp: tick(), type: "think", message: `Extended delays (45-180s) prevent temporal correlation analysis.` });
      break;
    case "whale":
      logs.push({ timestamp: tick(), type: "think", message: `Whale distribution: spreading across ALL tiers to strengthen protocol-wide anonymity.` });
      logs.push({ timestamp: tick(), type: "think", message: `Large deposit detected ($${targetUsdc}). Every tier benefits from added liquidity.` });
      break;
    case "balanced":
    default:
      if (isDCA) {
        logs.push({ timestamp: tick(), type: "think", message: `DCA pattern requested. Spreading deposits for temporal decorrelation.` });
      }
      break;
  }

  // Phase 3: Decision
  const steps = generateSteps(targetUsdc, poolState, strategyType, requestedCount);
  const totalUsdc = steps.reduce((sum, s) => sum + s.usdcAmount, 0);
  const estBtc = (totalUsdc / btcPrice) * 0.99;

  logs.push({ timestamp: tick(), type: "decide", message: `Strategy: ${STRATEGY_LABELS[strategyType]} — ${STRATEGY_DESCRIPTIONS[strategyType]}` });
  logs.push({ timestamp: tick(), type: "decide", message: pickRandom(DECIDE_TEMPLATES.plan)(steps.length, totalUsdc, new Set(steps.map(s => s.tier)).size) });
  logs.push({ timestamp: tick(), type: "decide", message: pickRandom(DECIDE_TEMPLATES.btcEstimate)(estBtc.toFixed(estBtc < 0.01 ? 6 : 4)) });

  if (strategyType === "efficiency") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: single atomic multicall (zero delay, maximum efficiency)` });
  } else if (strategyType === "stealth_dca") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: randomized DCA — relayer executes with 45-180s delays, random tiers` });
  } else if (strategyType === "whale") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: distributed execution across all tiers with 20-90s delays` });
  } else if (strategyType === "privacy_first") {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: sequential deposits with 30-90s delays into max-privacy tier` });
  } else if (isDCA) {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: autonomous DCA — relayer executes with 30-120s delays (1 signature)` });
  } else {
    logs.push({ timestamp: tick(), type: "decide", message: `Timing: single atomic multicall (maximum efficiency)` });
  }

  logs.push({ timestamp: tick(), type: "decide", message: `Post-execution: auto-trigger batch conversion via AVNU` });

  // Risk assessment
  const risk = assessRisk(steps, poolState, btcPrice);
  if (risk.score > 20) {
    logs.push({ timestamp: tick(), type: "decide", message: `Risk score: ${risk.score}/100 — ${risk.factors[0]}` });
  }

  const projectedAnonSets = { ...poolState.anonSets };
  for (const step of steps) {
    projectedAnonSets[step.tier] = (projectedAnonSets[step.tier] ?? 0) + 1;
  }
  const projectedCSI = computeCSI(projectedAnonSets);
  logs.push({ timestamp: tick(), type: "decide", message: `CSI impact: ${csi} -> ${projectedCSI} (+${projectedCSI - csi})` });

  logs.push({ timestamp: tick(), type: "result", message: pickRandom([
    `Strategy ready. Awaiting execution authorization.`,
    `Plan optimized. Ready for autonomous deployment.`,
    `Analysis complete. Execute to deploy on Starknet.`,
  ]) });

  return logs;
}

// ---------------------------------------------------------------------------
// Strategy Generation (structured plan)
// ---------------------------------------------------------------------------

export function generateStrategy(
  targetUsdc: number,
  poolState: PoolState,
  btcPrice: number,
  userInput: string = "",
): AgentPlan {
  const strategyType = detectStrategyType(userInput, targetUsdc);
  const { depositCount: requestedCount } = wantsDCA(userInput);

  const steps = generateSteps(targetUsdc, poolState, strategyType, requestedCount);

  const totalUsdc = steps.reduce((sum, s) => sum + s.usdcAmount, 0);
  const estimatedBtc = totalUsdc / btcPrice;
  const slippageAdjustedBtc = estimatedBtc * 0.99;

  const currentCSI = computeCSI(poolState.anonSets);
  const projectedAnonSets = { ...poolState.anonSets };
  for (const step of steps) {
    projectedAnonSets[step.tier] = (projectedAnonSets[step.tier] ?? 0) + 1;
  }
  const projectedCSI = computeCSI(projectedAnonSets);

  const maxProjectedAnon = Math.max(...Object.values(projectedAnonSets));
  const privacyLabel =
    maxProjectedAnon >= 20 ? "Maximum" :
    maxProjectedAnon >= 10 ? "Strong" :
    maxProjectedAnon >= 5 ? "Good" :
    maxProjectedAnon >= 3 ? "Moderate" : "Low";

  const tiersUsed = [...new Set(steps.map(s => s.tier))];
  const tierSummary = tiersUsed.length === 1
    ? `${steps[0].label} pool`
    : `${tiersUsed.length} pools`;

  const primaryTier = selectOptimalTier(targetUsdc, poolState, strategyType);
  const risk = assessRisk(steps, poolState, btcPrice);

  const analysis = buildAnalysis(poolState, btcPrice, primaryTier, totalUsdc, strategyType);
  const reasoning = buildReasoning(primaryTier, steps.length, strategyType, poolState, projectedCSI, steps);

  return {
    analysis,
    strategy: {
      totalUsdc,
      steps,
      estimatedBtc: slippageAdjustedBtc.toFixed(slippageAdjustedBtc < 0.01 ? 6 : 4),
      privacyScore: `${privacyLabel} (${maxProjectedAnon} participants across ${tierSummary})`,
      csiImpact: `${currentCSI} -> ${projectedCSI}`,
      riskScore: risk.score,
      riskFactors: risk.factors,
    },
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Narrative Templates
// ---------------------------------------------------------------------------

function buildAnalysis(
  poolState: PoolState,
  btcPrice: number,
  tier: TierOption,
  totalUsdc: number,
  strategyType: StrategyType,
): string {
  const lines: string[] = [];

  lines.push(`MARKET ASSESSMENT`);
  lines.push(`BTC is trading at $${btcPrice.toLocaleString()}. At current rates, $${totalUsdc} converts to approximately ${(totalUsdc / btcPrice).toFixed(6)} BTC before slippage adjustment.`);
  lines.push(``);

  lines.push(`POOL STATE ANALYSIS`);
  const totalAnon = Object.values(poolState.anonSets).reduce((s, v) => s + v, 0);
  lines.push(`The protocol currently has ${totalAnon} active commitments across ${Object.values(poolState.anonSets).filter(v => v > 0).length} active tiers.`);

  const tierNames = ["$1", "$10", "$100", "$1,000"];
  const tierDetails = tierNames.map(
    (name, i) => `${name}: ${poolState.anonSets[i] ?? 0} participants`
  );
  lines.push(`Anonymity sets: ${tierDetails.join(" | ")}`);

  // Pool health
  const health = computePoolHealth(poolState);
  lines.push(`Pool health: ${health.rating} (${health.score}/100)`);

  if (poolState.pendingUsdc > 0) {
    lines.push(`Pending pool: $${poolState.pendingUsdc.toLocaleString()} USDC awaiting batch conversion.`);
  }
  lines.push(``);

  lines.push(`STRATEGY MODE: ${STRATEGY_LABELS[strategyType].toUpperCase()}`);
  lines.push(STRATEGY_DESCRIPTIONS[strategyType]);
  lines.push(``);

  lines.push(`RECOMMENDED APPROACH`);

  switch (strategyType) {
    case "privacy_first":
      lines.push(`All deposits routed to the tier with the highest anonymity set for maximum unlinkability.`);
      break;
    case "efficiency":
      lines.push(`The ${tier.label} USDC tier selected for fewest deposits. Atomic multicall minimizes gas and latency.`);
      break;
    case "stealth_dca":
      lines.push(`Deposits randomized across tiers. Cross-pool distribution makes correlation analysis computationally infeasible.`);
      break;
    case "whale":
      lines.push(`Large position distributed across all available tiers. Each tier's anonymity set benefits from added liquidity, strengthening protocol-wide privacy.`);
      break;
    case "balanced":
    default:
      lines.push(`The ${tier.label} USDC tier offers the best risk-adjusted privacy. Current anonymity set of ${tier.anonSet} participants provides ${tier.anonSet >= 10 ? "strong" : tier.anonSet >= 5 ? "good" : "growing"} cover.`);
      break;
  }

  return lines.join("\n");
}

function buildReasoning(
  tier: TierOption,
  numDeposits: number,
  strategyType: StrategyType,
  poolState: PoolState,
  projectedCSI: number,
  steps: AgentStep[],
): string {
  const lines: string[] = [];

  lines.push(`STRATEGY RATIONALE`);

  switch (strategyType) {
    case "privacy_first":
      lines.push(`Privacy-first execution: all ${numDeposits} deposit(s) target the tier with the highest anonymity set (${tier.anonSet} participants). This maximizes the probability of unlinkability at the cost of capital efficiency.`);
      break;
    case "efficiency":
      lines.push(`Efficiency execution: selected ${tier.label} tier for the fewest possible deposits. Zero-delay atomic multicall ensures minimum gas cost and instant settlement.`);
      break;
    case "stealth_dca": {
      const tierCounts: Record<string, number> = {};
      for (const s of steps) {
        tierCounts[s.label] = (tierCounts[s.label] ?? 0) + 1;
      }
      const dist = Object.entries(tierCounts).map(([k, v]) => `${v}x ${k}`).join(", ");
      lines.push(`Stealth DCA: deposits randomized across tiers (${dist}). Cross-pool distribution with extended delays (45-180s) makes temporal and amount-based correlation analysis infeasible.`);
      break;
    }
    case "whale": {
      const tierCounts: Record<string, number> = {};
      for (const s of steps) {
        tierCounts[s.label] = (tierCounts[s.label] ?? 0) + 1;
      }
      const dist = Object.entries(tierCounts).map(([k, v]) => `${v}x ${k}`).join(", ");
      lines.push(`Whale distribution: ${numDeposits} deposits spread across all tiers (${dist}). Every anonymity set in the protocol benefits from added liquidity. This is the most altruistic strategy — strengthening privacy for all participants.`);
      break;
    }
    case "balanced":
    default:
      lines.push(`Selected ${tier.label} tier for optimal balance between efficiency and privacy coverage.`);
      break;
  }

  lines.push(``);
  lines.push(`EXECUTION PLAN`);

  const hasDCADelays = steps.some((s) => s.delaySeconds > 0);
  if (hasDCADelays) {
    const minDelay = Math.min(...steps.filter(s => s.delaySeconds > 0).map(s => s.delaySeconds));
    const maxDelay = Math.max(...steps.map(s => s.delaySeconds));
    lines.push(`${numDeposits} autonomous deposits via relayer with randomized delays (${minDelay}-${maxDelay}s). You sign once — the relayer handles execution. Each deposit lands in a separate block, preventing temporal correlation analysis.`);
  } else {
    lines.push(`${numDeposits} deposit(s) batched in a single atomic multicall for maximum efficiency.`);
  }

  lines.push(``);
  lines.push(`Each deposit enters the shielded pool as an indistinguishable commitment. After batch conversion via AVNU, the resulting BTC can be withdrawn through a confidential exit with no on-chain link to the deposit address.`);
  lines.push(``);
  lines.push(`PRIVACY IMPACT`);
  lines.push(`Confidentiality Strength Index will increase to ${projectedCSI} after execution.`);

  return lines.join("\n");
}
