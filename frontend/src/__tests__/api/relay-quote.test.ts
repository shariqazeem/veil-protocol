import { describe, it, expect, vi } from "vitest";

vi.mock("x402-starknet", () => ({
  buildUSDCPayment: vi.fn().mockReturnValue({ type: "usdc", amount: "30000" }),
  buildSTRKPayment: vi.fn().mockReturnValue({ type: "strk", amount: "15000000000000000" }),
  HTTP_HEADERS: { PAYMENT_REQUIRED: "X-Payment-Required", PAYMENT_SIGNATURE: "X-Payment" },
}));

vi.mock("@/contracts/addresses.json", () => ({
  default: {
    network: "sepolia",
    deployer: "0xDEPLOYER",
    contracts: { shieldedPool: "0xPOOL", usdc: "0xUSDC", wbtc: "0xWBTC" },
  },
}));

vi.mock("starknet", () => ({
  Account: vi.fn(),
  RpcProvider: vi.fn(),
  ETransactionVersion: { V1: "0x1", V3: "0x3" },
}));

describe("relay-quote", () => {
  it("returns 402 with x402 payment requirements", async () => {
    const { GET } = await import("@/app/api/relayer/relay-quote/route");
    const res = await GET();
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.x402Version).toBe(2);
    expect(body.resource.url).toBe("/api/relayer/relay");
    expect(body.accepts).toHaveLength(1);
  });

  it("includes X-Payment-Required header", async () => {
    const { GET } = await import("@/app/api/relayer/relay-quote/route");
    const res = await GET();
    const header = res.headers.get("X-Payment-Required");
    expect(header).toBeTruthy();

    // Header should be base64-encoded JSON
    const decoded = JSON.parse(Buffer.from(header!, "base64").toString());
    expect(decoded.x402Version).toBe(2);
  });

  it("resource description mentions flat fee", async () => {
    const { GET } = await import("@/app/api/relayer/relay-quote/route");
    const res = await GET();
    const body = await res.json();
    expect(body.resource.description).toMatch(/flat fee/i);
  });
});
