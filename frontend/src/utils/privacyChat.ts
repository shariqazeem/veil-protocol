/**
 * AI Privacy Chat Engine — intelligent privacy advisor.
 *
 * Detects user intent, analyzes on-chain data, and generates
 * contextual privacy advice. Feels like talking to a privacy expert
 * but runs locally with zero external API calls — your queries
 * never leave the app.
 */

import {
  calculateDepositPrivacy,
  calculatePoolHealth,
  getWithdrawalRecommendation,
  detectPrivacyThreats,
  type PoolPrivacyState,
  type DepositInfo,
  type PrivacyScore,
  type PoolHealthScore,
  type WithdrawalRecommendation,
  type PrivacyThreat,
} from "./privacyScore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatIntent =
  | "privacy_check"
  | "withdrawal_timing"
  | "pool_analysis"
  | "threat_detection"
  | "strategy"
  | "education"
  | "greeting"
  | "unknown";

export interface ChatContext {
  pool: PoolPrivacyState;
  deposits: DepositInfo[];
  btcPrice?: number;
}

export interface ChatResponse {
  intent: ChatIntent;
  /** Main response text (markdown-formatted) */
  message: string;
  /** Structured data cards to render */
  cards: ChatCard[];
  /** Whether this response requires x402 payment */
  premium: boolean;
  /** Suggested follow-up prompts */
  suggestions: string[];
}

export type ChatCard =
  | { type: "privacy_score"; data: PrivacyScore; tier: number }
  | { type: "pool_health"; data: PoolHealthScore }
  | { type: "withdrawal_rec"; data: WithdrawalRecommendation; tier: number }
  | { type: "threats"; data: PrivacyThreat[] }
  | { type: "metric"; label: string; value: string; status: "good" | "moderate" | "warning" };

// ---------------------------------------------------------------------------
// Intent Detection
// ---------------------------------------------------------------------------

const INTENT_PATTERNS: Array<{ intent: ChatIntent; patterns: RegExp[] }> = [
  {
    intent: "privacy_check",
    patterns: [
      /how\s*(private|safe|secure|anonymous)/i,
      /privacy\s*(score|level|rating|check|status)/i,
      /check\s*(my\s*)?(privacy|anonymity|safety)/i,
      /am\s+i\s+(private|safe|anonymous|hidden)/i,
      /can\s+(anyone|they|someone)\s+(see|trace|track|link|find)/i,
      /unlinkab/i,
      /anonym/i,
    ],
  },
  {
    intent: "withdrawal_timing",
    patterns: [
      /when\s+(should|can|to)\s+(i\s+)?(withdraw|claim|exit)/i,
      /(best|optimal|right|good)\s+time\s+(to\s+)?(withdraw|claim|exit)/i,
      /should\s+i\s+(withdraw|claim|exit)\s*(now)?/i,
      /ready\s+to\s+(withdraw|claim)/i,
      /timing/i,
      /wait/i,
    ],
  },
  {
    intent: "threat_detection",
    patterns: [
      /(threat|risk|danger|vuln|attack|leak)/i,
      /analyze\s*(my\s*)?(risk|threat|danger|exposure)/i,
      /what.*risk/i,
      /am\s+i\s+(at\s+)?risk/i,
      /exposure/i,
      /what\s+could\s+go\s+wrong/i,
    ],
  },
  {
    intent: "pool_analysis",
    patterns: [
      /pool\s*(health|status|state|stats|size|info)/i,
      /how\s*(is|are)\s*(the\s+)?pool/i,
      /(analyze|analyse|check)\s*(the\s+)?pool/i,
      /anonymity\s+set/i,
      /how\s+many\s+(deposit|participant|user)/i,
      /tier\s*(analysis|breakdown|info)/i,
      /csi\s*(score)?/i,
    ],
  },
  {
    intent: "strategy",
    patterns: [
      /\$\d+/,
      /deposit\s+\d+/i,
      /(\d+)\s*(dollar|usd|usdc)/i,
      /strategy/i,
      /maximize\s*privacy/i,
      /best\s+way\s+to\s+deposit/i,
      /how\s+to\s+(shield|deposit|enter)/i,
      /dca/i,
      /spread/i,
    ],
  },
  {
    intent: "education",
    patterns: [
      /what\s+is\s+(a\s+)?(zk|zero.know|merkle|nullifier|commitment|anonymity|privacy\s+pool|shielded)/i,
      /how\s+does\s+(the\s+)?(pool|protocol|privacy|zk|proof|shielding|unveiling)/i,
      /explain/i,
      /tell\s+me\s+about/i,
      /what\s+are/i,
    ],
  },
  {
    intent: "greeting",
    patterns: [
      /^(hi|hello|hey|gm|sup|yo|what'?s?\s+up)/i,
      /^how\s+are\s+you/i,
    ],
  },
];

export function detectIntent(input: string): ChatIntent {
  const trimmed = input.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(trimmed))) return intent;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Response Generation
