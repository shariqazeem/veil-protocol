import { describe, it, expect, vi } from "vitest";

// Mock the privacy module to avoid Pedersen dependency
vi.mock("@/utils/privacy", () => ({
  DENOMINATIONS: { 0: 1_000_000, 1: 10_000_000, 2: 100_000_000, 3: 1_000_000_000 },
  DENOMINATION_LABELS: { 0: "$1", 1: "$10", 2: "$100", 3: "$1,000" },
}));

import {
  parseTargetUsdc,
  detectStrategyType,
  generateStrategy,
  computePoolHealth,
  assessRisk,
  generateAgentLog,
} from "@/utils/strategyEngine";
import type { PoolState, AgentStep } from "@/utils/strategyEngine";

const mockPool: PoolState = {
  pendingUsdc: 50,
  batchCount: 3,
  leafCount: 12,
  anonSets: { 0: 5, 1: 3, 2: 2, 3: 1 },
  btcPrice: 97000,
};

// ----------------------------------------------------------------
// parseTargetUsdc
// ----------------------------------------------------------------

describe("parseTargetUsdc", () => {
  it("parses '$50' as 50", () => {
    expect(parseTargetUsdc("$50")).toBe(50);
  });

  it("parses '100 dollars' as 100", () => {
    expect(parseTargetUsdc("100 dollars")).toBe(100);
  });

  it("parses 'accumulate 30' as 30", () => {
    expect(parseTargetUsdc("accumulate 30")).toBe(30);
  });

  it("parses '0.5 BTC' with btcPrice=100000 as 50000", () => {
    expect(parseTargetUsdc("0.5 BTC", 100000)).toBe(50000);
  });

  it("parses 'half a bitcoin' with btcPrice=100000 as 50000", () => {
    expect(parseTargetUsdc("half a bitcoin", 100000)).toBe(50000);
  });
});

// ----------------------------------------------------------------
// detectStrategyType
// ----------------------------------------------------------------

describe("detectStrategyType", () => {
  it("detects 'max privacy' as privacy_first", () => {
    expect(detectStrategyType("max privacy", 50)).toBe("privacy_first");
  });

  it("detects 'fast' as efficiency", () => {
    expect(detectStrategyType("fast", 50)).toBe("efficiency");
  });

  it("detects 'DCA 5 deposits' as stealth_dca", () => {
    expect(detectStrategyType("DCA 5 deposits", 50)).toBe("stealth_dca");
  });

  it("detects '$1000 whale' as whale", () => {
    expect(detectStrategyType("$1000 whale", 1000)).toBe("whale");
  });

  it("detects 'balanced' as balanced", () => {
    expect(detectStrategyType("balanced", 50)).toBe("balanced");
  });
});

// ----------------------------------------------------------------
// generateStrategy
// ----------------------------------------------------------------

describe("generateStrategy", () => {
  it("returns an AgentPlan with steps and totalUsdc > 0", () => {
    const plan = generateStrategy(50, mockPool, 97000, "deposit $50");

    expect(plan).toBeDefined();
    expect(plan.analysis).toBeTruthy();
    expect(plan.reasoning).toBeTruthy();
    expect(plan.strategy).toBeDefined();
    expect(plan.strategy.totalUsdc).toBeGreaterThan(0);
    expect(plan.strategy.steps.length).toBeGreaterThan(0);
    expect(plan.strategy.estimatedBtc).toBeTruthy();
    expect(plan.strategy.privacyScore).toBeTruthy();
    expect(plan.strategy.csiImpact).toBeTruthy();
  });
});

// ----------------------------------------------------------------
// computePoolHealth
// ----------------------------------------------------------------

describe("computePoolHealth", () => {
  it("returns 'Weak' with score 0 for all-zero pool", () => {
    const emptyPool: PoolState = {
      pendingUsdc: 0,
      batchCount: 0,
      leafCount: 0,
      anonSets: { 0: 0, 1: 0, 2: 0, 3: 0 },
      btcPrice: 97000,
    };

    const health = computePoolHealth(emptyPool);

    expect(health.rating).toBe("Weak");
    expect(health.score).toBe(0);
  });

  it("returns a higher score for a strong pool", () => {
    const strongPool: PoolState = {
      pendingUsdc: 1000,
      batchCount: 20,
      leafCount: 100,
      anonSets: { 0: 15, 1: 12, 2: 10, 3: 8 },
      btcPrice: 97000,
    };

    const health = computePoolHealth(strongPool);

    expect(health.score).toBeGreaterThan(50);
    expect(["Excellent", "Strong"]).toContain(health.rating);
  });
});

// ----------------------------------------------------------------
// assessRisk
// ----------------------------------------------------------------

describe("assessRisk", () => {
  it("flags single-tier concentration when >2 steps are in one tier", () => {
    const steps: AgentStep[] = [
      { tier: 1, label: "$10", usdcAmount: 10, delaySeconds: 0, description: "test" },
      { tier: 1, label: "$10", usdcAmount: 10, delaySeconds: 0, description: "test" },
      { tier: 1, label: "$10", usdcAmount: 10, delaySeconds: 0, description: "test" },
    ];

    const risk = assessRisk(steps, mockPool, 97000);

    expect(risk.score).toBeGreaterThan(0);
    expect(risk.factors.some((f) => /single-tier concentration/i.test(f))).toBe(true);
  });
});

// ----------------------------------------------------------------
// generateAgentLog
// ----------------------------------------------------------------

describe("generateAgentLog", () => {
  it("returns entries with observe, think, decide, and result types", () => {
    const logs = generateAgentLog(50, mockPool, 97000, "deposit $50");

    expect(logs.length).toBeGreaterThan(0);

    const types = new Set(logs.map((l) => l.type));
    expect(types.has("observe")).toBe(true);
    expect(types.has("think")).toBe(true);
    expect(types.has("decide")).toBe(true);
    expect(types.has("result")).toBe(true);

    // Every entry should have a timestamp and message
    for (const entry of logs) {
      expect(typeof entry.timestamp).toBe("number");
      expect(typeof entry.message).toBe("string");
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });
});
