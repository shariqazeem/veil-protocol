/**
 * Privacy Scoring Engine — real anonymity analysis from on-chain data.
 *
 * Calculates per-deposit privacy scores, pool-wide health metrics,
 * withdrawal timing recommendations, and privacy threat detection.
 * Based on actual anonymity theory (k-anonymity, timing correlation,
 * linkability analysis).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolPrivacyState {
  /** Per-tier anonymity set sizes [tier0, tier1, tier2, tier3] */
  anonSets: number[];
  /** Total deposits across all tiers */
  totalDeposits: number;
  /** Total unique tiers with deposits */
  activeTiers: number;
  /** Current leaf count (Merkle tree size) */
  leafCount: number;
  /** Total batches executed */
  batchesExecuted: number;
  /** Pending USDC awaiting batch */
  pendingUsdc: number;
  /** Total protocol volume (USDC) */
  totalVolume: number;
}

export interface DepositInfo {
  /** Deposit tier (0-3) */
  tier: number;
  /** Timestamp when deposited (ms) */
  depositTimestamp: number;
  /** Leaf index in Merkle tree */
  leafIndex: number;
  /** Has this deposit been claimed? */
  claimed?: boolean;
}

export interface PrivacyScore {
  /** Overall privacy score 0-100 */
  overall: number;
  /** Rating label */
  rating: "Critical" | "Weak" | "Moderate" | "Strong" | "Excellent";
  /** Anonymity set score (0-100) */
  anonymityScore: number;
  /** Time elapsed score (0-100) — longer since deposit = better */
  timeScore: number;
  /** Deposits-since score (0-100) — more deposits after yours = better */
  depositsSinceScore: number;
  /** Timing correlation risk (0-100, lower = safer) */
  timingRisk: number;
  /** Anonymity set size for this tier */
  anonymitySetSize: number;
  /** How many deposits happened after this one */
  depositsSince: number;
  /** Hours since deposit */
  hoursSinceDeposit: number;
  /** Human-readable recommendation */
  recommendation: string;
  /** Withdrawal readiness */
  withdrawalReady: boolean;
  /** Privacy factors breakdown */
  factors: PrivacyFactor[];
}

export interface PrivacyFactor {
  name: string;
  score: number;
  maxScore: number;
  status: "safe" | "moderate" | "warning" | "critical";
  detail: string;
}

export interface PoolHealthScore {
  /** Overall pool health 0-100 */
  overall: number;
  rating: "Critical" | "Weak" | "Moderate" | "Strong" | "Excellent";
  /** Composite Security Index */
  csi: number;
  /** Per-tier analysis */
  tiers: TierAnalysis[];
  /** Pool-wide metrics */
  metrics: PoolMetric[];
  /** Improvement suggestions */
  suggestions: string[];
}

export interface TierAnalysis {
  tier: number;
  label: string;
  participants: number;
  unlinkability: "None" | "Low" | "Moderate" | "Good" | "Strong" | "Excellent";
  unlinkabilityScore: number;
  /** Probability of correctly guessing a withdrawal's depositor */
  guessProb: string;
  contribution: string;
}

export interface PoolMetric {
  label: string;
  value: string;
  status: "good" | "moderate" | "warning";
}

export interface WithdrawalRecommendation {
  /** Should the user withdraw now? */
  shouldWithdraw: boolean;
  /** Urgency: low, medium, high */
  urgency: "low" | "medium" | "high";
  /** Current privacy score if withdrawn now */
  currentScore: number;
  /** Estimated score if user waits */
  projectedScore: number;
  /** How long to wait for optimal privacy */
  waitRecommendation: string;
  /** Risk factors */
  risks: string[];
  /** Positive factors */
  strengths: string[];
}

export interface PrivacyThreat {
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  mitigation: string;
}

// ---------------------------------------------------------------------------
// Tier labels
// ---------------------------------------------------------------------------

const TIER_LABELS = ["$1", "$10", "$100", "$1,000"];
const TIER_AMOUNTS = [1, 10, 100, 1000];

