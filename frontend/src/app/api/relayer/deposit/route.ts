import { NextRequest, NextResponse } from "next/server";
import { CallData } from "starknet";
import { POOL_ADDRESS, USDC_ADDRESS, getRelayerAccount, getProvider, rateLimit } from "../shared";

/**
 * Relayer-assisted deposit for autonomous DCA execution.
 * User pre-approves total USDC to the relayer address, then
 * the relayer pulls USDC and calls deposit_private on behalf of the user.
 */
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
      depositor,
      commitment,
      denomination,
      btc_identity_hash,
      zk_commitment,
      usdc_amount,
    } = body;

    if (
      !depositor ||
      !commitment ||
      denomination == null ||
      !zk_commitment ||
      !usdc_amount
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate denomination amount matches a valid tier
    const VALID_AMOUNTS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
    if (!VALID_AMOUNTS.includes(Number(usdc_amount))) {
      return NextResponse.json(
        { success: false, error: "Invalid denomination amount" },
        { status: 400 },
      );
    }

    const relayerAddress = account.address;

    // 1. Pull USDC from user to relayer (user pre-approved relayer)
    // 2. Approve pool to spend from relayer
    // 3. Call deposit_private (pool pulls from relayer)
    const calls = [
      {
        contractAddress: USDC_ADDRESS,
        entrypoint: "transfer_from",
        calldata: CallData.compile({
          sender: depositor,
          recipient: relayerAddress,
          amount: { low: usdc_amount, high: "0" },
        }),
      },
      {
        contractAddress: USDC_ADDRESS,
        entrypoint: "approve",
        calldata: CallData.compile({
          spender: POOL_ADDRESS,
          amount: { low: usdc_amount, high: "0" },
        }),
      },
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "deposit_private",
        calldata: CallData.compile({
          commitment,
          denomination,
          btc_identity_hash: btc_identity_hash ?? "0x0",
          zk_commitment,
        }),
      },
    ];

    const result = await account.execute(calls);
    const provider = getProvider();
    await provider.waitForTransaction(result.transaction_hash);

    return NextResponse.json({
      success: true,
      txHash: result.transaction_hash,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relayer/deposit] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
