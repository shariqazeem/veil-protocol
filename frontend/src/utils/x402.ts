/**
 * Custom x402 utilities that use `default` fee mode instead of `sponsored`.
 *
 * The x402-starknet library hardcodes `{ mode: 'sponsored' }` in both
 * createPaymentPayload() and settlePayment(). Sponsored mode requires an
 * AVNU paymaster API key — without one the paymaster returns
 * "x-paymaster-api-key is invalid".
 *
 * These wrappers inline the paymaster JSON-RPC calls with
 * `{ mode: 'default', gas_token: STRK_ADDRESS }` so the user pays gas in
 * STRK — confirmed working on mainnet.
 */

import { num, hash, CallData, type TypedData } from "starknet";
import {
  createPaymasterConfig,
  verifyPayment,
  type PaymentPayload,
  type PaymentRequirements,
} from "x402-starknet";
import type { RpcProvider, Call } from "starknet";

// STRK token address (same on mainnet & sepolia)
const STRK_ADDRESS =
  "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";

const DEFAULT_FEE_MODE = {
  mode: "default" as const,
  gas_token: STRK_ADDRESS,
};

// ---------------------------------------------------------------------------
// Inlined paymaster helpers (not exported from x402-starknet main entry)
// ---------------------------------------------------------------------------

/** Normalise a hex address (remove leading zeros). */
function formatAddress(address: string): string {
  return num.toHex(num.toBigInt(address));
}

/** Convert a starknet.js Call to paymaster RPC call format. */
function toPaymasterCall(call: Call) {
  return {
    to: formatAddress(call.contractAddress),
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: CallData.toHex(call.calldata ?? []),
  };
}

/** Create a standard ERC-20 transfer call. */
function createTransferCall(
  tokenAddress: string,
  recipient: string,
  amount: string,
): Call {
  return {
    contractAddress: tokenAddress,
    entrypoint: "transfer",
    calldata: [recipient, amount, "0"], // recipient, amount_low, amount_high
  };
}

/** JSON-RPC helper for the AVNU paymaster. */
async function paymasterRpc<T>(
  endpoint: string,
  method: string,
  params: unknown,
): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Paymaster HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as {
    result?: T;
    error?: { message: string; code?: number };
  };

  if (json.error) {
    throw new Error(`Paymaster RPC error: ${json.error.message}`);
  }
  if (json.result === undefined) {
    throw new Error("Paymaster returned no result");
  }
  return json.result;
}

interface BuildTxResult {
  type: string;
  typed_data: TypedData;
  parameters: unknown;
  fee: unknown;
}

