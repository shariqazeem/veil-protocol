import { NextRequest, NextResponse } from "next/server";
import { Contract, CallData, type Abi } from "starknet";
import { POOL_ADDRESS, FEE_BPS, getRelayerAccount, getProvider } from "../shared";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

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
      btc_recipient_hash,
    } = body;

    if (denomination == null || !zk_nullifier || !zk_commitment || !proof || !merkle_path || !path_indices || !recipient) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const relayerAddress = account.address;

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
          fee_bps: { low: FEE_BPS, high: 0 },
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
