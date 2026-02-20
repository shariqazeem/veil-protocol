use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, stop_cheat_caller_address,
    spy_events, EventSpyAssertionsTrait,
};
use starknet::ContractAddress;
use core::pedersen::PedersenTrait;
use core::hash::HashStateTrait;
use ghost_sats::shielded_pool::{
    IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait,
    ShieldedPool,
};
use ghost_sats::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
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
    let owner: ContractAddress = addr('owner');
    let pool = deploy_shielded_pool(usdc, wbtc, owner, router);
    (pool, usdc, wbtc, router, owner)
}

// ========================================
// Tests
// ========================================

#[test]
fn test_three_users_deposit_and_batch_execute() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    let user2 = addr('user2');
    let user3 = addr('user3');

    // denomination 1 = 10_000_000 USDC each ($10 USDC with 6 decimals)
    let amount: u256 = 10_000_000;
    let commitment1 = compute_commitment(amount, 0x111, 0xA01);
    let commitment2 = compute_commitment(amount, 0x222, 0xA02);
    let commitment3 = compute_commitment(amount, 0x333, 0xA03);

    // Mint USDC to users
    usdc_mock.mint(user1, 1_000_000_000);
    usdc_mock.mint(user2, 1_000_000_000);
    usdc_mock.mint(user3, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    // User 1: approve + deposit denomination 1 (10_000_000)
    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment1, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // User 2: approve + deposit denomination 1 (10_000_000)
    start_cheat_caller_address(usdc_addr, user2);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user2);
    pool.deposit(commitment2, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // User 3: approve + deposit denomination 1 (10_000_000)
    start_cheat_caller_address(usdc_addr, user3);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user3);
    pool.deposit(commitment3, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // Verify pre-execution state
    assert(pool.get_pending_usdc() == 30_000_000, 'Wrong pending USDC');
    assert(pool.get_batch_count() == 3, 'Wrong batch count');
    assert(pool.get_current_batch_id() == 0, 'Batch ID should be 0');
    assert(pool.get_leaf_count() == 3, 'Wrong leaf count');
    assert(pool.get_total_volume() == 30_000_000, 'Wrong total volume');

    // Commitments are valid
    assert(pool.is_commitment_valid(commitment1), 'Commitment 1 invalid');
    assert(pool.is_commitment_valid(commitment2), 'Commitment 2 invalid');
    assert(pool.is_commitment_valid(commitment3), 'Commitment 3 invalid');

    // Pool holds all USDC
    assert(usdc.balance_of(pool_addr) == 30_000_000, 'Pool should hold 30M USDC');

    // Merkle root should not be zero (tree has leaves)
    let root = pool.get_merkle_root();
    assert(root != 0, 'Root should not be zero');

    // Execute the Dark Engine
    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);

    // Verify post-execution state
    assert(pool.get_pending_usdc() == 0, 'pending_usdc not reset');
    assert(pool.get_batch_count() == 0, 'batch_count not reset');
    assert(pool.get_current_batch_id() == 1, 'batch_id not incremented');
    assert(pool.get_total_batches_executed() == 1, 'Wrong batches executed');

    let result = pool.get_batch_result(0);
    assert(result.total_usdc_in == 30_000_000, 'Wrong USDC in BatchResult');
    assert(result.total_wbtc_out == 30_000_000, 'Wrong WBTC in BatchResult');
    assert(result.is_finalized, 'Batch not finalized');

    assert(usdc.balance_of(pool_addr) == 0, 'Pool should have 0 USDC');
    assert(wbtc.balance_of(pool_addr) == 30_000_000, 'Pool should have 30M WBTC');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::BatchExecuted(
                    ShieldedPool::BatchExecuted {
                        batch_id: 0,
                        total_usdc: 30_000_000,
                        wbtc_received: 30_000_000,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_multiple_batches_sequential() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');

    usdc_mock.mint(user1, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    // Batch 0: deposit 10_000_000 (denomination 1 = $10)
    let commitment_a = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment_a, 1, 0);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);

    let result0 = pool.get_batch_result(0);
    assert(result0.total_usdc_in == 10_000_000, 'Batch 0: wrong USDC');
    assert(result0.total_wbtc_out == 10_000_000, 'Batch 0: wrong WBTC');
    assert(pool.get_current_batch_id() == 1, 'Should be batch 1 now');

    // Batch 1: deposit 100_000_000 (denomination 2 = $100)
    let commitment_b = compute_commitment(100_000_000, 0xCCC, 0xDDD);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment_b, 2, 0);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);

    let result1 = pool.get_batch_result(1);
    assert(result1.total_usdc_in == 100_000_000, 'Batch 1: wrong USDC');
    assert(result1.total_wbtc_out == 100_000_000, 'Batch 1: wrong WBTC');
    assert(pool.get_current_batch_id() == 2, 'Should be batch 2 now');
    assert(pool.get_total_batches_executed() == 2, 'Wrong total batches');
    assert(pool.get_total_volume() == 110_000_000, 'Wrong total volume');
}

