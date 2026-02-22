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

vi.mock("x402-starknet", () => ({
  buildSTRKPayment: vi.fn().mockReturnValue({
    type: "strk",
    amount: "5000000000000000",
    payTo: "0xTREASURY",
    asset: "0xSTRK",
  }),
  STRK_ADDRESSES: {
    "starknet:sepolia": "0xSTRK",
    "starknet:mainnet": "0xSTRK_MAIN",
  },
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
  NETWORK: "sepolia",
  TREASURY_ADDRESS: "0xTREASURY",
}));

describe("privacy-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 402 with payment requirements", async () => {
    const { GET } = await import("@/app/api/agent/privacy-audit/route");
    const res = await GET();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
    expect(body.error).toContain("Payment required");
    expect(body.accepts).toBeDefined();
    expect(Array.isArray(body.accepts)).toBe(true);
  });

  it("POST without payment_tx returns 402", async () => {
    const { POST } = await import("@/app/api/agent/privacy-audit/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/privacy-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deposits: [] }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(402);
  });

  it("POST with valid payment_tx returns 200 with audit data", async () => {
    const { POST } = await import("@/app/api/agent/privacy-audit/route");
    const { NextRequest } = await import("next/server");
    const deposits = [
      { tier: 0, depositTimestamp: Date.now() - 3600000, leafIndex: 5, claimed: false },
      { tier: 2, depositTimestamp: Date.now() - 7200000, leafIndex: 10, claimed: false },
    ];
    const req = new NextRequest(
      new Request("http://test/api/agent/privacy-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deposits, payment_tx: "0xTX123" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.premium).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.totalDeposits).toBe(2);
    expect(body.summary.averagePrivacyScore).toBeGreaterThan(0);
    expect(body.deposits).toHaveLength(2);
    expect(body.deposits[0].score).toBeDefined();
    expect(body.deposits[0].recommendation).toBeDefined();
    expect(body.threats).toBeDefined();
    expect(body.poolHealth).toBeDefined();
    expect(body.payment.settled).toBe(true);
    expect(body.payment.transaction).toBe("0xTX123");
  });

  it("POST with invalid payment_tx returns 402", async () => {
    mockProvider.waitForTransaction.mockResolvedValueOnce({ events: [] });

    const { POST } = await import("@/app/api/agent/privacy-audit/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/agent/privacy-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deposits: [], payment_tx: "0xBAD" }),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("transfer to treasury not found");
  });
});
