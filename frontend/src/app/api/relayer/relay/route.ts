import { NextRequest, NextResponse } from "next/server";
import { CallData, type Abi } from "starknet";
import {
  POOL_ADDRESS, FEE_BPS, getRelayerAccount, getProvider, rateLimit,
} from "../shared";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";

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

    // Gasless relay: relayer executes the withdrawal and takes 2% fee from the output
    const feeBps = FEE_BPS;

    // Convert all values to strings to avoid BigInt mixing in starknet.js internals
    const compiledCalldata = CallData.compile({
      denomination: String(denomination),
      zk_nullifier,
      zk_commitment,
      proof,
      merkle_path,
      path_indices: path_indices.map(String),
      recipient,
      relayer: relayerAddress,
      fee_bps: { low: String(feeBps), high: "0" },
      btc_recipient_hash: btc_recipient_hash ?? "0x0",
    });

    console.log("[relayer/relay] Compiled calldata length:", compiledCalldata.length, "feeBps:", feeBps);

    const calls = [
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "withdraw_private_via_relayer",
        calldata: compiledCalldata,
      },
    ];

    // Execute with resource bounds capping to avoid "exceeds balance" errors.
    // ZK verification calldata is huge (~2837 felts) so starknet.js overestimates.
    let result;
    try {
      result = await account.execute(calls);
    } catch (execErr) {
      const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
      console.error("[relayer/relay] First execute attempt failed:", errMsg.slice(0, 300));

      // If resource bounds exceed balance, retry with capped bounds
      if (errMsg.includes("Resources bounds") && errMsg.includes("exceed balance")) {
        console.log("[relayer/relay] Retrying with capped resource bounds...");
        const provider = getProvider();

        // Get relayer STRK balance
        const strkToken = "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";
        const balResult = await provider.callContract({
          contractAddress: strkToken,
          entrypoint: "balanceOf",
          calldata: [account.address],
        });
        const balance = BigInt(balResult[0]);
        // Use 90% of balance as budget (leave 10% safety margin)
        const budget = (balance * 90n) / 100n;
        console.log("[relayer/relay] STRK balance:", balance.toString(), "budget:", budget.toString());

        // Estimate fee with skipValidate to get realistic amounts
        const estimate = await account.estimateInvokeFee(calls, { skipValidate: true });
        console.log("[relayer/relay] Estimate:", JSON.stringify({
          l2_max: estimate.resourceBounds.l2_gas.max_amount.toString(),
          l2_price: estimate.resourceBounds.l2_gas.max_price_per_unit.toString(),
          l1_data_max: estimate.resourceBounds.l1_data_gas.max_amount.toString(),
          l1_data_price: estimate.resourceBounds.l1_data_gas.max_price_per_unit.toString(),
        }));

        // Calculate total cost of the estimate
        const l2Amount = BigInt(estimate.resourceBounds.l2_gas.max_amount);
        const l2Price = BigInt(estimate.resourceBounds.l2_gas.max_price_per_unit);
        const l1dAmount = BigInt(estimate.resourceBounds.l1_data_gas.max_amount);
        const l1dPrice = BigInt(estimate.resourceBounds.l1_data_gas.max_price_per_unit);
        const totalCost = l2Amount * l2Price + l1dAmount * l1dPrice;

        let resourceBounds = estimate.resourceBounds;
        if (totalCost > budget) {
          // Scale down proportionally to fit budget
          const scale = Number(budget * 1000n / totalCost) / 1000; // e.g. 0.65
          console.log("[relayer/relay] Scaling bounds by", scale, "to fit budget");
          resourceBounds = {
            l1_gas: estimate.resourceBounds.l1_gas, // keep L1 gas from estimate
            l2_gas: {
              max_amount: BigInt(Math.ceil(Number(l2Amount) * scale)),
              max_price_per_unit: l2Price,
            },
            l1_data_gas: {
              max_amount: l1dAmount, // don't reduce data gas — it's required
              max_price_per_unit: l1dPrice,
            },
          };
        }

        result = await account.execute(calls, { resourceBounds });
      } else {
        throw execErr;
      }
    }
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
