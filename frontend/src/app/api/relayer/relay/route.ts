import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, Contract, CallData, num, type Abi } from "starknet";
import {
  POOL_ADDRESS, FEE_BPS, getRelayerAccount, getProvider, rateLimit,
  X402_RELAY_ENABLED, RELAY_FEE_USDC, RELAY_FEE_STRK, NETWORK, RPC_URL,
  TREASURY_ADDRESS,
} from "../shared";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import {
  verifyPayment,
  decodePaymentSignature,
  buildUSDCPayment,
  buildSTRKPayment,
  HTTP_HEADERS,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
  type PaymentPayload,
  type PaymentRequirements,
} from "x402-starknet";
import { settlePaymentDefault } from "@/utils/x402";

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

/** Get the expected relay fee in atomic units for the current network */
function getExpectedFeeAtomic(): bigint {
  if (x402Network === "starknet:mainnet") {
    return BigInt(Math.round(RELAY_FEE_USDC * 1_000_000)); // USDC 6 decimals
  }
  return BigInt(Math.round(RELAY_FEE_STRK * 1e18)); // STRK 18 decimals
}

/** Get the relay fee token address for the current network */
function getRelayFeeToken(): string {
  if (x402Network === "starknet:mainnet") {
    return USDC_ADDRESSES[x402Network] ?? "";
  }
  return STRK_ADDRESSES[x402Network] ?? "";
}

/**
 * Verify a direct on-chain transfer payment.
 * Checks that the tx transferred at least the required fee to the treasury.
 */
async function verifyDirectPayment(
  provider: RpcProvider,
  txHash: string,
): Promise<{ valid: boolean; payer?: string; error?: string }> {
  try {
    const receipt = await provider.waitForTransaction(txHash, {
      successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
      retryInterval: 2000,
    });

    // Check events for a Transfer to our treasury
    const expectedToken = getRelayFeeToken().toLowerCase();
    const expectedAmount = getExpectedFeeAtomic();
    const treasuryNorm = num.toHex(TREASURY_ADDRESS).toLowerCase();

    // Starknet Transfer event: keys[0]=selector, keys[1]=from, keys[2]=to; data[0..1]=amount(u256)
    const TRANSFER_KEY = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
    let payer = "";

    for (const event of (receipt as any).events ?? []) {
      const fromAddr = event.from_address ?? event.contract_address ?? "";
      if (fromAddr.toLowerCase() !== expectedToken) continue;

      const keys = (event.keys ?? []).map((k: string) => k.toLowerCase());
      if (keys[0] !== TRANSFER_KEY) continue;

      const to = keys[2] ?? "";
      if (to.toLowerCase() !== treasuryNorm) continue;

      const amountLow = BigInt(event.data?.[0] ?? "0");
      if (amountLow >= expectedAmount) {
        payer = keys[1] ?? "";
        return { valid: true, payer };
      }
    }

    return { valid: false, error: "Transfer to treasury not found or amount too low" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Tx verification failed: ${msg}` };
  }
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
      payment_tx, // Direct transfer tx hash (alternative to x402 header)
    } = body;

    if (denomination == null || !zk_nullifier || !zk_commitment || !proof || !merkle_path || !path_indices || !recipient) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const relayerAddress = account.address;

    // Determine fee path: x402 header → direct payment_tx → legacy 2%
    const paymentHeader = req.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);
    let feeBps = FEE_BPS; // default: 2% legacy fee
    let paymentReceipt: { settled: boolean; transaction?: string; payer?: string; method?: string } | null = null;

    if (paymentHeader && X402_RELAY_ENABLED) {
      // Path 1: x402 paymaster flow (header-based, default fee mode)
      const payload: PaymentPayload = decodePaymentSignature(paymentHeader);
      const requirements = getRelayPaymentRequirements();
      const provider = new RpcProvider({ nodeUrl: RPC_URL });

      const settlement = await settlePaymentDefault(provider, payload, requirements);
      if (!settlement.success) {
        return NextResponse.json(
          { success: false, error: "x402 payment settlement failed", reason: settlement.errorReason },
          { status: 402 },
        );
      }

      feeBps = 0;
      paymentReceipt = {
        settled: true,
        transaction: settlement.transaction,
        payer: settlement.payer,
        method: "x402_paymaster",
      };
    } else if (payment_tx && X402_RELAY_ENABLED) {
      // Path 2: Direct on-chain transfer verified by tx hash
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const verification = await verifyDirectPayment(provider, payment_tx);

      if (!verification.valid) {
        return NextResponse.json(
          { success: false, error: verification.error ?? "Payment verification failed" },
          { status: 402 },
        );
      }

      feeBps = 0;
      paymentReceipt = {
        settled: true,
        transaction: payment_tx,
        payer: verification.payer,
        method: "direct_transfer",
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

    // Relayer has sufficient STRK for default fee estimation (~37 STRK).
    // Simply execute — starknet.js will estimate and submit.
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
