import { describe, it, expect } from "vitest";
import {
  computeZKCommitment,
  computeZKNullifier,
  computeZKCommitmentRaw,
  computeZKNullifierRaw,
  bigintToHex,
} from "@/utils/zkProver";

const STARK_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

describe("zkProver utilities", () => {
  // ----------------------------------------------------------------
  // computeZKCommitment
  // ----------------------------------------------------------------

  describe("computeZKCommitment", () => {
    it("is deterministic — same inputs produce the same commitment", () => {
      const secret = 12345n;
      const blinder = 67890n;
      const denomination = 1n;

      const c1 = computeZKCommitment(secret, blinder, denomination);
      const c2 = computeZKCommitment(secret, blinder, denomination);

      expect(c1).toBe(c2);
    });

    it("different secrets produce different commitments", () => {
      const blinder = 67890n;
      const denomination = 1n;

      const c1 = computeZKCommitment(111n, blinder, denomination);
      const c2 = computeZKCommitment(222n, blinder, denomination);

      expect(c1).not.toBe(c2);
    });

    it("different denominations produce different commitments", () => {
      const secret = 12345n;
      const blinder = 67890n;

      const c1 = computeZKCommitment(secret, blinder, 1n);
      const c2 = computeZKCommitment(secret, blinder, 2n);

      expect(c1).not.toBe(c2);
    });

    it("result is reduced modulo STARK_PRIME (fits in felt252)", () => {
      const commitment = computeZKCommitment(12345n, 67890n, 1n);
      expect(commitment).toBeLessThan(STARK_PRIME);
      expect(commitment).toBeGreaterThanOrEqual(0n);
    });
  });

  // ----------------------------------------------------------------
  // computeZKNullifier
  // ----------------------------------------------------------------

  describe("computeZKNullifier", () => {
    it("is deterministic — same secret produces the same nullifier", () => {
      const n1 = computeZKNullifier(12345n);
      const n2 = computeZKNullifier(12345n);

      expect(n1).toBe(n2);
    });

    it("different secrets produce different nullifiers", () => {
      const n1 = computeZKNullifier(111n);
      const n2 = computeZKNullifier(222n);

      expect(n1).not.toBe(n2);
    });

    it("result is reduced modulo STARK_PRIME (fits in felt252)", () => {
      const nullifier = computeZKNullifier(12345n);
      expect(nullifier).toBeLessThan(STARK_PRIME);
      expect(nullifier).toBeGreaterThanOrEqual(0n);
    });
  });

  // ----------------------------------------------------------------
  // Raw (unreduced) variants
  // ----------------------------------------------------------------

  describe("raw commitment and nullifier", () => {
    it("raw commitment equals reduced commitment when already below STARK_PRIME", () => {
      const secret = 1n;
      const blinder = 2n;
      const denomination = 3n;

      const raw = computeZKCommitmentRaw(secret, blinder, denomination);
      const reduced = computeZKCommitment(secret, blinder, denomination);

      expect(reduced).toBe(raw % STARK_PRIME);
    });

    it("raw nullifier equals reduced nullifier modulo STARK_PRIME", () => {
      const secret = 99999n;

      const raw = computeZKNullifierRaw(secret);
      const reduced = computeZKNullifier(secret);

      expect(reduced).toBe(raw % STARK_PRIME);
    });
  });

  // ----------------------------------------------------------------
  // bigintToHex
  // ----------------------------------------------------------------

  describe("bigintToHex", () => {
    it("converts 0 to 0x0", () => {
      expect(bigintToHex(0n)).toBe("0x0");
    });

    it("converts 255 to 0xff", () => {
      expect(bigintToHex(255n)).toBe("0xff");
    });

    it("converts a large bigint correctly", () => {
      const val = 0xdeadbeefn;
      expect(bigintToHex(val)).toBe("0xdeadbeef");
    });

    it("always starts with 0x prefix", () => {
      expect(bigintToHex(1n)).toMatch(/^0x/);
      expect(bigintToHex(999999n)).toMatch(/^0x/);
    });
  });
});
