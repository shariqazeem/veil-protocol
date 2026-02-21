/**
 * x402 Relay Quote — returns payment requirements for gasless relay.
 *
 * Flat fee: $0.03 USDC (mainnet) or 0.015 STRK (sepolia).
 * This replaces the legacy 2% deduction for users who pay upfront via x402.
 */

import { NextResponse } from "next/server";
import {
  buildUSDCPayment,
  buildSTRKPayment,
  HTTP_HEADERS,
} from "x402-starknet";
import {
  RELAY_FEE_USDC, RELAY_FEE_STRK, NETWORK, X402_RELAY_ENABLED, TREASURY_ADDRESS,
} from "../shared";

const x402Network = NETWORK === "mainnet"
  ? "starknet:mainnet" as const
  : "starknet:sepolia" as const;

export async function GET() {
  if (!X402_RELAY_ENABLED) {
    return NextResponse.json(
      { error: "x402 relay not enabled" },
      { status: 404 },
    );
  }

  const requirements = x402Network === "starknet:mainnet"
    ? buildUSDCPayment({
        network: x402Network,
        amount: RELAY_FEE_USDC,
        payTo: TREASURY_ADDRESS,
      })
    : buildSTRKPayment({
        network: x402Network,
        amount: RELAY_FEE_STRK,
        payTo: TREASURY_ADDRESS,
      });

  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: "/api/relayer/relay",
      description: "Gasless ZK withdrawal relay — flat fee via x402, no percentage deduction",
    },
    accepts: [requirements],
  };

  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

  return new NextResponse(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      [HTTP_HEADERS.PAYMENT_REQUIRED]: encoded,
    },
  });
}
