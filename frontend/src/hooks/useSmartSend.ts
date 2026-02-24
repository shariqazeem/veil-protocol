"use client";

import { useCallback } from "react";
import {
  useAccount,
  useSendTransaction,
  usePaymasterSendTransaction,
} from "@starknet-react/core";
import type { Call, InvokeFunctionResponse } from "starknet";
import { RpcProvider, CallData } from "starknet";
import { RPC_URL } from "@/utils/network";

// USDC token address on mainnet (same token users deposit)
const USDC_ADDRESS =
  "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb";

// Minimum USDC balance needed to cover gas via paymaster.
// ZK withdrawal costs ~$0.63, with 3x buffer the max fee is ~$2.
// We require $3 USDC (3_000_000 raw) to be safe.
const MIN_USDC_FOR_GAS = 3_000_000n;

const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function getUsdcBalance(address: string): Promise<bigint> {
  try {
    const result = await provider.callContract({
      contractAddress: USDC_ADDRESS,
      entrypoint: "balance_of",
      calldata: CallData.compile({ account: address }),
    });
    return BigInt(result[0] ?? "0");
  } catch {
    return 0n;
  }
}

/**
 * Smart transaction hook — AVNU paymaster gasless mode.
 *
 * Argent/Braavos: pays gas in USDC via AVNU paymaster when balance
 * is sufficient. If USDC balance is too low, goes straight to STRK
 * gas (no double-popup).
 *
 * Cartridge: always uses regular STRK gas (no SNIP-9 support).
 */
export function useSmartSend() {
  const { connector, address } = useAccount();

  // Cartridge Controller does NOT support SNIP-9 — skip paymaster.
  const connectorId = connector?.id ?? "";
  const supportsPaymaster =
    connectorId !== "controller" && connectorId !== "";

  // Regular send — fallback for Cartridge or insufficient USDC
  const regular = useSendTransaction({ calls: [] });

  // Gasless send — user pays gas in USDC via AVNU paymaster.
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
      if (supportsPaymaster && address) {
        // Check USDC balance first — avoid failed wallet popup
        const usdcBalance = await getUsdcBalance(address);

        if (usdcBalance >= MIN_USDC_FOR_GAS) {
          try {
            return await paymaster.sendAsync(calls);
          } catch (e) {
            // Paymaster failed — fall through to STRK
            console.warn(
              "[useSmartSend] USDC gas failed, using STRK:",
              e instanceof Error ? e.message : e,
            );
          }
        }
      }

      // Regular transaction (user pays gas in STRK)
      return regular.sendAsync(calls);
    },
    [supportsPaymaster, address, paymaster, regular],
  );

  return {
    sendAsync,
    isPending: supportsPaymaster ? paymaster.isPending : regular.isPending,
    error: supportsPaymaster ? paymaster.error : regular.error,
    isGasless: supportsPaymaster,
  };
}
