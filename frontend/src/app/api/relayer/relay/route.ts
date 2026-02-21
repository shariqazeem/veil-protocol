import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, Contract, CallData, type Abi } from "starknet";
import {
  POOL_ADDRESS, FEE_BPS, getRelayerAccount, getProvider, rateLimit,
  X402_RELAY_ENABLED, RELAY_FEE_USDC, RELAY_FEE_STRK, NETWORK, RPC_URL,
  TREASURY_ADDRESS,
} from "../shared";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import {
  verifyPayment,
  settlePayment,
  decodePaymentSignature,
  buildUSDCPayment,
  buildSTRKPayment,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequirements,
} from "x402-starknet";

const x402Network = NETWORK === "mainnet"
  ? "starknet:mainnet" as const
  : "starknet:sepolia" as const;

function getRelayPaymentRequirements(): PaymentRequirements {
  if (x402Network === "starknet:mainnet") {
    return buildUSDCPayment({
      network: x402Network,
      amount: RELAY_FEE_USDC,
      payTo: TREASURY_ADDRESS,
    });
  }
  return buildSTRKPayment({
    network: x402Network,
    amount: RELAY_FEE_STRK,
    payTo: TREASURY_ADDRESS,
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = rateLimit(req.headers.get("x-forwarded-for") ?? "unknown");
  if (rateLimited) return rateLimited;

  try {
    const account = getRelayerAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Relayer not configured" },
        { status: 503 },
      );
    }

    const body = await req.json();
    const {
      denomination,
      zk_nullifier,
      zk_commitment,
      proof,
      merkle_path,
      path_indices,
      recipient,
      btc_recipient_hash,
    } = body;

    if (denomination == null || !zk_nullifier || !zk_commitment || !proof || !merkle_path || !path_indices || !recipient) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const relayerAddress = account.address;

    // Check for x402 payment — if present, relay with zero fee deduction
    const paymentHeader = req.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);
    let feeBps = FEE_BPS; // default: 2% legacy fee
    let paymentReceipt: { settled: boolean; transaction?: string; payer?: string } | null = null;

    if (paymentHeader && X402_RELAY_ENABLED) {
      // Verify and settle x402 payment
      const payload: PaymentPayload = decodePaymentSignature(paymentHeader);
      const requirements = getRelayPaymentRequirements();
      const provider = new RpcProvider({ nodeUrl: RPC_URL });

      const verification = await verifyPayment(provider, payload, requirements);
      if (!verification.isValid) {
        return NextResponse.json(
          { success: false, error: "x402 payment verification failed", reason: verification.invalidReason },
          { status: 402 },
        );
      }

      const settlement = await settlePayment(provider, payload, requirements);
      if (!settlement.success) {
        return NextResponse.json(
          { success: false, error: "x402 payment settlement failed" },
          { status: 402 },
        );
      }

      // Payment verified — relay with zero fee
      feeBps = 0;
      paymentReceipt = {
        settled: true,
        transaction: settlement.transaction,
        payer: verification.payer,
      };
    }

    const calls = [
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "withdraw_private_via_relayer",
        calldata: CallData.compile({
          denomination,
          zk_nullifier,
          zk_commitment,
          proof,
          merkle_path,
          path_indices,
          recipient,
          relayer: relayerAddress,
          fee_bps: { low: feeBps, high: 0 },
          btc_recipient_hash: btc_recipient_hash ?? "0x0",
        }),
      },
    ];

    const result = await account.execute(calls);
    const provider = getProvider();
    await provider.waitForTransaction(result.transaction_hash);

    return NextResponse.json({
      success: true,
      txHash: result.transaction_hash,
      ...(paymentReceipt ? { x402: paymentReceipt } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relayer/relay] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
