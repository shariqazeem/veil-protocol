import { describe, it, expect, vi, beforeEach } from "vitest";

// Track rate-limit call count so we can simulate rate limiting
let rateLimitCallCount = 0;
let rateLimitShouldBlock = false;

// Mock relayer account
const mockExecute = vi.fn();
const mockAccount = {
  address: "0xRELAYER",
  execute: mockExecute,
};

const mockWaitForTransaction = vi.fn();

vi.mock("@/app/api/relayer/shared", () => ({
  POOL_ADDRESS: "0xPOOL",
  FEE_BPS: 200,
  NETWORK: "sepolia",
  X402_RELAY_ENABLED: true,
  RELAY_FEE_USDC: 0.03,
  RELAY_FEE_STRK: 0.015,
  RPC_URL: "https://mock-rpc.test",
  TREASURY_ADDRESS: "0xTREASURY",
  rateLimit: vi.fn((_ip: string) => {
    rateLimitCallCount++;
    if (rateLimitShouldBlock) {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded — try again later" },
        { status: 429 },
      );
    }
    return null;
  }),
  getRelayerAccount: vi.fn(() => mockAccount),
  getProvider: vi.fn(() => ({
    waitForTransaction: mockWaitForTransaction,
  })),
}));

vi.mock("@/contracts/abi", () => ({
  SHIELDED_POOL_ABI: [],
}));

vi.mock("starknet", () => ({
  Contract: vi.fn(),
  CallData: { compile: vi.fn((data: any) => data) },
  RpcProvider: vi.fn(),
}));

vi.mock("x402-starknet", () => ({
  verifyPayment: vi.fn().mockResolvedValue({ isValid: true, payer: "0xPAYER" }),
  settlePayment: vi.fn().mockResolvedValue({ success: true, transaction: "0xSETTLE" }),
  decodePaymentSignature: vi.fn().mockReturnValue({ payload: "mock" }),
  buildUSDCPayment: vi.fn().mockReturnValue({ type: "usdc" }),
  buildSTRKPayment: vi.fn().mockReturnValue({ type: "strk" }),
  HTTP_HEADERS: { PAYMENT_REQUIRED: "X-Payment-Required", PAYMENT_SIGNATURE: "X-Payment" },
}));

function buildValidBody() {
  return {
    denomination: 1,
    zk_nullifier: "0xNULLIFIER",
    zk_commitment: "0xCOMMITMENT",
    proof: ["0x1", "0x2"],
    merkle_path: ["0xa", "0xb"],
    path_indices: [0, 1],
    recipient: "0xRECIPIENT",
    btc_recipient_hash: "0xBTC",
  };
}

describe("relay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCallCount = 0;
    rateLimitShouldBlock = false;
    mockExecute.mockResolvedValue({ transaction_hash: "0xTXHASH" });
    mockWaitForTransaction.mockResolvedValue({});
  });

  it("returns 429 when rate limit is exceeded", async () => {
    rateLimitShouldBlock = true;
    const { POST } = await import("@/app/api/relayer/relay/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/relayer/relay", {
        method: "POST",
        body: JSON.stringify(buildValidBody()),
        headers: { "x-forwarded-for": "1.2.3.4" },
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Rate limit");
  });

  it("returns 503 when relayer account is not configured", async () => {
    const shared = await import("@/app/api/relayer/shared");
    vi.mocked(shared.getRelayerAccount).mockReturnValueOnce(null);

    const { POST } = await import("@/app/api/relayer/relay/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/relayer/relay", {
        method: "POST",
        body: JSON.stringify(buildValidBody()),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Relayer not configured");
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/relayer/relay/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/relayer/relay", {
        method: "POST",
        body: JSON.stringify({ denomination: 1 }), // missing other fields
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 200 with txHash on successful relay", async () => {
    const { POST } = await import("@/app/api/relayer/relay/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/relayer/relay", {
        method: "POST",
        body: JSON.stringify(buildValidBody()),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.txHash).toBe("0xTXHASH");
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockWaitForTransaction).toHaveBeenCalledWith("0xTXHASH");
  });

  it("returns 500 when execution throws an error", async () => {
    mockExecute.mockRejectedValueOnce(new Error("Transaction reverted"));

    const { POST } = await import("@/app/api/relayer/relay/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new Request("http://test/api/relayer/relay", {
        method: "POST",
        body: JSON.stringify(buildValidBody()),
      }),
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Transaction reverted");
  });
});