// ---------------------------------------------------------------------------

export function generateChatResponse(
  input: string,
  context: ChatContext,
): ChatResponse {
  const intent = detectIntent(input);

  switch (intent) {
    case "privacy_check":
      return generatePrivacyCheckResponse(input, context);
    case "withdrawal_timing":
      return generateWithdrawalTimingResponse(input, context);
    case "threat_detection":
      return generateThreatResponse(context);
    case "pool_analysis":
      return generatePoolAnalysisResponse(context);
    case "strategy":
      return generateStrategyResponse(input, context);
    case "education":
      return generateEducationResponse(input);
    case "greeting":
      return generateGreetingResponse(context);
    default:
      return generateFallbackResponse(context);
  }
}

// ---------------------------------------------------------------------------
// Intent-Specific Response Generators
// ---------------------------------------------------------------------------

function generatePrivacyCheckResponse(input: string, ctx: ChatContext): ChatResponse {
  const cards: ChatCard[] = [];
  const messages: string[] = [];

  if (ctx.deposits.length === 0) {
    return {
      intent: "privacy_check",
      message: "You don't have any active deposits in the pool. Shield some USDC first, and I'll analyze your privacy in real-time.\n\nThe protocol uses fixed denominations ($1, $10, $100, $1,000) so all deposits at a tier look identical — the foundation of k-anonymity.",
      cards: [],
      premium: false,
      suggestions: ["How does the pool work?", "Check pool health", "What is k-anonymity?"],
    };
  }

  // Score each deposit
  for (const deposit of ctx.deposits.filter(d => !d.claimed)) {
    const score = calculateDepositPrivacy(deposit, ctx.pool);
    cards.push({ type: "privacy_score", data: score, tier: deposit.tier });

    const tierLabel = ["$1", "$10", "$100", "$1,000"][deposit.tier];
    if (score.overall >= 75) {
      messages.push(`Your **${tierLabel}** deposit has **${score.rating}** privacy (score: ${score.overall}/100). Anonymity set: ${score.anonymitySetSize} participants. ${score.recommendation}`);
    } else if (score.overall >= 40) {
      messages.push(`Your **${tierLabel}** deposit has **${score.rating}** privacy (score: ${score.overall}/100). ${score.recommendation}`);
    } else {
      messages.push(`⚠ Your **${tierLabel}** deposit has **${score.rating}** privacy (score: ${score.overall}/100). ${score.recommendation}`);
    }
  }

  const avgScore = cards.reduce((sum, c) => sum + (c.type === "privacy_score" ? c.data.overall : 0), 0) / Math.max(cards.length, 1);

  return {
    intent: "privacy_check",
    message: messages.join("\n\n"),
    cards,
    premium: false,
    suggestions: [
      "When should I withdraw?",
      "Check for threats",
      avgScore < 60 ? "How can I improve my privacy?" : "Pool health analysis",
    ],
  };
}

function generateWithdrawalTimingResponse(_input: string, ctx: ChatContext): ChatResponse {
  const cards: ChatCard[] = [];
  const messages: string[] = [];

  if (ctx.deposits.length === 0) {
    return {
      intent: "withdrawal_timing",
      message: "No active deposits to analyze. Shield USDC first, then I'll tell you the optimal time to withdraw.",
      cards: [],
      premium: false,
      suggestions: ["How does shielding work?", "Check pool health"],
    };
  }

  for (const deposit of ctx.deposits.filter(d => !d.claimed)) {
    const rec = getWithdrawalRecommendation(deposit, ctx.pool);
    const tierLabel = ["$1", "$10", "$100", "$1,000"][deposit.tier];
    cards.push({ type: "withdrawal_rec", data: rec, tier: deposit.tier });

    if (rec.shouldWithdraw) {
      messages.push(`**${tierLabel} deposit**: ${rec.shouldWithdraw ? "✅" : "⏳"} Privacy score: **${rec.currentScore}/100**. ${rec.waitRecommendation}`);
    } else {
      messages.push(`**${tierLabel} deposit**: ⏳ Privacy score: **${rec.currentScore}/100** (projected: ${rec.projectedScore} after waiting). ${rec.waitRecommendation}`);
    }

    if (rec.strengths.length > 0) {
      messages.push(`Strengths: ${rec.strengths.join("; ")}`);
    }
    if (rec.risks.length > 0) {
      messages.push(`Risks: ${rec.risks.join("; ")}`);
    }
  }

  return {
    intent: "withdrawal_timing",
    message: messages.join("\n\n"),
    cards,
    premium: false,
    suggestions: ["Check my privacy score", "Analyze threats", "Pool health"],
  };
}

