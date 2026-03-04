import { describe, it, expect } from "vitest";
import { computeBtcIdentityHash, isValidBitcoinAddress } from "@/utils/bitcoin";

describe("bitcoin utilities", () => {
  // ----------------------------------------------------------------
  // computeBtcIdentityHash
  // ----------------------------------------------------------------

  describe("computeBtcIdentityHash", () => {
    it("is deterministic — same address produces the same hash", () => {
      const addr = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
      const h1 = computeBtcIdentityHash(addr);
      const h2 = computeBtcIdentityHash(addr);

      expect(h1).toBe(h2);
    });

    it("returns a hex string", () => {
      const h = computeBtcIdentityHash("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
      expect(h).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("different addresses produce different hashes", () => {
      const h1 = computeBtcIdentityHash("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
      const h2 = computeBtcIdentityHash("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");

      expect(h1).not.toBe(h2);
    });

    it("handles long addresses by chunking into felt252-safe parts", () => {
      // Bech32 addresses are > 31 bytes so they exercise the chunk2 path
      const addr = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
      const h = computeBtcIdentityHash(addr);

      expect(h).toMatch(/^0x[0-9a-fA-F]+$/);
      // Non-trivial hash — not just "0x0"
      expect(h).not.toBe("0x0");
    });
  });

  // ----------------------------------------------------------------
  // isValidBitcoinAddress
  // ----------------------------------------------------------------

  describe("isValidBitcoinAddress", () => {
    it("accepts valid P2PKH addresses (starts with 1)", () => {
      expect(isValidBitcoinAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
    });

    it("accepts valid P2SH addresses (starts with 3)", () => {
      expect(isValidBitcoinAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe(true);
    });

    it("accepts valid Bech32 P2WPKH addresses (bc1q, 42 chars)", () => {
      expect(isValidBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBe(true);
    });

    it("accepts valid Bech32m Taproot addresses (bc1p, 62 chars)", () => {
      expect(isValidBitcoinAddress("bc1p5cyxnuxmeuwuvkwfem96lqzszee2457nljwu97za6hxyut0gfxzssp4f3yp")).toBe(true);
    });

    it("rejects empty or undefined input", () => {
      expect(isValidBitcoinAddress("")).toBe(false);
      expect(isValidBitcoinAddress(null as unknown as string)).toBe(false);
      expect(isValidBitcoinAddress(undefined as unknown as string)).toBe(false);
    });

    it("rejects invalid addresses", () => {
      expect(isValidBitcoinAddress("not-a-btc-address")).toBe(false);
      expect(isValidBitcoinAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18")).toBe(false);
      expect(isValidBitcoinAddress("bc1")).toBe(false);
      expect(isValidBitcoinAddress("2N3oefVeg6stiTb5Kh3ozCRPAQ")).toBe(false); // testnet P2SH
    });
  });
});
