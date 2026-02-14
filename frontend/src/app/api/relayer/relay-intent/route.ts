import { NextRequest, NextResponse } from "next/server";
import { CallData } from "starknet";
import { POOL_ADDRESS, getRelayerAccount, getProvider } from "../shared";

export async function POST(req: NextRequest) {
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
      btc_address_hash,
    } = body;

    if (denomination == null || !zk_nullifier || !zk_commitment || !proof || !merkle_path || !path_indices || !recipient || !btc_address_hash) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const calls = [
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "withdraw_with_btc_intent",
        calldata: CallData.compile({
          denomination,
          zk_nullifier,
          zk_commitment,
          proof,
          merkle_path,
          path_indices,
          recipient,
          btc_address_hash,
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
    console.error("[relayer/relay-intent] Error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