#[test]
#[should_panic(expected: 'Only owner can execute')]
fn test_non_owner_cannot_execute_batch() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, _owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    let anyone = addr('anyone');

    usdc_mock.mint(user1, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // Non-owner cannot execute batch (owner-only protection)
    start_cheat_caller_address(pool_addr, anyone);
    pool.execute_batch(1, array![]);
}

#[test]
#[should_panic(expected: 'Batch is empty')]
fn test_cannot_execute_empty_batch() {
    let (pool_addr, _, _, _, owner) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
}

#[test]
#[should_panic(expected: 'Commitment already exists')]
fn test_duplicate_commitment_rejected() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    let commitment = compute_commitment(10_000_000, 0xDEAD, 0xBEEF);

    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment, 1, 0); // 10_000_000 USDC
    pool.deposit(commitment, 1, 0); // Same commitment — should panic
}

#[test]
#[should_panic(expected: 'Invalid denomination tier')]
fn test_invalid_denomination_rejected() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(0xABC, 5, 0); // tier 5 doesn't exist
}

#[test]
fn test_denomination_amounts() {
    let (pool_addr, _, _, _, _) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    assert(pool.get_denomination_amount(0) == 1_000_000, 'Tier 0 wrong');
    assert(pool.get_denomination_amount(1) == 10_000_000, 'Tier 1 wrong');
    assert(pool.get_denomination_amount(2) == 100_000_000, 'Tier 2 wrong');
    assert(pool.get_denomination_amount(3) == 1_000_000_000, 'Tier 3 wrong');
    assert(pool.get_denomination_amount(4) == 0, 'Tier 4 should be 0');
}

#[test]
fn test_merkle_root_updates_on_deposit() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    let root_before = pool.get_merkle_root();

    let commitment1 = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment1, 1, 0);
    stop_cheat_caller_address(pool_addr);

    let root_after_1 = pool.get_merkle_root();
    assert(root_before != root_after_1, 'Root should change');

    let commitment2 = compute_commitment(10_000_000, 0xCCC, 0xDDD);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment2, 1, 0);
    stop_cheat_caller_address(pool_addr);

    let root_after_2 = pool.get_merkle_root();
    assert(root_after_1 != root_after_2, 'Root should change again');
    assert(pool.get_leaf_count() == 2, 'Should have 2 leaves');
}

#[test]
fn test_view_key_registration() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // Register view key (caller must be the depositor)
    let view_key_hash: felt252 = 0xBEEF;
    start_cheat_caller_address(pool_addr, user1);
    pool.register_view_key(commitment, view_key_hash);
    stop_cheat_caller_address(pool_addr);

    // Verify view key
    assert(pool.get_view_key(commitment) == view_key_hash, 'Wrong view key');
}

