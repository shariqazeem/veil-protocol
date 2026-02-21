import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock x402-starknet before any imports
vi.mock("x402-starknet", () => ({
  buildUSDCPayment: vi.fn().mockReturnValue({ type: "usdc", amount: "10000" }),
  buildSTRKPayment: vi
    .fn()
    .mockReturnValue({ type: "strk", amount: "5000000000000000" }),
  verifyPayment: vi
    .fn()
    .mockResolvedValue({ isValid: true, payer: "0xPAYER" }),
  settlePayment: vi
    .fn()
    .mockResolvedValue({ success: true, transaction: "0xSETTLE" }),
  decodePaymentSignature: vi.fn().mockReturnValue({ payload: "mock" }),
  HTTP_HEADERS: {
    PAYMENT_REQUIRED: "X-Payment-Required",
    PAYMENT_SIGNATURE: "X-Payment",
  },
}));

// Mock our custom x402 utility (used by the route instead of settlePayment)
vi.mock("@/utils/x402", () => ({
  settlePaymentDefault: vi
    .fn()
    .mockResolvedValue({ success: true, transaction: "0xSETTLE", payer: "0xPAYER" }),
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

vi.mock("starknet", () => ({
  RpcProvider: vi.fn().mockImplementation(() => ({ nodeUrl: "mock" })),
  Contract: vi.fn().mockImplementation(() => mockPoolContract),
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
const originalFetch = globalThis.fetch;

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

  it("GET without payment header returns 402 with payment requirements", async () => {
    const { GET } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const req = new Request("http://test/api/agent/premium-strategy", {
      method: "GET",
    });
    // NextRequest needs nextUrl, use the NextRequest-compatible approach
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(req);
    const res = await GET(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
    expect(body.error).toContain("Payment required");
    expect(body.accepts).toBeDefined();
    expect(Array.isArray(body.accepts)).toBe(true);
    // Should have X-Payment-Required header
    expect(res.headers.get("X-Payment-Required")).toBeTruthy();
  });

  it("POST without payment header returns 402", async () => {
    const { POST } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "POST",
        body: JSON.stringify({ input: "analyze pool" }),
      }),
    );
    const res = await POST(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(2);
  });

  it("returns 200 with premium analysis when payment is valid", async () => {
    const { GET } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy?input=test", {
        method: "GET",
        headers: { "X-Payment": "valid-payment-sig" },
      }),
    );
    const res = await GET(nextReq);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.premium).toBe(true);
    expect(body.pool).toBeDefined();
    expect(body.tier_analysis).toBeDefined();
    expect(body.timing).toBeDefined();
    expect(body.recommendations).toBeDefined();
    expect(body.payment).toBeDefined();
    expect(body.payment.settled).toBe(true);
    expect(body.payment.transaction).toBe("0xSETTLE");
    expect(body.payment.payer).toBe("0xPAYER");
  });

  it("returns 402 when payment verification fails", async () => {
    const x402Util = await import("@/utils/x402");
    vi.mocked(x402Util.settlePaymentDefault).mockResolvedValueOnce({
      success: false,
      errorReason: "Bad signature",
      payer: undefined,
    });

    const { GET } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "GET",
        headers: { "X-Payment": "bad-payment-sig" },
      }),
    );
    const res = await GET(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Payment settlement failed");
    expect(body.reason).toBe("Bad signature");
  });

  it("returns 402 when payment settlement fails", async () => {
    const x402Util = await import("@/utils/x402");
    vi.mocked(x402Util.settlePaymentDefault).mockResolvedValueOnce({
      success: false,
      errorReason: "Insufficient funds",
      payer: "0xPAYER",
    });

    const { GET } = await import(
      "@/app/api/agent/premium-strategy/route"
    );
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest(
      new Request("http://test/api/agent/premium-strategy", {
        method: "GET",
        headers: { "X-Payment": "underfunded-sig" },
      }),
    );
    const res = await GET(nextReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Payment settlement failed");
    expect(body.reason).toBe("Insufficient funds");
  });
});
