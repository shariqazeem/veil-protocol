/** ABI fragments for contract interactions. */

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    name: "balance_of",
    type: "function",
    inputs: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

export const SHIELDED_POOL_ABI = [
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "struct",
    name: "ghost_sats::BatchResult",
    members: [
      { name: "total_usdc_in", type: "core::integer::u256" },
      { name: "total_wbtc_out", type: "core::integer::u256" },
      { name: "timestamp", type: "core::integer::u64" },
      { name: "is_finalized", type: "core::bool" },
    ],
  },
  {
    name: "deposit",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      { name: "denomination", type: "core::integer::u8" },
      { name: "btc_identity_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [
      { name: "denomination", type: "core::integer::u8" },
      { name: "secret", type: "core::felt252" },
      { name: "blinder", type: "core::felt252" },
      { name: "nullifier", type: "core::felt252" },
      { name: "merkle_path", type: "core::array::Array::<core::felt252>" },
      { name: "path_indices", type: "core::array::Array::<core::integer::u8>" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "btc_recipient_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_pending_usdc",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "get_batch_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_current_batch_id",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    name: "get_batch_result",
    type: "function",
    inputs: [
      { name: "batch_id", type: "core::integer::u64" },
    ],
    outputs: [
      { type: "ghost_sats::BatchResult" },
    ],
    state_mutability: "view",
  },
  {
    name: "is_commitment_valid",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "is_nullifier_spent",
    type: "function",
    inputs: [
      { name: "nullifier", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "get_merkle_root",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    name: "get_leaf_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_denomination_amount",
    type: "function",
    inputs: [
      { name: "tier", type: "core::integer::u8" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "get_total_volume",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "get_total_batches_executed",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    name: "get_leaf",
    type: "function",
    inputs: [
      { name: "index", type: "core::integer::u32" },
    ],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    name: "withdraw_via_relayer",
    type: "function",
    inputs: [
      { name: "denomination", type: "core::integer::u8" },
      { name: "secret", type: "core::felt252" },
      { name: "blinder", type: "core::felt252" },
      { name: "nullifier", type: "core::felt252" },
      { name: "merkle_path", type: "core::array::Array::<core::felt252>" },
      { name: "path_indices", type: "core::array::Array::<core::integer::u8>" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "relayer", type: "core::starknet::contract_address::ContractAddress" },
      { name: "fee_bps", type: "core::integer::u256" },
      { name: "btc_recipient_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "get_btc_identity",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
    ],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    name: "get_btc_linked_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_anonymity_set",
    type: "function",
    inputs: [
      { name: "tier", type: "core::integer::u8" },
    ],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    name: "get_withdrawal_delay",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    name: "get_max_relayer_fee_bps",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    name: "register_view_key",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      { name: "view_key_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "deposit_private",
    type: "function",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      { name: "denomination", type: "core::integer::u8" },
      { name: "btc_identity_hash", type: "core::felt252" },
      { name: "zk_commitment", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "withdraw_private",
    type: "function",
    inputs: [
      { name: "denomination", type: "core::integer::u8" },
      { name: "zk_nullifier", type: "core::felt252" },
      { name: "zk_commitment", type: "core::felt252" },
      { name: "proof", type: "core::array::Array::<core::felt252>" },
      { name: "merkle_path", type: "core::array::Array::<core::felt252>" },
      { name: "path_indices", type: "core::array::Array::<core::integer::u8>" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "btc_recipient_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "withdraw_private_via_relayer",
    type: "function",
    inputs: [
      { name: "denomination", type: "core::integer::u8" },
      { name: "zk_nullifier", type: "core::felt252" },
      { name: "zk_commitment", type: "core::felt252" },
      { name: "proof", type: "core::array::Array::<core::felt252>" },
      { name: "merkle_path", type: "core::array::Array::<core::felt252>" },
      { name: "path_indices", type: "core::array::Array::<core::integer::u8>" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
      { name: "relayer", type: "core::starknet::contract_address::ContractAddress" },
      { name: "fee_bps", type: "core::integer::u256" },
      { name: "btc_recipient_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    name: "is_zk_nullifier_spent",
    type: "function",
    inputs: [
      { name: "zk_nullifier", type: "core::felt252" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    name: "get_zk_commitment_mapping",
    type: "function",
    inputs: [
      { name: "zk_commitment", type: "core::felt252" },
    ],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    name: "set_zk_verifier",
    type: "function",
    inputs: [
      { name: "verifier", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [],
    state_mutability: "external",
  },
] as const;

export const AVNU_ROUTER_ABI = [
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    name: "set_rate",
    type: "function",
    inputs: [
      { name: "rate_numerator", type: "core::integer::u256" },
      { name: "rate_denominator", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
] as const;
