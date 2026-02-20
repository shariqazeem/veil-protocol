/**
 * Veil Strategist — Deterministic AI Strategy Engine (Standalone)
 *
 * Generates structured accumulation plans from natural language input.
 * No external API dependency — all logic is deterministic with
 * template-based narrative generation for typewriter display.
 *
 * This is a standalone copy of frontend/src/utils/strategyEngine.ts
 * with inlined constants to avoid cross-package dependencies
 * (scripts/ uses starknet v7, frontend uses v8).
 */

// Inlined from frontend/src/utils/privacy.ts
const DENOMINATIONS: Record<number, number> = {
  0: 1_000_000,    // $1 USDC
  1: 10_000_000,   // $10 USDC
  2: 100_000_000,  // $100 USDC
  3: 1_000_000_000, // $1,000 USDC
};

const DENOMINATION_LABELS: Record<number, string> = {
  0: "$1",
  1: "$10",
  2: "$100",
  3: "$1,000",
};

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
  anonSets: Record<number, number>; // tier → count
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

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  thousand: 1000, "a thousand": 1000, "a hundred": 100,
};

/** Extract a target USD amount from natural language. */
export function parseTargetUsdc(input: string, btcPrice?: number): number | null {
  const lower = input.toLowerCase().trim();

  // BTC-denominated
  if (btcPrice && btcPrice > 0) {
    const btcMatch = lower.match(/([\d.]+)\s*(?:btc|bitcoin)/i);
    if (btcMatch) {
      return Math.round(parseFloat(btcMatch[1]) * btcPrice);
    }
    if (/half\s+a?\s*bitcoin/i.test(lower)) {
      return Math.round(0.5 * btcPrice);
    }
  }

  // Shorthand
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

  // Word numbers
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    if (lower.includes(word)) {
      return num;
    }
  }

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

  if (/\bmax\w*\s+privac/i.test(lower)) scores.privacy_first += 4;
  else if (/privac/i.test(lower)) scores.privacy_first += 3;
  if (/anonym/i.test(lower)) scores.privacy_first += 3;
  if (/stealth/i.test(lower)) scores.privacy_first += 2;
  if (/hidden|invisible|untrace/i.test(lower)) scores.privacy_first += 2;
  if (/strongest\s+(?:pool|set|tier)/i.test(lower)) scores.privacy_first += 3;

  if (/efficien/i.test(lower)) scores.efficiency += 3;
  if (/\bfast\b/i.test(lower)) scores.efficiency += 2;
  if (/\bquick\b/i.test(lower)) scores.efficiency += 2;
  if (/\bcheap\b/i.test(lower)) scores.efficiency += 2;
  if (/\bgas\b/i.test(lower)) scores.efficiency += 1;
  if (/single\s+(?:tx|transaction)/i.test(lower)) scores.efficiency += 2;

  if (/\bdca\b/i.test(lower)) scores.stealth_dca += 4;
  if (/spread/i.test(lower)) scores.stealth_dca += 2;
  if (/over\s+(?:time|\d+)/i.test(lower)) scores.stealth_dca += 3;
  if (/split/i.test(lower)) scores.stealth_dca += 2;
  if (/multiple/i.test(lower)) scores.stealth_dca += 2;
  if (/diversif/i.test(lower)) scores.stealth_dca += 2;
  if (/gradual/i.test(lower)) scores.stealth_dca += 2;

  if (targetUsdc >= 500) scores.whale += 2;
  if (targetUsdc >= 1000) scores.whale += 2;
  if (/whale|big|large|massive/i.test(lower)) scores.whale += 3;

  if (/balanced?|optimal|recommend/i.test(lower)) scores.balanced += 3;

  const entries = Object.entries(scores) as [StrategyType, number][];
  const max = entries.reduce((best, curr) => curr[1] > best[1] ? curr : best, entries[4]);

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
  const minAnon = Math.min(...tiers.map(t => t.count));

  const weakest = [...tiers].sort((a, b) => a.count - b.count)[0];
  const strongest = [...tiers].sort((a, b) => b.count - a.count)[0];

  let score = 0;
  score += Math.min(totalAnon * 2, 40);
  score += activeTiers * 10;
  score += Math.min(minAnon * 5, 30);

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

  return { rating, score, weakestTier: weakest, strongestTier: strongest, recommendation };
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

function selectOptimalTier(
  targetUsdc: number,
  poolState: PoolState,
  strategyType: StrategyType,
): TierOption {
  const tiers = getTierOptions(poolState);
  const affordable = tiers.filter((t) => t.usdcPerDeposit <= targetUsdc);
  if (affordable.length === 0) return tiers[0];

  if (strategyType === "privacy_first") {
    const bestAnon = affordable.reduce((best, t) => t.anonSet > best.anonSet ? t : best);
    // When all pools are small, prefer largest affordable tier for better UX
    return bestAnon.anonSet < 5 ? affordable[affordable.length - 1] : bestAnon;
  }
  return affordable[affordable.length - 1];
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
// Strategy Labels
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
// Narrative Variation
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
  ],
  btcPrice: [
    (price: string) => `Live BTC: $${price}`,
    (price: string) => `BTC spot price: $${price}`,
  ],
};

