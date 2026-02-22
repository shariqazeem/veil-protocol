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

describe("privacy-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 with pool health data", async () => {
    const { GET } = await import("@/app/api/agent/privacy-score/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.pool).toBeDefined();
    expect(body.pool.anonSets).toEqual([3, 5, 8, 2]);
    expect(body.pool.totalDeposits).toBe(18);
    expect(body.pool.activeTiers).toBe(4);
    expect(body.health).toBeDefined();
    expect(body.health.overall).toBeGreaterThan(0);
    expect(body.health.rating).toBeDefined();
    expect(body.health.tiers).toHaveLength(4);
    expect(body.health.metrics).toBeDefined();
    expect(body.health.suggestions).toBeDefined();
  });

  it("GET returns 500 when pool read fails", async () => {
    mockPoolContract.get_pending_usdc.mockRejectedValueOnce(new Error("RPC down"));
    const { GET } = await import("@/app/api/agent/privacy-score/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch");
  });
});
