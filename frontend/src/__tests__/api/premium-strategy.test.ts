import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock x402-starknet
vi.mock("x402-starknet", () => ({
  buildSTRKPayment: vi
    .fn()
    .mockReturnValue({ type: "strk", amount: "5000000000000000", payTo: "0xTREASURY", asset: "0xSTRK" }),
  STRK_ADDRESSES: {
    "starknet:sepolia": "0xSTRK",
    "starknet:mainnet": "0xSTRK_MAIN",
  },
}));

// Mock starknet — provide Contract as a constructor that returns mock pool methods
const mockPoolContract = {
  get_pending_usdc: vi.fn().mockResolvedValue(BigInt(50_000_000)),
  get_batch_count: vi.fn().mockResolvedValue(5),
  get_leaf_count: vi.fn().mockResolvedValue(20),
  get_anonymity_set: vi.fn().mockResolvedValue(8),
  get_total_volume: vi.fn().mockResolvedValue(BigInt(500_000_000)),
  get_total_batches_executed: vi.fn().mockResolvedValue(3),
};

// Mock RpcProvider with waitForTransaction
const mockProvider = {
  nodeUrl: "mock",
  waitForTransaction: vi.fn().mockResolvedValue({
    events: [
      {
        from_address: "0xSTRK",
        keys: [
          "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9",
          "0xPAYER",
          "0xTREASURY",
        ],
        data: ["5000000000000000", "0"],
      },
    ],
  }),
};

vi.mock("starknet", () => ({
  RpcProvider: vi.fn().mockImplementation(() => mockProvider),
  Contract: vi.fn().mockImplementation(() => mockPoolContract),
  num: {
    toHex: (v: any) => {
      if (typeof v === "bigint" || typeof v === "number") return "0x" + v.toString(16);
      return String(v).toLowerCase();
    },
    toBigInt: (v: any) => {
      try { return BigInt(v); } catch { return BigInt(0); }
    },
  },
}));

vi.mock("@/contracts/addresses.json", () => ({
  default: {
    network: "sepolia",
    contracts: {
      shieldedPool: "0xPOOL",
      usdc: "0xUSDC",
      wbtc: "0xWBTC",
      avnuRouter: "0xROUTER",
    },
  },
}));

vi.mock("@/app/api/relayer/shared", () => ({
  POOL_ADDRESS: "0xPOOL",
  RPC_URL: "https://mock-rpc.test",
  NETWORK: "sepolia",
  TREASURY_ADDRESS: "0xTREASURY",
}));

// Prevent real fetch for BTC price — return mock price
describe("premium-strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for BTC price calls
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 95000 } }),
      }),
    );
  });

  it("GET returns 402 with payment requirements", async () => {
    const { GET } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const res = await GET();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
    expect(body.error).toContain("Payment required");
    expect(body.accepts).toBeDefined();
    expect(Array.isArray(body.accepts)).toBe(true);
  });

  it("POST without payment_tx returns 402", async () => {
    const { POST } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "analyze pool" }),
      }),
    );
    const res = await POST(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
  });

  it("POST with valid payment_tx returns 200 with premium analysis", async () => {
    const { POST } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "test", payment_tx: "0xTX123" }),
      }),
    );
    const res = await POST(nextReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.premium).toBe(true);
    expect(body.your_deposits).toBeDefined();
    expect(body.optimal_plan).toBeDefined();
    expect(body.recommendations).toBeDefined();
    expect(body.pool_summary).toBeDefined();
    expect(body.payment).toBeDefined();
    expect(body.payment.settled).toBe(true);
    expect(body.payment.transaction).toBe("0xTX123");
    expect(body.payment.method).toBe("direct_transfer");
  });

  it("POST with invalid payment_tx returns 402", async () => {
    // Override waitForTransaction to return no matching events
    mockProvider.waitForTransaction.mockResolvedValueOnce({
      events: [],
    });

    const { POST } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "test", payment_tx: "0xBAD_TX" }),
      }),
    );
    const res = await POST(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("transfer to treasury not found");
  });
});
