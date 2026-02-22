import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolContract = {
  get_pending_usdc: vi.fn().mockResolvedValue(BigInt(50_000_000)),
  get_batch_count: vi.fn().mockResolvedValue(5),
  get_leaf_count: vi.fn().mockResolvedValue(20),
  get_anonymity_set: vi.fn().mockImplementation((tier: number) => {
    return Promise.resolve([3, 5, 8, 2][tier] ?? 0);
  }),
  get_total_volume: vi.fn().mockResolvedValue(BigInt(500_000_000)),
  get_total_batches_executed: vi.fn().mockResolvedValue(3),
};

vi.mock("starknet", () => ({
  RpcProvider: vi.fn().mockImplementation(() => ({ nodeUrl: "mock" })),
  Contract: vi.fn().mockImplementation(() => mockPoolContract),
}));

vi.mock("@/contracts/addresses.json", () => ({
  default: {
    network: "sepolia",
    contracts: { shieldedPool: "0xPOOL", usdc: "0xUSDC", wbtc: "0xWBTC", avnuRouter: "0xROUTER" },
  },
}));

vi.mock("@/app/api/relayer/shared", () => ({
  POOL_ADDRESS: "0xPOOL",
  RPC_URL: "https://mock-rpc.test",
}));

describe("chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 95000 } }),
      }),
    );
  });

  it("POST returns 400 without input", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST with greeting returns chat response", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "hello" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("greeting");
    expect(body.message).toBeDefined();
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.suggestions).toBeDefined();
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it("POST with pool analysis returns health data", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "check pool health" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("pool_analysis");
    expect(body.cards).toBeDefined();
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.cards[0].type).toBe("pool_health");
  });

  it("POST with privacy check and deposits returns scores", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "how private am I?",
          deposits: [
            { tier: 0, depositTimestamp: Date.now() - 3600000, leafIndex: 5, claimed: false },
          ],
        }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("privacy_check");
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.cards[0].type).toBe("privacy_score");
    expect(body.cards[0].data.overall).toBeGreaterThan(0);
  });

  it("POST with strategy question returns plan", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "$100 max privacy" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("strategy");
    expect(body.message).toContain("$100");
  });

  it("POST with education question returns explanation", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "What is a zero knowledge proof?" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("education");
    expect(body.message).toContain("Zero-Knowledge");
  });
});
