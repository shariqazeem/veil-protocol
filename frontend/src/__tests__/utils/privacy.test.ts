import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock zkProver before importing privacy (must be hoisted)
vi.mock("@/utils/zkProver", () => ({
  computeZKCommitment: vi.fn().mockReturnValue(123456789n),
  computeZKNullifier: vi.fn().mockReturnValue(987654321n),
  bigintToHex: vi.fn().mockImplementation((n: bigint) => "0x" + n.toString(16)),
}));

import {
  DENOMINATIONS,
  DENOMINATION_LABELS,
  computeCommitment,
  computeNullifier,
  buildMerkleProof,
  generateNote,
  generatePrivateNote,
  loadNotes,
  saveNote,
  markNoteClaimed,
} from "@/utils/privacy";

describe("privacy utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ----------------------------------------------------------------
  // DENOMINATIONS
  // ----------------------------------------------------------------

  describe("DENOMINATIONS", () => {
    it("has correct values for all 4 tiers", () => {
      expect(DENOMINATIONS[0]).toBe(1_000_000);
      expect(DENOMINATIONS[1]).toBe(10_000_000);
      expect(DENOMINATIONS[2]).toBe(100_000_000);
      expect(DENOMINATIONS[3]).toBe(1_000_000_000);
    });
  });

  // ----------------------------------------------------------------
  // computeCommitment
  // ----------------------------------------------------------------

  describe("computeCommitment", () => {
    it("is deterministic — same inputs produce the same output", () => {
      const amount = BigInt(1_000_000);
      const secret = "0xabc123";
      const blinder = "0xdef456";

      const c1 = computeCommitment(amount, secret, blinder);
      const c2 = computeCommitment(amount, secret, blinder);

      expect(c1).toBe(c2);
      // Should be a hex string
      expect(c1).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("different secrets produce different commitments", () => {
      const amount = BigInt(1_000_000);
      const blinder = "0xdef456";

      const c1 = computeCommitment(amount, "0x1111", blinder);
      const c2 = computeCommitment(amount, "0x2222", blinder);

      expect(c1).not.toBe(c2);
    });
  });

  // ----------------------------------------------------------------
  // computeNullifier
  // ----------------------------------------------------------------

  describe("computeNullifier", () => {
    it("is deterministic — same secret produces the same nullifier", () => {
      const secret = "0xabc123";

      const n1 = computeNullifier(secret);
      const n2 = computeNullifier(secret);

      expect(n1).toBe(n2);
      expect(n1).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("different secrets produce different nullifiers", () => {
      const n1 = computeNullifier("0xaaaa");
      const n2 = computeNullifier("0xbbbb");

      expect(n1).not.toBe(n2);
    });
  });

  // ----------------------------------------------------------------
  // buildMerkleProof
  // ----------------------------------------------------------------

  describe("buildMerkleProof", () => {
    it("returns path of length 20 and indices of length 20", () => {
      const leaves = [
        "0xaaa",
        "0xbbb",
        "0xccc",
        "0xddd",
      ];

      const proof = buildMerkleProof(0, leaves);

      expect(proof.path).toHaveLength(20);
      expect(proof.indices).toHaveLength(20);
    });

    it("indices are all 0 or 1", () => {
      const leaves = [
        "0xaaa",
        "0xbbb",
        "0xccc",
        "0xddd",
      ];

      const proof = buildMerkleProof(2, leaves);

      for (const idx of proof.indices) {
        expect(idx === 0 || idx === 1).toBe(true);
      }
    });
  });

  // ----------------------------------------------------------------
  // generateNote
  // ----------------------------------------------------------------

  describe("generateNote", () => {
    it("returns a GhostNote with all required fields and matching denomination", () => {
      const note = generateNote(1); // $10 tier

      expect(note.secret).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(note.blinder).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(note.amount).toBe("10000000");
      expect(note.denomination).toBe(1);
      expect(note.commitment).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(note.batchId).toBe(0);
      expect(note.leafIndex).toBe(0);
      expect(note.claimed).toBe(false);
      expect(typeof note.timestamp).toBe("number");
    });

    it("throws for an invalid denomination", () => {
      expect(() => generateNote(99)).toThrow("Invalid denomination tier: 99");
    });
  });

  // ----------------------------------------------------------------
  // generatePrivateNote
  // ----------------------------------------------------------------

  describe("generatePrivateNote", () => {
    it("returns a GhostNote with zkCommitment and zkNullifier fields", () => {
      const note = generatePrivateNote(2); // $100 tier

      expect(note.denomination).toBe(2);
      expect(note.zkCommitment).toBeDefined();
      expect(note.zkNullifier).toBeDefined();
      // The mock bigintToHex returns "0x" + n.toString(16)
      expect(note.zkCommitment).toBe("0x" + (123456789n).toString(16));
      expect(note.zkNullifier).toBe("0x" + (987654321n).toString(16));
    });
  });

  // ----------------------------------------------------------------
  // loadNotes / saveNote round-trip
  // ----------------------------------------------------------------

  describe("loadNotes / saveNote round-trip", () => {
    it("saves a note then loads it back correctly", async () => {
      const note = generateNote(0); // $1 tier

      // No encryption secret — plaintext path
      await saveNote(note);

      const loaded = loadNotes();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].commitment).toBe(note.commitment);
      expect(loaded[0].secret).toBe(note.secret);
      expect(loaded[0].blinder).toBe(note.blinder);
      expect(loaded[0].amount).toBe(note.amount);
      expect(loaded[0].denomination).toBe(note.denomination);
      expect(loaded[0].claimed).toBe(false);
    });

    it("markNoteClaimed sets claimed to true", async () => {
      const note = generateNote(1);
      await saveNote(note);

      await markNoteClaimed(note.commitment);

      const loaded = loadNotes();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].claimed).toBe(true);
    });
  });
});