function generateThreatResponse(ctx: ChatContext): ChatResponse {
  const threats = detectPrivacyThreats(ctx.deposits, ctx.pool);
  const cards: ChatCard[] = [{ type: "threats", data: threats }];

  if (threats.length === 0) {
    return {
      intent: "threat_detection",
      message: "No active privacy threats detected. Your deposits appear to be in a safe state.\n\nI continuously monitor for: anonymity set degradation, timing correlation risks, amount fingerprinting, and deposit pattern analysis.",
      cards: [],
      premium: false,
      suggestions: ["Check my privacy score", "When should I withdraw?", "Pool analysis"],
    };
  }

  const criticals = threats.filter(t => t.severity === "critical");
  const warnings = threats.filter(t => t.severity === "warning");

  let message = `Found **${threats.length} privacy concern${threats.length > 1 ? "s" : ""}**:`;

  if (criticals.length > 0) {
    message += `\n\n🔴 **Critical** (${criticals.length}):`;
    for (const t of criticals) {
      message += `\n- **${t.title}**: ${t.description}\n  → *${t.mitigation}*`;
    }
  }

  if (warnings.length > 0) {
    message += `\n\n🟡 **Warnings** (${warnings.length}):`;
    for (const t of warnings) {
      message += `\n- **${t.title}**: ${t.description}\n  → *${t.mitigation}*`;
    }
  }

  const infos = threats.filter(t => t.severity === "info");
  if (infos.length > 0) {
    message += `\n\nℹ️ **Info** (${infos.length}):`;
    for (const t of infos) {
      message += `\n- **${t.title}**: ${t.description}`;
    }
  }

  return {
    intent: "threat_detection",
    message,
    cards,
    premium: false,
    suggestions: ["How can I fix these?", "When should I withdraw?", "Check privacy score"],
  };
}

function generatePoolAnalysisResponse(ctx: ChatContext): ChatResponse {
  const health = calculatePoolHealth(ctx.pool);
  const cards: ChatCard[] = [{ type: "pool_health", data: health }];

  let message = `## Pool Privacy Health: **${health.rating}** (${health.overall}/100)\n\n`;
  message += `**Composite Security Index**: ${health.csi}\n\n`;

  message += `### Per-Tier Anonymity\n`;
  for (const tier of health.tiers) {
    const bar = tier.participants > 0 ? "█".repeat(Math.min(tier.participants, 20)) : "░";
    message += `- **${tier.label}**: ${tier.participants} deposits · ${tier.unlinkability} · Guess probability: ${tier.guessProb}\n`;
  }

  if (health.suggestions.length > 0) {
    message += `\n### Recommendations\n`;
    for (const s of health.suggestions) {
      message += `- ${s}\n`;
    }
  }

  return {
    intent: "pool_analysis",
    message,
    cards,
    premium: false,
    suggestions: ["Check my deposit privacy", "Analyze threats", "When should I withdraw?"],
  };
}