// ---------------------------------------------------------------------------
// Agent Thinking Loop
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

  // Phase 1: Observation
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.intent)(userInput) });
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.target)(targetUsdc) });
  logs.push({ timestamp: tick(), type: "observe", message: pickRandom(OBSERVE_TEMPLATES.btcPrice)(btcPrice.toLocaleString()) });
  logs.push({ timestamp: tick(), type: "observe", message: `Detected strategy: ${STRATEGY_LABELS[strategyType]}` });

  // Phase 2: Analysis
  logs.push({ timestamp: tick(), type: "think", message: `Evaluating anonymity tiers...` });

  const bestTier = tiers.reduce((best, t) => t.anonSet > best.anonSet ? t : best, tiers[0]);
  const strength = bestTier.anonSet >= 10 ? "STRONG" : bestTier.anonSet >= 5 ? "GOOD" : bestTier.anonSet >= 3 ? "MODERATE" : "LOW";
  logs.push({ timestamp: tick(), type: "think", message: `Best pool: ${bestTier.label} (${bestTier.anonSet} participants → ${strength})` });

  const csi = computeCSI(poolState.anonSets);
  logs.push({ timestamp: tick(), type: "think", message: `CSI: ${csi} | Pool health: ${health.rating}` });

  if (health.weakestTier && health.weakestTier.count < 5) {
    logs.push({ timestamp: tick(), type: "think", message: `${health.recommendation}` });
  }

  if (strategyType === "privacy_first") {
    logs.push({ timestamp: tick(), type: "think", message: `Privacy-maximizing mode active` });
  }
  if (isDCA) {
    logs.push({ timestamp: tick(), type: "think", message: `DCA pattern: temporal decorrelation enabled` });
  }

  // Phase 3: Decision
  const tier = selectOptimalTier(targetUsdc, poolState, strategyType);
  let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
  if (numDeposits < 1) numDeposits = 1;
  if (requestedCount && requestedCount > 0) numDeposits = Math.min(requestedCount, 10);
  numDeposits = Math.min(numDeposits, 10); // hard cap

  const totalUsdc = numDeposits * tier.usdcPerDeposit;
  const estBtc = (totalUsdc / btcPrice) * 0.99;

  logs.push({ timestamp: tick(), type: "decide", message: `Strategy: ${STRATEGY_LABELS[strategyType]}` });
  logs.push({ timestamp: tick(), type: "decide", message: `Plan: ${numDeposits}x ${tier.label} = $${totalUsdc} → ${estBtc.toFixed(estBtc < 0.01 ? 6 : 4)} BTC` });

  const projectedAnonSets = { ...poolState.anonSets };
  projectedAnonSets[tier.tier] = (projectedAnonSets[tier.tier] ?? 0) + numDeposits;
  const projectedCSI = computeCSI(projectedAnonSets);
  logs.push({ timestamp: tick(), type: "decide", message: `CSI impact: ${csi} → ${projectedCSI} (+${projectedCSI - csi})` });

  logs.push({ timestamp: tick(), type: "result", message: pickRandom([
    `Strategy ready. Tap Execute to deploy on Starknet.`,
    `Plan optimized. Ready for deployment.`,
    `Analysis complete. Execute to proceed.`,
  ]) });

  return logs;
}

// ---------------------------------------------------------------------------
// Strategy Generation
// ---------------------------------------------------------------------------

export function generateStrategy(
  targetUsdc: number,
  poolState: PoolState,
  btcPrice: number,
  userInput: string = "",
): AgentPlan {
  const strategyType = detectStrategyType(userInput, targetUsdc);
  const { isDCA, depositCount: requestedCount } = wantsDCA(userInput);

  const tier = selectOptimalTier(targetUsdc, poolState, strategyType);

  let numDeposits = Math.floor(targetUsdc / tier.usdcPerDeposit);
  if (numDeposits < 1) numDeposits = 1;
  if (requestedCount && requestedCount > 0) numDeposits = Math.min(requestedCount, 10);
  numDeposits = Math.min(numDeposits, 10); // hard cap

  const totalUsdc = numDeposits * tier.usdcPerDeposit;
  const estimatedBtc = totalUsdc / btcPrice;
  const slippageAdjustedBtc = estimatedBtc * 0.99;

  const steps: AgentStep[] = [];
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

  const currentCSI = computeCSI(poolState.anonSets);
  const projectedAnonSets = { ...poolState.anonSets };
  projectedAnonSets[tier.tier] = (projectedAnonSets[tier.tier] ?? 0) + numDeposits;
  const projectedCSI = computeCSI(projectedAnonSets);

  const projectedAnonSet = projectedAnonSets[tier.tier];
  const privacyLabelStr =
    projectedAnonSet >= 20 ? "Maximum" :
    projectedAnonSet >= 10 ? "Strong" :
    projectedAnonSet >= 5 ? "Good" :
    projectedAnonSet >= 3 ? "Moderate" : "Low";

  const health = computePoolHealth(poolState);

  const analysis = [
    `MARKET: BTC $${btcPrice.toLocaleString()} | $${totalUsdc} → ~${(totalUsdc / btcPrice).toFixed(6)} BTC`,
    `POOL: ${health.rating} (${health.score}/100) | ${health.recommendation}`,
    `STRATEGY: ${STRATEGY_LABELS[strategyType]} — ${STRATEGY_DESCRIPTIONS[strategyType]}`,
  ].join("\n");

  const reasoning = [
    `${numDeposits}x ${tier.label} deposits via Starknet.`,
    `Each commitment is indistinguishable. Batch conversion via AVNU.`,
    `CSI: ${currentCSI} → ${projectedCSI}`,
  ].join("\n");

  return {
    analysis,
    strategy: {
      totalUsdc,
      steps,
      estimatedBtc: slippageAdjustedBtc.toFixed(slippageAdjustedBtc < 0.01 ? 6 : 4),
      privacyScore: `${privacyLabelStr} (${projectedAnonSet} participants in ${tier.label} pool)`,
      csiImpact: `${currentCSI} → ${projectedCSI}`,
    },
    reasoning,
  };
}
