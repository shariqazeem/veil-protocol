use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;
use ghost_sats::shielded_pool::{
    IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};

// ========================================
// Helpers
// ========================================

fn addr(val: felt252) -> ContractAddress {
    val.try_into().unwrap()
}

fn compute_commitment(amount: u256, secret: felt252, blinder: felt252) -> felt252 {
    let amount_low: felt252 = amount.low.into();
    let amount_high: felt252 = amount.high.into();
    let amount_hash = PedersenTrait::new(0).update(amount_low).update(amount_high).finalize();
    let secret_hash = PedersenTrait::new(0).update(secret).update(blinder).finalize();
    PedersenTrait::new(0).update(amount_hash).update(secret_hash).finalize()
}

fn compute_nullifier(secret: felt252) -> felt252 {
    PedersenTrait::new(0).update(secret).update(1).finalize()
}

fn hash_pair(left: felt252, right: felt252) -> felt252 {
    PedersenTrait::new(0).update(left).update(right).finalize()
}

/// Compute the zero hash for a given Merkle tree level.
fn get_zero_hash(level: u32) -> felt252 {
    let mut current: felt252 = 0;
    let mut i: u32 = 0;
    while i < level {
        current = hash_pair(current, current);
        i += 1;
    };
    current
}

/// Build a Merkle proof for a single-leaf tree (leaf at index 0, depth 20).
/// All siblings are zero hashes at their respective levels.
fn build_single_leaf_proof() -> (Array<felt252>, Array<u8>) {
    let tree_depth: u32 = 20;
    let mut path: Array<felt252> = array![];
    let mut indices: Array<u8> = array![];
    let mut i: u32 = 0;
    while i < tree_depth {
        path.append(get_zero_hash(i));
        indices.append(0); // leaf is always on the left for index 0
        i += 1;
    };
    (path, indices)
}

/// Build a Merkle proof for a two-leaf tree.
/// For leaf at index 0: sibling at level 0 is leaf1, rest are zero hashes.
/// For leaf at index 1: sibling at level 0 is leaf0, rest are zero hashes.
fn build_two_leaf_proof_for_index(
    leaf0: felt252, leaf1: felt252, target_index: u32,
) -> (Array<felt252>, Array<u8>) {
    let tree_depth: u32 = 20;
    let mut path: Array<felt252> = array![];
    let mut indices: Array<u8> = array![];

    // Level 0: sibling is the other leaf
    if target_index == 0 {
        path.append(leaf1);
        indices.append(0); // target is on the left
    } else {
        path.append(leaf0);
        indices.append(1); // target is on the right
    };

    // Levels 1+: siblings are zero hashes (no other data in tree)
    let mut i: u32 = 1;
    while i < tree_depth {
        path.append(get_zero_hash(i));
        indices.append(0); // parent is always on the left
        i += 1;
    };
    (path, indices)
}

// ========================================
// Deploy Helpers
// ========================================

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata = array![];
    let name: ByteArray = "Test Token";
    name.serialize(ref calldata);
    let symbol: ByteArray = "TST";
    symbol.serialize(ref calldata);
    let decimals: u8 = 0;
    decimals.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_mock_router(rate_num: u256, rate_den: u256) -> ContractAddress {
    let contract = declare("MockAvnuRouter").unwrap().contract_class();
    let mut calldata = array![];
    rate_num.serialize(ref calldata);
    rate_den.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_mock_verifier() -> ContractAddress {
    let contract = declare("MockZkVerifier").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    address
}

fn deploy_shielded_pool(
    usdc: ContractAddress,
    wbtc: ContractAddress,
    owner: ContractAddress,
    router: ContractAddress,
) -> ContractAddress {
    let verifier = deploy_mock_verifier();
    let contract = declare("ShieldedPool").unwrap().contract_class();
    let mut calldata = array![];
    usdc.serialize(ref calldata);
    wbtc.serialize(ref calldata);
    owner.serialize(ref calldata);
    router.serialize(ref calldata);
    verifier.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let usdc = deploy_mock_erc20();
    let wbtc = deploy_mock_erc20();
    let router = deploy_mock_router(1, 1);
    let owner = addr('owner');
    let pool = deploy_shielded_pool(usdc, wbtc, owner, router);
    (pool, usdc, wbtc, router, owner)
}

fn do_deposit(
    pool_addr: ContractAddress,
    usdc_addr: ContractAddress,
    user: ContractAddress,
    commitment: felt252,
    denomination: u8,
    amount: u256,
) {
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, amount);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user);
    pool.deposit(commitment, denomination, 0);
    stop_cheat_caller_address(pool_addr);
}

fn do_execute_batch(pool_addr: ContractAddress, owner: ContractAddress) {
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);
}

// ========================================
// Tests
// ========================================
// Note: Tests for withdraw() and withdraw_via_relayer() have been removed
// because those functions no longer exist on the ShieldedPool contract.
// Only withdraw_private() and withdraw_private_via_relayer() remain.
// See test_zk_privacy.cairo for ZK withdrawal tests.

// ========================================
// Time-Delay & Config View Tests
// ========================================

#[test]
fn test_withdrawal_delay_view() {
    let (pool_addr, _, _, _, _) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    assert(pool.get_withdrawal_delay() == 60, 'Wrong delay');
}

#[test]
fn test_max_relayer_fee_view() {
    let (pool_addr, _, _, _, _) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    assert(pool.get_max_relayer_fee_bps() == 500, 'Wrong max fee');
}