// ---------------------------------------------------------------------------
// Core Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Calculate per-deposit privacy score.
 */
export function calculateDepositPrivacy(
  deposit: DepositInfo,
  pool: PoolPrivacyState,
): PrivacyScore {
  const now = Date.now();
  const hoursSince = (now - deposit.depositTimestamp) / (1000 * 60 * 60);
  const anonSetSize = pool.anonSets[deposit.tier] ?? 0;
  const depositsSince = Math.max(0, pool.leafCount - deposit.leafIndex - 1);

  // 1. Anonymity Set Score (0-100)
  // Based on k-anonymity: the larger the set, the harder to identify
  const anonymityScore = calculateAnonymityScore(anonSetSize);

  // 2. Time Elapsed Score (0-100)
  // Longer time = more temporal decorrelation
  const timeScore = calculateTimeScore(hoursSince);

  // 3. Deposits-Since Score (0-100)
  // More deposits after yours = harder to identify via ordering
  const depositsSinceScore = calculateDepositsSinceScore(depositsSince);

  // 4. Timing Correlation Risk (0-100, LOWER = SAFER)
  // If you withdraw too soon, timing analysis can link deposit↔withdrawal
  const timingRisk = calculateTimingRisk(hoursSince, anonSetSize);

  // Weighted overall score
  const overall = Math.round(
    anonymityScore * 0.40 +
    timeScore * 0.20 +
    depositsSinceScore * 0.20 +
    (100 - timingRisk) * 0.20
  );

  const rating = getScoreRating(overall);
  const withdrawalReady = overall >= 50 && timingRisk < 60;

  // Build factors breakdown
  const factors: PrivacyFactor[] = [
    {
      name: "Anonymity Set",
      score: anonymityScore,
      maxScore: 100,
      status: anonymityScore >= 70 ? "safe" : anonymityScore >= 40 ? "moderate" : anonymityScore >= 20 ? "warning" : "critical",
      detail: `${anonSetSize} participant${anonSetSize !== 1 ? "s" : ""} in ${TIER_LABELS[deposit.tier]} tier — ${anonSetSize >= 10 ? "strong cover" : anonSetSize >= 5 ? "growing set" : anonSetSize >= 3 ? "moderate crowd" : anonSetSize >= 2 ? "minimal cover" : "no privacy, you are the only depositor"}`,
    },
    {
      name: "Time Elapsed",
      score: timeScore,
      maxScore: 100,
      status: timeScore >= 70 ? "safe" : timeScore >= 40 ? "moderate" : timeScore >= 20 ? "warning" : "critical",
      detail: `${hoursSince < 1 ? `${Math.round(hoursSince * 60)} minutes` : hoursSince < 24 ? `${hoursSince.toFixed(1)} hours` : `${(hoursSince / 24).toFixed(1)} days`} since deposit — ${hoursSince >= 24 ? "excellent decorrelation" : hoursSince >= 6 ? "good temporal separation" : hoursSince >= 1 ? "moderate, consider waiting" : "very recent, high correlation risk"}`,
    },
    {
      name: "Cover Traffic",
      score: depositsSinceScore,
      maxScore: 100,
      status: depositsSinceScore >= 70 ? "safe" : depositsSinceScore >= 40 ? "moderate" : depositsSinceScore >= 20 ? "warning" : "critical",
      detail: `${depositsSince} deposit${depositsSince !== 1 ? "s" : ""} entered the pool after yours — ${depositsSince >= 10 ? "strong noise floor" : depositsSince >= 5 ? "moderate cover" : depositsSince >= 2 ? "some cover" : "minimal traffic, you may be identifiable by ordering"}`,
    },
    {
      name: "Timing Safety",
      score: 100 - timingRisk,
      maxScore: 100,
      status: timingRisk < 20 ? "safe" : timingRisk < 40 ? "moderate" : timingRisk < 60 ? "warning" : "critical",
      detail: timingRisk < 20 ? "Timing analysis is unlikely to correlate your deposit and withdrawal" :
              timingRisk < 40 ? "Low risk of timing-based linkability" :
              timingRisk < 60 ? "Moderate timing risk — consider waiting longer" :
              "High timing correlation risk — withdrawal timing closely matches deposit",
    },
  ];

  const recommendation = generateRecommendation(overall, timingRisk, anonSetSize, hoursSince, depositsSince);

  return {
    overall,
    rating,
    anonymityScore,
    timeScore,
    depositsSinceScore,
    timingRisk,
    anonymitySetSize: anonSetSize,
    depositsSince,
    hoursSinceDeposit: hoursSince,
    recommendation,
    withdrawalReady,
    factors,
  };
}

