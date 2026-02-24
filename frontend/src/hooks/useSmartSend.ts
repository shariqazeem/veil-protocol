"use client";

import { useCallback, useRef } from "react";
import {
  useAccount,
  useSendTransaction,
  usePaymasterSendTransaction,
} from "@starknet-react/core";
import type { Call, InvokeFunctionResponse } from "starknet";

/**
 * Smart transaction hook that automatically routes through the AVNU paymaster
 * for SNIP-9 compatible wallets (Argent, Braavos) — making transactions gasless —
 * and falls back to regular `useSendTransaction` for wallets that don't support
 * outside execution (Cartridge Controller).
 *
 * If the paymaster fails at runtime (e.g. AVNU rejects sponsored mode),
 * it transparently retries via the regular send path so nothing breaks.
 *
 * Drop-in replacement for `useSendTransaction`.
 */
export function useSmartSend() {
  const { connector } = useAccount();

  // Determine if the connected wallet supports SNIP-9 (outside execution).
  // Cartridge Controller does NOT support SNIP-9 — it uses its own gas model.
  const connectorId = connector?.id ?? "";
  const supportsPaymaster =
    connectorId !== "controller" && connectorId !== "";

  // Track if paymaster has failed before — skip it on subsequent calls
  const paymasterFailed = useRef(false);

  // Regular send — always available as fallback
  const regular = useSendTransaction({ calls: [] });

  // Paymaster send — sponsored mode (truly gasless, AVNU pays gas)
  const paymaster = usePaymasterSendTransaction({
    calls: [],
    options: {
      feeMode: { mode: "sponsored" },
    },
  });

  const sendAsync = useCallback(
    async (calls: Call[]): Promise<InvokeFunctionResponse> => {
      // Try paymaster for SNIP-9 wallets (Argent/Braavos)
      if (supportsPaymaster && !paymasterFailed.current) {
        try {
          return await paymaster.sendAsync(calls);
        } catch (e) {
          // Paymaster failed — mark it so we skip on future calls
          // and fall through to regular send
          console.warn("[useSmartSend] Paymaster failed, falling back to regular send:", e);
          paymasterFailed.current = true;
        }
      }

      // Fallback: regular transaction (user pays gas)
      return regular.sendAsync(calls);
    },
    [supportsPaymaster, paymaster, regular],
  );

  const isGasless = supportsPaymaster && !paymasterFailed.current;

  return {
    sendAsync,
    isPending: supportsPaymaster ? paymaster.isPending : regular.isPending,
    error: supportsPaymaster ? paymaster.error : regular.error,
    isGasless,
  };
}
