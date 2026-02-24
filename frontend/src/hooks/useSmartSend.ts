"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useSendTransaction,
  usePaymasterSendTransaction,
} from "@starknet-react/core";
import type { Call, InvokeFunctionResponse } from "starknet";

// USDC token address on mainnet (native USDC — same token users deposit)
const USDC_ADDRESS =
  "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

/**
 * Smart transaction hook that routes through the AVNU paymaster
 * for SNIP-9 compatible wallets (Argent, Braavos).
 *
 * **Gasless mode** — user pays gas in USDC instead of STRK.
 * No API key needed. Users don't need to hold STRK at all.
 *
 * Cartridge Controller doesn't support SNIP-9, so it falls back
 * to regular `useSendTransaction` (gas in STRK).
 *
 * If the paymaster fails at runtime, it transparently retries via
 * regular send so nothing breaks.
 */
export function useSmartSend() {
  const { connector } = useAccount();

  // Cartridge Controller does NOT support SNIP-9 — skip paymaster for it.
  const connectorId = connector?.id ?? "";
  const supportsPaymaster =
    connectorId !== "controller" && connectorId !== "";

  // Track if paymaster has failed — useState so badge updates
  const [paymasterFailed, setPaymasterFailed] = useState(false);

  // Regular send — always available as fallback
  const regular = useSendTransaction({ calls: [] });

  // Gasless send — user pays gas in USDC via AVNU paymaster.
  // "default" mode with USDC gas token. No API key required.
  // Users already hold USDC for deposits — no need to acquire STRK.
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
      // Try paymaster for SNIP-9 wallets (Argent/Braavos)
      if (supportsPaymaster && !paymasterFailed) {
        try {
          return await paymaster.sendAsync(calls);
        } catch (e) {
          // Paymaster failed — fall through to regular send
          console.warn(
            "[useSmartSend] Paymaster failed, falling back to STRK gas:",
            e,
          );
          setPaymasterFailed(true);
        }
      }

      // Fallback: regular transaction (user pays gas in STRK)
      return regular.sendAsync(calls);
    },
    [supportsPaymaster, paymasterFailed, paymaster, regular],
  );

  const usingPaymaster = supportsPaymaster && !paymasterFailed;

  return {
    sendAsync,
    isPending: usingPaymaster ? paymaster.isPending : regular.isPending,
    error: usingPaymaster ? paymaster.error : regular.error,
    isGasless: usingPaymaster,
  };
}