/**
 * Calculate pool-wide health score.
 */
export function calculatePoolHealth(pool: PoolPrivacyState): PoolHealthScore {
  const tiers: TierAnalysis[] = pool.anonSets.map((count, i) => {
    const unlinkabilityScore = calculateAnonymityScore(count);
    const guessProb = count > 0 ? `1/${count} (${(100 / count).toFixed(1)}%)` : "N/A";
    return {
      tier: i,
      label: TIER_LABELS[i],
      participants: count,
      unlinkability: getUnlinkabilityLabel(count),
      unlinkabilityScore,
      guessProb,
      contribution: count > 0
        ? count >= 10 ? "Strong privacy guarantee" : count >= 5 ? "Growing anonymity" : count >= 3 ? "Emerging privacy" : "Needs more participants"
        : "Empty — no privacy available",
    };
  });

  const activeTiers = pool.anonSets.filter(c => c > 0).length;
  const maxAnon = Math.max(...pool.anonSets, 0);
  const minActiveAnon = Math.min(...pool.anonSets.filter(c => c > 0), Infinity);
  const totalParticipants = pool.anonSets.reduce((s, v) => s + v, 0);
  const csi = maxAnon * activeTiers;

  // Pool health scoring
  let healthScore = 0;
  healthScore += Math.min(totalParticipants * 2, 35);    // participation (max 35)
  healthScore += activeTiers * 8;                         // tier diversity (max 32)
  healthScore += Math.min((minActiveAnon === Infinity ? 0 : minActiveAnon) * 5, 20); // weakest tier (max 20)
  healthScore += Math.min(pool.batchesExecuted * 3, 13);  // operational maturity (max 13)
  healthScore = Math.min(healthScore, 100);

  const rating = getScoreRating(healthScore);

  const metrics: PoolMetric[] = [
    {
      label: "Total Participants",
      value: totalParticipants.toString(),
      status: totalParticipants >= 20 ? "good" : totalParticipants >= 5 ? "moderate" : "warning",
    },
    {
      label: "Active Tiers",
      value: `${activeTiers}/4`,
      status: activeTiers >= 3 ? "good" : activeTiers >= 2 ? "moderate" : "warning",
    },
    {
      label: "Strongest Anonymity",
      value: `${maxAnon} (${TIER_LABELS[pool.anonSets.indexOf(maxAnon)]})`,
      status: maxAnon >= 10 ? "good" : maxAnon >= 5 ? "moderate" : "warning",
    },
    {
      label: "CSI Score",
      value: csi.toString(),
      status: csi >= 30 ? "good" : csi >= 10 ? "moderate" : "warning",
    },
    {
      label: "Protocol Volume",
      value: pool.totalVolume >= 1000 ? `$${(pool.totalVolume / 1000).toFixed(1)}k` : `$${pool.totalVolume.toFixed(0)}`,
      status: pool.totalVolume >= 1000 ? "good" : pool.totalVolume >= 100 ? "moderate" : "warning",
    },
  ];

  const suggestions: string[] = [];
  if (totalParticipants < 10) {
    suggestions.push("Pool needs more participants — each new deposit strengthens privacy for everyone.");
  }
  if (activeTiers < 3) {
    suggestions.push(`Only ${activeTiers} tier${activeTiers !== 1 ? "s" : ""} active. Deposits across all tiers create stronger cross-tier privacy coverage.`);
  }
  const emptyTiers = pool.anonSets.map((c, i) => c === 0 ? TIER_LABELS[i] : null).filter(Boolean);
  if (emptyTiers.length > 0) {
    suggestions.push(`${emptyTiers.join(", ")} tier${emptyTiers.length > 1 ? "s are" : " is"} empty — first depositors have maximum marginal privacy impact.`);
  }
  if (minActiveAnon !== Infinity && minActiveAnon < 3) {
    suggestions.push("Weakest tier has fewer than 3 participants — depositing there maximizes protocol-wide privacy.");
  }
  if (pool.pendingUsdc > 50) {
    suggestions.push(`$${pool.pendingUsdc.toFixed(0)} USDC pending batch conversion — depositing now joins this batch cycle.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("Pool health is strong — privacy guarantees are reliable across active tiers.");
  }

  return { overall: healthScore, rating, csi, tiers, metrics, suggestions };
}

/**
 * Generate withdrawal timing recommendation.
 */
export function getWithdrawalRecommendation(
  deposit: DepositInfo,
  pool: PoolPrivacyState,
): WithdrawalRecommendation {
  const score = calculateDepositPrivacy(deposit, pool);
  const { overall, timingRisk, anonymitySetSize, hoursSinceDeposit, depositsSince } = score;

  const risks: string[] = [];
  const strengths: string[] = [];

  // Analyze strengths
  if (anonymitySetSize >= 10) strengths.push(`Strong anonymity set (${anonymitySetSize} participants)`);
  else if (anonymitySetSize >= 5) strengths.push(`Growing anonymity set (${anonymitySetSize} participants)`);
  if (hoursSinceDeposit >= 24) strengths.push("Excellent temporal decorrelation (24h+)");
  else if (hoursSinceDeposit >= 6) strengths.push("Good time separation from deposit");
  if (depositsSince >= 10) strengths.push(`${depositsSince} deposits since yours — strong cover traffic`);

  // Analyze risks
  if (anonymitySetSize < 3) risks.push(`Low anonymity set (${anonymitySetSize}) — observer has ${anonymitySetSize > 0 ? `1/${anonymitySetSize}` : "100%"} chance of identifying you`);
  if (hoursSinceDeposit < 1) risks.push("Deposited less than 1 hour ago — high timing correlation");
  if (depositsSince < 3) risks.push(`Only ${depositsSince} deposits since yours — limited cover traffic`);
  if (timingRisk >= 60) risks.push("Timing analysis could link your deposit and withdrawal");

  // Determine wait recommendation
  let waitRecommendation: string;
  let shouldWithdraw: boolean;
  let urgency: "low" | "medium" | "high";

  if (overall >= 75 && timingRisk < 30) {
    shouldWithdraw = true;
    urgency = "low";
    waitRecommendation = "Privacy is strong. You can withdraw safely to a fresh wallet.";
  } else if (overall >= 50 && timingRisk < 50) {
    shouldWithdraw = true;
    urgency = "medium";
    const hoursToWait = Math.max(0, 6 - hoursSinceDeposit);
    waitRecommendation = hoursToWait > 0
      ? `Acceptable privacy. Waiting ${hoursToWait.toFixed(0)}h more would improve your score.`
      : "Moderate privacy. Proceed if needed, but more time improves unlinkability.";
  } else {
    shouldWithdraw = false;
    urgency = "high";
    if (anonymitySetSize < 3) {
      waitRecommendation = `Wait for ${3 - anonymitySetSize} more deposits in the ${TIER_LABELS[deposit.tier]} tier before withdrawing.`;
    } else if (hoursSinceDeposit < 2) {
      waitRecommendation = `Wait at least ${(2 - hoursSinceDeposit).toFixed(1)} more hours for temporal decorrelation.`;
    } else {
      waitRecommendation = "Privacy conditions are suboptimal. Wait for more pool activity.";
    }
  }

  // Project future score (rough estimate assuming 2 deposits per hour)
  const futureDeposits = depositsSince + 4; // ~2 hours more
  const futureHours = hoursSinceDeposit + 2;
  const futureAnonScore = calculateAnonymityScore(anonymitySetSize);
  const futureTimeScore = calculateTimeScore(futureHours);
  const futureDepositScore = calculateDepositsSinceScore(futureDeposits);
  const futureTimingRisk = calculateTimingRisk(futureHours, anonymitySetSize);
  const projectedScore = Math.round(
    futureAnonScore * 0.40 + futureTimeScore * 0.20 + futureDepositScore * 0.20 + (100 - futureTimingRisk) * 0.20
  );

  return {
    shouldWithdraw,
    urgency,
    currentScore: overall,
    projectedScore: Math.min(projectedScore, 100),
    waitRecommendation,
    risks,
    strengths,
  };
}

/**
 * Detect active privacy threats for a user's deposits.
 */
export function detectPrivacyThreats(
  deposits: DepositInfo[],
  pool: PoolPrivacyState,
): PrivacyThreat[] {
  const threats: PrivacyThreat[] = [];

  // Check for single-depositor tiers
  for (let tier = 0; tier < 4; tier++) {
    const anonSet = pool.anonSets[tier] ?? 0;
    const userDepositsInTier = deposits.filter(d => d.tier === tier).length;
    if (anonSet === 1 && userDepositsInTier === 1) {
      threats.push({
        severity: "critical",
        title: `Zero Privacy in ${TIER_LABELS[tier]} Tier`,
        description: `You are the only depositor in the ${TIER_LABELS[tier]} tier. Any withdrawal from this tier is trivially linked to you.`,
        mitigation: `Wait for other users to deposit in the ${TIER_LABELS[tier]} tier, or consider depositing from additional addresses to increase the anonymity set.`,
      });
    } else if (anonSet > 0 && anonSet < 3) {
      threats.push({
        severity: "warning",
        title: `Weak Anonymity in ${TIER_LABELS[tier]} Tier`,
        description: `Only ${anonSet} depositors in the ${TIER_LABELS[tier]} tier. An observer has a 1/${anonSet} (${(100 / anonSet).toFixed(0)}%) chance of guessing correctly.`,
        mitigation: "More participants needed. Privacy improves exponentially with each new depositor.",
      });
    }
  }

  // Check for timing correlation across deposits
  const recentDeposits = deposits.filter(d => {
    const hours = (Date.now() - d.depositTimestamp) / (1000 * 60 * 60);
    return hours < 1 && !d.claimed;
  });
  if (recentDeposits.length > 0) {
    threats.push({
      severity: "warning",
      title: "Recent Deposit — Timing Risk",
      description: `${recentDeposits.length} deposit${recentDeposits.length > 1 ? "s" : ""} made less than 1 hour ago. Withdrawing now creates a strong timing correlation.`,
      mitigation: "Wait at least 2-6 hours before claiming for adequate temporal decorrelation.",
    });
  }

  // Check for multi-deposit same tier (reduces effective anonymity)
  for (let tier = 0; tier < 4; tier++) {
    const userCount = deposits.filter(d => d.tier === tier && !d.claimed).length;
    if (userCount >= 2) {
      const anonSet = pool.anonSets[tier] ?? 0;
      threats.push({
        severity: "info",
        title: `Multiple Deposits in ${TIER_LABELS[tier]}`,
        description: `You have ${userCount} unclaimed deposits in the ${TIER_LABELS[tier]} tier (anonymity set: ${anonSet}). Multiple deposits from one source can reduce effective privacy if withdrawn in a pattern.`,
        mitigation: "Withdraw at different times with delays between each. Use fresh recipient addresses for each withdrawal.",
      });
    }
  }

  // Pool-wide threat: very low total participation
  if (pool.totalDeposits < 5) {
    threats.push({
      severity: "warning",
      title: "Low Pool Participation",
      description: `The pool has only ${pool.totalDeposits} total deposits. Small pools offer weaker privacy guarantees.`,
      mitigation: "Privacy improves as more users deposit. Consider spreading deposits across tiers to increase coverage.",
    });
  }

  return threats.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ---------------------------------------------------------------------------
// Internal Scoring Functions
// ---------------------------------------------------------------------------

function calculateAnonymityScore(anonSetSize: number): number {
  if (anonSetSize <= 0) return 0;
  if (anonSetSize === 1) return 5;   // technically exists but no privacy
  if (anonSetSize === 2) return 20;
  if (anonSetSize === 3) return 35;
  if (anonSetSize <= 5) return 50;
  if (anonSetSize <= 10) return 70;
  if (anonSetSize <= 20) return 85;
  if (anonSetSize <= 50) return 93;
  return 98;
}

function calculateTimeScore(hours: number): number {
  if (hours < 0.1) return 0;         // just deposited
  if (hours < 0.5) return 10;
  if (hours < 1) return 20;
  if (hours < 2) return 35;
  if (hours < 6) return 50;
  if (hours < 12) return 65;
  if (hours < 24) return 78;
  if (hours < 72) return 88;
  if (hours < 168) return 95;        // 1 week
  return 99;
}

function calculateDepositsSinceScore(depositsSince: number): number {
  if (depositsSince <= 0) return 5;
  if (depositsSince === 1) return 15;
  if (depositsSince <= 3) return 30;
  if (depositsSince <= 5) return 50;
  if (depositsSince <= 10) return 70;
  if (depositsSince <= 20) return 85;
  if (depositsSince <= 50) return 93;
  return 98;
}

function calculateTimingRisk(hours: number, anonSetSize: number): number {
  // Base timing risk from time elapsed
  let baseRisk: number;
  if (hours < 0.1) baseRisk = 95;
  else if (hours < 0.5) baseRisk = 80;
  else if (hours < 1) baseRisk = 65;
  else if (hours < 2) baseRisk = 50;
  else if (hours < 6) baseRisk = 30;
  else if (hours < 12) baseRisk = 18;
  else if (hours < 24) baseRisk = 10;
  else baseRisk = 5;

  // Anonymity set mitigates timing risk (larger set = less useful timing info)
  const mitigation = Math.min(anonSetSize * 3, 30);
  return Math.max(0, baseRisk - mitigation);
}

function getScoreRating(score: number): "Critical" | "Weak" | "Moderate" | "Strong" | "Excellent" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Weak";
  return "Critical";
}

function getUnlinkabilityLabel(count: number): "None" | "Low" | "Moderate" | "Good" | "Strong" | "Excellent" {
  if (count <= 0) return "None";
  if (count === 1) return "None";
  if (count <= 3) return "Low";
  if (count <= 5) return "Moderate";
  if (count <= 10) return "Good";
  if (count <= 20) return "Strong";
  return "Excellent";
}

function generateRecommendation(
  overall: number,
  timingRisk: number,
  anonSetSize: number,
  hours: number,
  depositsSince: number,
): string {
  if (overall >= 80) {
    return "Privacy is excellent. Withdraw to a fresh wallet address for maximum unlinkability.";
  }
  if (overall >= 60) {
    if (timingRisk >= 40) {
      return `Privacy is strong but timing risk is elevated. Wait ${Math.max(1, Math.ceil(6 - hours))} more hours for optimal decorrelation.`;
    }
    return "Privacy is good. Safe to withdraw to a fresh address.";
  }
  if (overall >= 40) {
    const issues: string[] = [];
    if (anonSetSize < 5) issues.push(`anonymity set is small (${anonSetSize})`);
    if (hours < 2) issues.push("deposit is recent");
    if (depositsSince < 3) issues.push("limited cover traffic");
    return `Moderate privacy — ${issues.join(", ")}. Consider waiting for pool activity to increase.`;
  }
  if (anonSetSize <= 1) {
    return "Critical: you are the only depositor in this tier. Withdrawal will be trivially linked. Wait for other deposits.";
  }
  return "Privacy is weak. Strongly recommend waiting for more pool activity before withdrawing.";
}