#[test]
fn test_get_leaf_returns_correct_commitments() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    let c0 = compute_commitment(10_000_000, 0x111, 0xA01);
    let c1 = compute_commitment(10_000_000, 0x222, 0xA02);
    let c2 = compute_commitment(10_000_000, 0x333, 0xA03);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(c0, 1, 0);
    pool.deposit(c1, 1, 0);
    pool.deposit(c2, 1, 0);
    stop_cheat_caller_address(pool_addr);

    // Verify leaves match deposited commitments
    assert(pool.get_leaf(0) == c0, 'Leaf 0 mismatch');
    assert(pool.get_leaf(1) == c1, 'Leaf 1 mismatch');
    assert(pool.get_leaf(2) == c2, 'Leaf 2 mismatch');

    // Unset leaf returns 0
    assert(pool.get_leaf(3) == 0, 'Empty leaf should be 0');
}

#[test]
fn test_anonymity_set_tracking() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    // Initial: all anonymity sets are 0
    assert(pool.get_anonymity_set(0) == 0, 'Tier 0 should be 0');
    assert(pool.get_anonymity_set(1) == 0, 'Tier 1 should be 0');
    assert(pool.get_anonymity_set(2) == 0, 'Tier 2 should be 0');

    // Deposit tier 1 (10_000_000 USDC = $10) twice
    let c1 = compute_commitment(10_000_000, 0x111, 0xA01);
    let c2 = compute_commitment(10_000_000, 0x222, 0xA02);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(c1, 1, 0);
    pool.deposit(c2, 1, 0);
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_anonymity_set(1) == 2, 'Tier 1 should be 2');
    assert(pool.get_anonymity_set(0) == 0, 'Tier 0 still 0');

    // Deposit tier 0 (1_000_000 USDC = $1) once
    let c3 = compute_commitment(1_000_000, 0x333, 0xA03);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(c3, 0, 0);
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_anonymity_set(0) == 1, 'Tier 0 should be 1');
    assert(pool.get_anonymity_set(1) == 2, 'Tier 1 still 2');

    // Deposit tier 2 (100_000_000 USDC = $100) once
    let c4 = compute_commitment(100_000_000, 0x444, 0xA04);
    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(c4, 2, 0);
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_anonymity_set(2) == 1, 'Tier 2 should be 1');
}

// ========================================
// Bitcoin Identity Tests
// ========================================

#[test]
fn test_bitcoin_identity_stored_on_deposit() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let btc_identity: felt252 = 0xB7C1;

    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment, 1, btc_identity);
    stop_cheat_caller_address(pool_addr);

    // Verify BTC identity stored
    assert(pool.get_btc_identity(commitment) == btc_identity, 'BTC identity not stored');
    assert(pool.get_btc_linked_count() == 1, 'BTC linked count wrong');

    // Verify event
    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::BitcoinIdentityLinked(
                    ShieldedPool::BitcoinIdentityLinked {
                        commitment,
                        btc_identity_hash: btc_identity,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_bitcoin_identity_zero_not_stored() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(commitment, 1, 0); // No BTC identity
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_btc_identity(commitment) == 0, 'Should be 0');
    assert(pool.get_btc_linked_count() == 0, 'Count should be 0');
}

#[test]
fn test_btc_linked_count_increments() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    usdc_mock.mint(user1, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user1);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    let c1 = compute_commitment(10_000_000, 0x111, 0xA01);
    let c2 = compute_commitment(10_000_000, 0x222, 0xA02);
    let c3 = compute_commitment(10_000_000, 0x333, 0xA03);

    start_cheat_caller_address(pool_addr, user1);
    pool.deposit(c1, 1, 0xB7C1);  // With BTC
    pool.deposit(c2, 1, 0);       // Without BTC
    pool.deposit(c3, 1, 0xB7C2);  // With BTC
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_btc_linked_count() == 2, 'Should be 2 BTC-linked');
    assert(pool.get_btc_identity(c1) == 0xB7C1, 'c1 identity wrong');
    assert(pool.get_btc_identity(c2) == 0, 'c2 should have no identity');
    assert(pool.get_btc_identity(c3) == 0xB7C2, 'c3 identity wrong');
}
