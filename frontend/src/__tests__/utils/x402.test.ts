import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock starknet modules used by x402
vi.mock("starknet", () => ({
  num: {
    toHex: (v: any) => {
      try {
        return "0x" + BigInt(v).toString(16);
      } catch {
        return String(v);
      }
    },
    toBigInt: (v: any) => {
      try {
        return BigInt(v);
      } catch {
        // For non-hex addresses, derive a stable unique bigint from the string
        let h = 0n;
        for (let i = 0; i < String(v).length; i++) {
          h = h * 31n + BigInt(String(v).charCodeAt(i));
        }
        return h;
      }
    },
  },
  hash: {
    getSelectorFromName: (name: string) => "0xselector_" + name,
  },
  CallData: {
    toHex: (data: any) => (Array.isArray(data) ? data.map(String) : []),
  },
}));

vi.mock("x402-starknet", () => ({
  createPaymasterConfig: (network: string) => ({
    endpoint: network === "starknet:mainnet"
      ? "https://paymaster.avnu.fi/v1"
      : "https://sepolia.paymaster.avnu.fi/v1",
  }),
}));

// We can test the exported utility functions through their behavior
// Since createPaymentPayloadDefault and settlePaymentDefault require
// network calls, we test the internal helpers indirectly

describe("x402 utilities", () => {
  describe("module structure", () => {
    it("exports createPaymentPayloadDefault function", async () => {
      const mod = await import("@/utils/x402");
      expect(typeof mod.createPaymentPayloadDefault).toBe("function");
    });

    it("exports settlePaymentDefault function", async () => {
      const mod = await import("@/utils/x402");
      expect(typeof mod.settlePaymentDefault).toBe("function");
    });
  });

  describe("createPaymentPayloadDefault", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("calls paymaster with default fee mode (not sponsored)", async () => {
      const { createPaymentPayloadDefault } = await import("@/utils/x402");

      // Mock fetch to capture the paymaster request
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              type: "invoke",
              typed_data: {
                types: {},
                primaryType: "test",
                domain: {},
                message: { nonce: "0x1", valid_until: "0x999" },
              },
              parameters: {},
              fee: {},
            },
          }),
        ),
      );

      const mockAccount = {
        address: "0x1234",
        signMessage: vi.fn().mockResolvedValue(["0xr", "0xs"]),
      };

      const paymentReqs = {
        asset: "0xSTRK",
        payTo: "0xReceiver",
        amount: "5000000000000000",
        network: "starknet:mainnet" as const,
        scheme: "exact" as const,
        maxAmountRequired: "5000000000000000",
        resource: "https://example.com/api",
        description: "test payment",
        mimeType: "application/json",
        outputSchema: undefined,
        extra: undefined,
      };

      await createPaymentPayloadDefault(mockAccount, paymentReqs, "starknet:mainnet");

      // Verify the paymaster was called with "default" fee mode, not "sponsored"
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, fetchInit] = fetchSpy.mock.calls[0];
      const body = JSON.parse(fetchInit!.body as string);
      expect(body.method).toBe("paymaster_buildTransaction");
      expect(body.params.parameters.fee_mode.mode).toBe("default");
    });

    it("returns a PaymentPayload with correct x402Version", async () => {
      const { createPaymentPayloadDefault } = await import("@/utils/x402");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              type: "invoke",
              typed_data: {
                types: {},
                primaryType: "test",
                domain: {},
                message: { nonce: "0x1", valid_until: "0x999" },
              },
            },
          }),
        ),
      );

      const mockAccount = {
        address: "0x1234",
        signMessage: vi.fn().mockResolvedValue(["0xabc", "0xdef"]),
      };

      const paymentReqs = {
        asset: "0xSTRK",
        payTo: "0xReceiver",
        amount: "1000",
        network: "starknet:mainnet" as const,
        scheme: "exact" as const,
        maxAmountRequired: "1000",
        resource: "https://example.com",
        description: "test",
        mimeType: "application/json",
        outputSchema: undefined,
        extra: undefined,
      };

      const result = await createPaymentPayloadDefault(mockAccount, paymentReqs, "starknet:mainnet");

      expect(result.x402Version).toBe(2);
      expect(result.payload.authorization.from).toBe("0x1234");
    });
  });

  describe("settlePaymentDefault", () => {
    it("rejects when token address does not match", async () => {
      const { settlePaymentDefault } = await import("@/utils/x402");

      const mockProvider = {} as any;

      const payload = {
        x402Version: 2,
        accepted: { asset: "0xTOKEN_A" } as any,
        payload: {
          signature: { r: "0x1", s: "0x2" },
          authorization: {
            from: "0xPayer",
            to: "0xReceiver",
            amount: "1000",
            token: "0xTOKEN_B", // Mismatched!
            nonce: "0x1",
            validUntil: "999",
          },
        },
        typedData: {} as any,
        paymasterEndpoint: "https://paymaster.avnu.fi/v1",
      };

      const requirements = {
        asset: "0xTOKEN_A",
        payTo: "0xReceiver",
        amount: "1000",
        network: "starknet:mainnet" as const,
        scheme: "exact" as const,
        maxAmountRequired: "1000",
        resource: "https://example.com",
        description: "test",
        mimeType: "application/json",
        outputSchema: undefined,
        extra: undefined,
      };

      const result = await settlePaymentDefault(mockProvider, payload, requirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("token_mismatch");
    });
  });
});
