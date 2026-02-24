"use client";

import { useCallback } from "react";
import {
  useAccount,
  useSendTransaction,
  usePaymasterSendTransaction,
} from "@starknet-react/core";
import type { Call, InvokeFunctionResponse } from "starknet";

// USDC token address on mainnet (same token users deposit)
const USDC_ADDRESS =
  "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

/**
 * Smart transaction hook — AVNU paymaster gasless mode.
 *
 * Argent/Braavos: tries to pay gas in USDC via AVNU paymaster first.
 * If that fails (e.g. insufficient USDC after a deposit), automatically
 * retries with regular STRK gas. Each call is independent — a withdrawal
 * failing on USDC gas won't break future deposits.
 *
 * Cartridge: always uses regular STRK gas (no SNIP-9 support).
 */
export function useSmartSend() {
  const { connector } = useAccount();

  // Cartridge Controller does NOT support SNIP-9 — skip paymaster.
  const connectorId = connector?.id ?? "";
  const supportsPaymaster =
    connectorId !== "controller" && connectorId !== "";

  // Regular send — fallback for Cartridge or when paymaster fails
  const regular = useSendTransaction({ calls: [] });

  // Gasless send — user pays gas in USDC via AVNU paymaster.
  // "default" mode, no API key needed.
  const paymaster = usePaymasterSendTransaction({
    calls: [],
    options: {
      feeMode: {
        mode: "default",
        gasToken: USDC_ADDRESS,
      },
    },
  });

  const sendAsync = useCallback(
    async (calls: Call[]): Promise<InvokeFunctionResponse> => {
      if (supportsPaymaster) {
        try {
          return await paymaster.sendAsync(calls);
        } catch (e) {
          // Paymaster failed for THIS call (e.g. insufficient USDC).
          // Fall through to regular send — don't disable for future calls.
          console.warn(
            "[useSmartSend] USDC gas failed, retrying with STRK:",
            e instanceof Error ? e.message : e,
          );
        }
      }

      // Fallback: regular transaction (user pays gas in STRK)
      return regular.sendAsync(calls);
    },
    [supportsPaymaster, paymaster, regular],
  );

  return {
    sendAsync,
    isPending: supportsPaymaster ? paymaster.isPending : regular.isPending,
    error: supportsPaymaster ? paymaster.error : regular.error,
    isGasless: supportsPaymaster,
  };
}
