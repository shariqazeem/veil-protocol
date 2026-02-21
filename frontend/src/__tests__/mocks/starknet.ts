/**
 * Starknet mocks for unit/integration tests.
 */
import { vi } from "vitest";

export function createMockProvider(overrides: Record<string, any> = {}) {
  return {
    nodeUrl: "https://mock-rpc.test",
    getBlock: vi.fn().mockResolvedValue({ block_number: 100 }),
    waitForTransaction: vi.fn().mockResolvedValue({ execution_status: "SUCCEEDED" }),
    ...overrides,
  };
}

export function createMockContract(callResults: Record<string, any> = {}) {
  const callFn = vi.fn().mockImplementation(async (method: string, args?: any[]) => {
    if (method in callResults) {
      const result = callResults[method];
      return typeof result === "function" ? result(args) : result;
    }
    return 0n;
  });

  return {
    call: callFn,
    get_pending_usdc: vi.fn().mockResolvedValue(callResults.get_pending_usdc ?? 0n),
    get_batch_count: vi.fn().mockResolvedValue(callResults.get_batch_count ?? 0),
    get_leaf_count: vi.fn().mockResolvedValue(callResults.get_leaf_count ?? 0),
    get_anonymity_set: vi.fn().mockImplementation(async (tier: number) => {
      return callResults[`get_anonymity_set_${tier}`] ?? callResults.get_anonymity_set ?? 0;
    }),
    get_total_volume: vi.fn().mockResolvedValue(callResults.get_total_volume ?? 0n),
    get_total_batches_executed: vi.fn().mockResolvedValue(callResults.get_total_batches_executed ?? 0),
    get_intent_count: vi.fn().mockResolvedValue(callResults.get_intent_count ?? 0n),
    get_intent: vi.fn().mockResolvedValue(callResults.get_intent ?? {}),
    is_oracle: vi.fn().mockResolvedValue(callResults.is_oracle ?? true),
    get_oracle_threshold: vi.fn().mockResolvedValue(callResults.get_oracle_threshold ?? 1),
    get_intent_timeout: vi.fn().mockResolvedValue(callResults.get_intent_timeout ?? 3600n),
    claim_intent: vi.fn().mockResolvedValue({ transaction_hash: "0xMOCK_CLAIM" }),
    confirm_btc_payment: vi.fn().mockResolvedValue({ transaction_hash: "0xMOCK_CONFIRM" }),
    execute_batch: vi.fn().mockResolvedValue({ transaction_hash: "0xMOCK_BATCH" }),
    is_commitment_valid: vi.fn().mockResolvedValue(callResults.is_commitment_valid ?? true),
    get_batch_result: vi.fn().mockResolvedValue(callResults.get_batch_result ?? {
      is_finalized: true,
      total_usdc_in: 100_000_000n,
      total_wbtc_out: 100_000n,
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 120),
    }),
    connect: vi.fn(),
  };
}

export function createMockAccount(overrides: Record<string, any> = {}) {
  return {
    address: "0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5",
    execute: vi.fn().mockResolvedValue({ transaction_hash: "0xMOCK_TX" }),
    ...overrides,
  };
}