function generateStrategyResponse(input: string, ctx: ChatContext): ChatResponse {
  // Extract dollar amount from input
  const amountMatch = input.match(/\$?(\d+(?:,\d{3})*(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  if (!amount || amount <= 0) {
    return {
      intent: "strategy",
      message: "I can help you plan a privacy-optimized deposit strategy. Just tell me the amount — for example:\n\n- \"$50 with maximum privacy\"\n- \"DCA $200 over 5 deposits\"\n- \"$100 spread across tiers\"",
      cards: [],
      premium: false,
      suggestions: ["$50 max privacy", "$100 spread across tiers", "DCA $200 over 5 deposits"],
    };
  }

  // Analyze which tiers to use based on privacy state
  const health = calculatePoolHealth(ctx.pool);
  const weakestTier = health.tiers.reduce((w, t) => t.participants < w.participants ? t : w);

  let message = `## Strategy for $${amount}\n\n`;

  // Recommend tiers based on privacy optimization
  const tiers = [1000, 100, 10, 1];
  const tierNames = ["$1,000", "$100", "$10", "$1"];
  const plan: { tier: number; count: number; label: string }[] = [];
  let remaining = amount;

  for (let i = 0; i < tiers.length; i++) {
    if (remaining >= tiers[i]) {
      const count = Math.floor(remaining / tiers[i]);
      plan.push({ tier: 3 - i, count, label: tierNames[i] });
      remaining -= count * tiers[i];
    }
  }

  message += `### Deposit Plan\n`;
  for (const p of plan) {
    const tierAnon = ctx.pool.anonSets[p.tier] ?? 0;
    message += `- **${p.count}x ${p.label}** → joins anonymity set of ${tierAnon} (will become ${tierAnon + p.count})\n`;
  }

  message += `\n### Privacy Optimization\n`;
  if (weakestTier.participants < 3) {
    message += `- Consider allocating some to the **${weakestTier.label}** tier (only ${weakestTier.participants} deposits) — your deposit has maximum marginal privacy impact there.\n`;
  }
  message += `- Use the **AI Strategist** above to execute this plan with one click.\n`;
  message += `- After depositing, wait at least 2-6 hours before withdrawing for temporal decorrelation.\n`;

  return {
    intent: "strategy",
    message,
    cards: [{ type: "pool_health", data: health }],
    premium: false,
    suggestions: ["Check pool health", "What is k-anonymity?", "How does the ZK proof work?"],
  };
}

function generateEducationResponse(input: string): ChatResponse {
  const lower = input.toLowerCase();

  const topics: Record<string, { title: string; content: string; followUp: string[] }> = {
    "zk|zero.know|proof": {
      title: "Zero-Knowledge Proofs",
      content: "A **zero-knowledge proof** lets you prove you know a secret without revealing the secret itself.\n\nIn Veil Protocol, when you withdraw, you generate a ZK proof in your browser that says: *\"I know the secret for one of the deposits in the Merkle tree\"* — without revealing **which** deposit. The proof is verified on-chain by the Garaga verifier contract.\n\nThis means:\n- The blockchain confirms you're a legitimate depositor\n- Nobody (including the contract) learns which deposit is yours\n- Your secret never leaves your browser",
      followUp: ["What is a Merkle tree?", "What is a nullifier?", "How does the anonymity set work?"],
    },
    "merkle": {
      title: "Merkle Trees",
      content: "A **Merkle tree** is a data structure where every deposit becomes a leaf, and leaves are hashed together in pairs up to a single root hash.\n\nIn Veil Protocol, your deposit creates a leaf (a hash of your secret). The Merkle root summarizes all deposits. When you withdraw, you provide a Merkle proof showing your leaf exists in the tree — but the proof works for ANY leaf, so nobody knows which one is yours.\n\nThe tree currently has **20 levels**, supporting up to 1,048,576 deposits.",
      followUp: ["What is a ZK proof?", "What is a nullifier?", "Check pool health"],
    },
    "nullifier": {
      title: "Nullifiers",
      content: "A **nullifier** is a unique value derived from your deposit secret. When you withdraw, you reveal the nullifier (but NOT the secret).\n\nThe contract checks:\n1. The nullifier hasn't been used before (prevents double-spending)\n2. Your ZK proof is valid (proves you know a deposit secret)\n\nThe nullifier is **deterministically derived** from your secret, so the same deposit always produces the same nullifier. But crucially, you **cannot reverse** a nullifier to find the original secret or deposit.",
      followUp: ["What is a ZK proof?", "How does the anonymity set work?", "Check my privacy"],
    },
    "anonymity|k.anon": {
      title: "Anonymity Sets & k-Anonymity",
      content: "**k-anonymity** means your action is indistinguishable from at least k-1 others.\n\nIf 10 people deposited $100, and one person withdraws $100, an observer has a **1/10 (10%) chance** of guessing correctly — that's k=10 anonymity.\n\nVeil Protocol uses **fixed denominations** ($1, $10, $100, $1,000) so all deposits at a tier are identical amounts. This prevents **amount fingerprinting** — one of the most common deanonymization attacks.\n\nThe larger the anonymity set, the stronger your privacy:\n- k=2: 50% guess rate (weak)\n- k=10: 10% guess rate (strong)\n- k=100: 1% guess rate (excellent)",
      followUp: ["Check my anonymity set", "How does the ZK proof work?", "Pool health"],
    },
    "privacy.pool|shielded|how.does.*(pool|protocol)": {
      title: "How Veil Protocol Works",
      content: "Veil Protocol is a **shielded pool** for confidential Bitcoin accumulation:\n\n1. **Shield**: Deposit USDC into fixed tiers ($1/$10/$100/$1K). A cryptographic commitment is stored on-chain — just a hash, not your identity.\n\n2. **Batch**: Deposits accumulate, then convert to WBTC via AVNU DEX in one batch. Individual intent is invisible within the batch.\n\n3. **Claim**: Generate a ZK proof in your browser that proves you deposited — without revealing which deposit. Withdraw to any fresh wallet.\n\nThe privacy comes from: **fixed denominations** (no amount correlation), **ZK proofs** (no deposit↔withdrawal link), **time batching** (no timing correlation), and **fresh addresses** (no address reuse).",
      followUp: ["What is a ZK proof?", "What is k-anonymity?", "Check pool health"],
    },
  };

  for (const [pattern, topic] of Object.entries(topics)) {
    if (new RegExp(pattern, "i").test(lower)) {
      return {
        intent: "education",
        message: `## ${topic.title}\n\n${topic.content}`,
        cards: [],
        premium: false,
        suggestions: topic.followUp,
      };
    }
  }

  return {
    intent: "education",
    message: "I can explain how Veil Protocol's privacy works. Try asking about:\n\n- **Zero-knowledge proofs** — how withdrawals stay private\n- **Merkle trees** — how deposits are organized\n- **Nullifiers** — how double-spending is prevented\n- **k-Anonymity** — how anonymity sets protect you\n- **The protocol** — the full Shield → Batch → Claim pipeline",
    cards: [],
    premium: false,
    suggestions: ["What is a ZK proof?", "How does the pool work?", "What is k-anonymity?"],
  };
}

function generateGreetingResponse(ctx: ChatContext): ChatResponse {
  const health = calculatePoolHealth(ctx.pool);
  const hasDeposits = ctx.deposits.filter(d => !d.claimed).length > 0;

  let message = "I'm Veil's Privacy Agent — I monitor your on-chain privacy in real-time and help you maximize anonymity.\n\n";

  if (hasDeposits) {
    const scores = ctx.deposits.filter(d => !d.claimed).map(d => calculateDepositPrivacy(d, ctx.pool));
    const avgScore = Math.round(scores.reduce((s, sc) => s + sc.overall, 0) / scores.length);
    message += `You have **${scores.length}** active deposit${scores.length > 1 ? "s" : ""}. Average privacy score: **${avgScore}/100**.\n\n`;
    message += "What would you like to know?";
  } else {
    message += `Pool health: **${health.rating}** (${health.overall}/100) · ${ctx.pool.totalDeposits} deposits across ${ctx.pool.activeTiers} tiers.\n\n`;
    message += "Ask me anything about privacy, deposit strategies, or how the protocol works.";
  }

  return {
    intent: "greeting",
    message,
    cards: hasDeposits ? [] : [{ type: "pool_health", data: health }],
    premium: false,
    suggestions: hasDeposits
      ? ["Check my privacy", "When should I withdraw?", "Analyze threats"]
      : ["How does the pool work?", "Check pool health", "What is k-anonymity?"],
  };
}

function generateFallbackResponse(ctx: ChatContext): ChatResponse {
  const hasDeposits = ctx.deposits.filter(d => !d.claimed).length > 0;

  return {
    intent: "unknown",
    message: "I'm your Privacy Agent — I can help with:\n\n- **\"Check my privacy\"** — score your deposit anonymity\n- **\"When should I withdraw?\"** — optimal timing analysis\n- **\"Analyze risks\"** — detect privacy threats\n- **\"Pool health\"** — anonymity set analysis\n- **\"$50 max privacy\"** — deposit strategy planning\n- **\"How does ZK work?\"** — privacy education",
    cards: [],
    premium: false,
    suggestions: hasDeposits
      ? ["Check my privacy", "When to withdraw?", "Analyze threats"]
      : ["Pool health", "How does the pool work?", "$100 max privacy"],
  };
}
