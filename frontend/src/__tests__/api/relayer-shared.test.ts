import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/contracts/addresses.json", () => ({
  default: {
    network: "sepolia",
    deployer: "0xDEPLOYER",
    contracts: {
      shieldedPool: "0xPOOL",
      usdc: "0xUSDC",
      wbtc: "0xWBTC",
    },
  },
}));

const MockAccount = vi.fn().mockImplementation((...args: any[]) => ({
  address: args.length >= 1 && typeof args[0] === "object" ? args[0].address : "0xACCOUNT",
}));

vi.mock("starknet", () => ({
  Account: MockAccount,
  RpcProvider: vi.fn().mockImplementation(() => ({ nodeUrl: "mock" })),
  ETransactionVersion: { V1: "0x1", V3: "0x3" },
}));

describe("relayer/shared", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("rateLimit", () => {
    it("returns null when under the limit", async () => {
      const { rateLimit } = await import("@/app/api/relayer/shared");
      const result = rateLimit("192.168.1.1");
      expect(result).toBeNull();
    });

    it("returns 429 when exceeding 10 requests per minute", async () => {
      const { rateLimit } = await import("@/app/api/relayer/shared");
      const ip = "10.0.0.1";
      // Make 10 requests — all should pass
      for (let i = 0; i < 10; i++) {
        expect(rateLimit(ip)).toBeNull();
      }
      // 11th request should be rate limited
      const result = rateLimit(ip);
      expect(result).not.toBeNull();
      const body = await result!.json();
      expect(result!.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Rate limit exceeded");
    });
  });

  describe("FEE_BPS", () => {
    it("equals 200 (2%)", async () => {
      const { FEE_BPS } = await import("@/app/api/relayer/shared");
      expect(FEE_BPS).toBe(200);
    });
  });

  describe("getRelayerAccount", () => {
    it("returns null when env vars are not set", async () => {
      vi.stubEnv("RELAYER_PRIVATE_KEY", "");
      vi.stubEnv("RELAYER_ACCOUNT_ADDRESS", "");
      const { getRelayerAccount } = await import("@/app/api/relayer/shared");
      const account = getRelayerAccount();
      expect(account).toBeNull();
    });

    it("returns an Account when env vars are provided", async () => {
      vi.stubEnv("RELAYER_PRIVATE_KEY", "0xPRIVATEKEY");
      vi.stubEnv("RELAYER_ACCOUNT_ADDRESS", "0xACCOUNTADDRESS");
      const { getRelayerAccount } = await import("@/app/api/relayer/shared");
      const account = getRelayerAccount();
      expect(account).not.toBeNull();
      // The mock Account constructor should have been called
      expect(MockAccount).toHaveBeenCalled();
    });
  });
});
