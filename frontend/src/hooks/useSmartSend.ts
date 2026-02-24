"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useSendTransaction,
  usePaymasterSendTransaction,
} from "@starknet-react/core";
import type { Call, InvokeFunctionResponse } from "starknet";

// STRK token address on mainnet
const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/**
 * Smart transaction hook that routes through the AVNU paymaster for
 * SNIP-9 compatible wallets (Argent, Braavos) and falls back to regular
 * `useSendTransaction` for Cartridge Controller.
 *
 * Uses paymaster "default" mode — transactions are routed through AVNU
 * for optimized fee estimation. User pays gas in STRK via the paymaster.
 * ("sponsored" mode would be truly gasless but requires an AVNU API key.)
 *
 * If the paymaster fails at runtime, it transparently retries via
 * regular send so nothing breaks.
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

  // Track if paymaster has failed — state so the UI re-renders
  const [paymasterFailed, setPaymasterFailed] = useState(false);

  // Regular send — always available as fallback
  const regular = useSendTransaction({ calls: [] });

  // Paymaster send — "default" mode: user pays gas in STRK via AVNU paymaster.
  // This works without an API key and provides optimized fee routing.
  const paymaster = usePaymasterSendTransaction({
    calls: [],
    options: {
      feeMode: {
        mode: "default",
        gasToken: STRK_ADDRESS,
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
          // Paymaster failed — mark it so we skip on future calls
          // and fall through to regular send
          console.warn(
            "[useSmartSend] Paymaster failed, falling back to regular send:",
            e,
          );
          setPaymasterFailed(true);
        }
      }

      // Fallback: regular transaction (user pays gas directly)
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
