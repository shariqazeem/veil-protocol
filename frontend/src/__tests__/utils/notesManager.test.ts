import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock privacy module
vi.mock("@/utils/privacy", () => ({
  loadNotes: vi.fn().mockReturnValue([]),
  loadNotesEncrypted: vi.fn().mockResolvedValue([]),
}));

// Mock contract ABI
vi.mock("@/contracts/abi", () => ({
  SHIELDED_POOL_ABI: [],
}));

// Mock network config
vi.mock("@/utils/network", () => ({
  RPC_URL: "https://mock-rpc.test",
}));

// Mock addresses
vi.mock("@/contracts/addresses.json", () => ({
  default: { network: "sepolia", contracts: { shieldedPool: "0xPOOL" } },
}));

// Mock starknet
const mockCall = vi.fn();

vi.mock("starknet", () => ({
  RpcProvider: vi.fn().mockImplementation(() => ({ nodeUrl: "mock" })),
  Contract: vi.fn().mockImplementation(() => ({ call: mockCall })),
}));

import { checkNoteStatus, checkAllNoteStatuses } from "@/utils/notesManager";
import { loadNotes } from "@/utils/privacy";
import type { GhostNote } from "@/utils/privacy";

// Helper to create a test note
function makeNote(overrides: Partial<GhostNote> = {}): GhostNote {
  return {
    secret: "0xsecret1",
    blinder: "0xblinder1",
    amount: "10000000",
    denomination: 1,
    commitment: "0xcommitment1",
    batchId: 0,
    leafIndex: 0,
    claimed: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("notesManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCall.mockReset();
  });

  // ----------------------------------------------------------------
  // checkNoteStatus
  // ----------------------------------------------------------------

  describe("checkNoteStatus", () => {
    it("returns CLAIMED for a note that is already claimed", async () => {
      const note = makeNote({ claimed: true });

      const result = await checkNoteStatus(note);

      expect(result.status).toBe("CLAIMED");
      expect(result.commitment).toBe(note.commitment);
      // Should not have called the contract at all
      expect(mockCall).not.toHaveBeenCalled();
    });

    it("returns STALE when commitment is not valid on-chain", async () => {
      const note = makeNote();

      mockCall.mockImplementation(async (method: string) => {
        if (method === "is_commitment_valid") return false;
        return 0n;
      });

      const result = await checkNoteStatus(note);

      expect(result.status).toBe("STALE");
    });

    it("returns PENDING when batch is not finalized", async () => {
      const note = makeNote();

      mockCall.mockImplementation(async (method: string) => {
        if (method === "is_commitment_valid") return true;
        if (method === "get_batch_result") {
          return {
            is_finalized: false,
            total_usdc_in: 0n,
            total_wbtc_out: 0n,
            timestamp: 0n,
          };
        }
        if (method === "get_btc_identity") return 0n;
        return 0n;
      });

      const result = await checkNoteStatus(note);

      expect(result.status).toBe("PENDING");
    });

    it("returns READY with wbtcShare when batch is finalized", async () => {
      const note = makeNote({ amount: "10000000" }); // $10 = 10_000_000

      mockCall.mockImplementation(async (method: string) => {
        if (method === "is_commitment_valid") return true;
        if (method === "get_batch_result") {
          return {
            is_finalized: true,
            total_usdc_in: 100000000n,   // $100 total in pool
            total_wbtc_out: 100000n,     // 0.001 WBTC out
            timestamp: BigInt(Math.floor(Date.now() / 1000) - 120),
          };
        }
        if (method === "get_btc_identity") return 0n;
        return 0n;
      });

      const result = await checkNoteStatus(note);

      expect(result.status).toBe("READY");
      expect(result.wbtcShare).toBeDefined();
      // wbtcShare = (amount * totalWbtcOut) / totalUsdcIn
      // = (10_000_000 * 100_000) / 100_000_000 = 10_000
      // However, the mock rate implies BTC price < $1000, so the code
      // will attempt to fetch live price and fall back to on-chain ratio.
      // Since fetch is not mocked, the catch block uses the on-chain ratio.
      expect(typeof result.wbtcShare).toBe("string");
      expect(result.batchTimestamp).toBeDefined();
      expect(result.withdrawableAt).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  // checkAllNoteStatuses
  // ----------------------------------------------------------------

  describe("checkAllNoteStatuses", () => {
    it("filters out STALE notes from the result", async () => {
      const staleNote = makeNote({ commitment: "0xstale" });
      const validNote = makeNote({ commitment: "0xvalid", claimed: true });

      // Mock loadNotes to return both notes
      vi.mocked(loadNotes).mockReturnValue([staleNote, validNote]);

      mockCall.mockImplementation(async (method: string) => {
        if (method === "is_commitment_valid") return false; // staleNote fails
        return 0n;
      });

      // No walletAddress => uses loadNotes (plaintext path)
      const results = await checkAllNoteStatuses();

      // validNote is claimed so it becomes CLAIMED (no contract call needed)
      // staleNote has is_commitment_valid=false so it becomes STALE and is filtered out
      expect(results.length).toBe(1);
      expect(results[0].status).toBe("CLAIMED");
      expect(results[0].commitment).toBe("0xvalid");
    });
  });
});