interface ExecuteTxResult {
  transaction_hash: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a payment payload using `default` fee mode (user pays gas in STRK).
 *
 * Drop-in replacement for x402-starknet's createPaymentPayload, but avoids
 * the hardcoded `{ mode: 'sponsored' }`.
 *
 * `account` is typed loosely (any object with `address` and `signMessage`)
 * so it works with both starknet.js Account and @starknet-react AccountInterface.
 */
export async function createPaymentPayloadDefault(
  account: { address: string; signMessage(typedData: TypedData): Promise<string[] | { r: bigint; s: bigint }> },
  paymentRequirements: PaymentRequirements,
  network: "starknet:mainnet" | "starknet:sepolia",
): Promise<PaymentPayload> {
  // 1. Build the ERC-20 transfer call
  const transferCall = createTransferCall(
    paymentRequirements.asset,
    paymentRequirements.payTo,
    paymentRequirements.amount,
  );

  // 2. Resolve paymaster endpoint
  const config = createPaymasterConfig(network);
  const endpoint = config.endpoint;

  // 3. Build transaction via paymaster (default mode — user pays gas in STRK)
  const buildResult = await paymasterRpc<BuildTxResult>(
    endpoint,
    "paymaster_buildTransaction",
    {
      transaction: {
        type: "invoke",
        invoke: {
          user_address: formatAddress(account.address),
          calls: [toPaymasterCall(transferCall)],
        },
      },
      parameters: {
        version: "0x1",
        fee_mode: DEFAULT_FEE_MODE,
      },
    },
  );

  if (buildResult.type !== "invoke") {
    throw new Error(`Expected invoke transaction, got ${buildResult.type}`);
  }

  // 4. User signs the typed data (wallet popup)
  const signature = await account.signMessage(buildResult.typed_data);

  // 5. Normalise signature to hex string array
  let signatureArray: string[];
  if (Array.isArray(signature)) {
    signatureArray = signature.map((s) => num.toHex(s));
  } else {
    signatureArray = [num.toHex(signature.r), num.toHex(signature.s)];
  }

  // 6. Extract nonce / validUntil from typed data message
  const message = buildResult.typed_data.message as Record<string, unknown>;

  const nonceValue = message.nonce ?? "0x0";
  const nonce =
    typeof nonceValue === "string" ||
    typeof nonceValue === "number" ||
    typeof nonceValue === "bigint"
      ? String(nonceValue)
      : "0x0";

  const validUntilValue = message.valid_until ?? message.validUntil ?? "0x0";
  const validUntil =
    typeof validUntilValue === "string" && validUntilValue.startsWith("0x")
      ? BigInt(validUntilValue).toString()
      : typeof validUntilValue === "string" ||
          typeof validUntilValue === "number" ||
          typeof validUntilValue === "bigint"
        ? String(validUntilValue)
        : "0x0";

  // 7. Assemble payload
  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: paymentRequirements,
    payload: {
      signature: {
        r: signatureArray[0] ?? "0x0",
        s: signatureArray[1] ?? "0x0",
      },
      authorization: {
        from: account.address,
        to: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
        token: paymentRequirements.asset,
        nonce,
        validUntil,
      },
    },
    typedData: buildResult.typed_data as unknown as undefined,
    paymasterEndpoint: endpoint,
  };

  return payload;
}

/**
 * Settle an x402 payment using `default` fee mode (user pays gas in STRK).
 *
 * Drop-in replacement for x402-starknet's settlePayment, but avoids
 * the hardcoded `{ mode: 'sponsored' }`.
 */
export async function settlePaymentDefault(
  provider: RpcProvider,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<{ success: boolean; transaction?: string; errorReason?: string; payer?: string }> {
  // 1. Verify payment signature first (this works fine as-is)
  const verification = await verifyPayment(provider, payload, paymentRequirements);
  if (!verification.isValid) {
    return {
      success: false,
      errorReason: verification.invalidReason,
      payer: verification.payer,
    };
  }

  try {
    // 2. Resolve paymaster endpoint & typed data
    const paymasterEndpoint = payload.paymasterEndpoint;
    const typedData = payload.typedData as TypedData | undefined;

    if (!paymasterEndpoint) {
      throw new Error("Paymaster endpoint not provided in payload");
    }
    if (!typedData) {
      throw new Error("Typed data not found in payload");
    }

    // 3. Execute transaction via paymaster with DEFAULT mode
    const result = await paymasterRpc<ExecuteTxResult>(
      paymasterEndpoint,
      "paymaster_executeTransaction",
      {
        transaction: {
          type: "invoke",
          invoke: {
            user_address: formatAddress(payload.payload.authorization.from),
            typed_data: typedData,
            signature: [payload.payload.signature.r, payload.payload.signature.s],
          },
        },
        parameters: {
          version: "0x1",
          fee_mode: DEFAULT_FEE_MODE,
        },
      },
    );

    // 4. Wait for on-chain confirmation
    await provider.waitForTransaction(result.transaction_hash, {
      retryInterval: 2000,
      successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
    });

    return {
      success: true,
      transaction: result.transaction_hash,
      payer: verification.payer,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errorReason: `settlement_error: ${msg}`,
      payer: verification.payer,
    };
  }
}
