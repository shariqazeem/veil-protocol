use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
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

fn deploy_shielded_pool(
    usdc: ContractAddress,
    wbtc: ContractAddress,
    owner: ContractAddress,
    router: ContractAddress,
) -> ContractAddress {
    let contract = declare("ShieldedPool").unwrap().contract_class();
    let mut calldata = array![];
    usdc.serialize(ref calldata);
    wbtc.serialize(ref calldata);
    owner.serialize(ref calldata);
    router.serialize(ref calldata);
    let zero_verifier: ContractAddress = 0.try_into().unwrap();
    zero_verifier.serialize(ref calldata);
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
    pool.execute_batch(0, array![]);
    stop_cheat_caller_address(pool_addr);
}

// ========================================
// Tests
// ========================================

#[test]
fn test_full_flow_deposit_execute_withdraw_with_merkle_proof() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');

    // Note: denomination 1 = 1_000_000_000 USDC (1000 USDC with 6 decimals)
    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0x5EC1;
    let blinder: felt252 = 0xB11D;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    // Deposit
    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);

    // Execute Batch
    do_execute_batch(pool_addr, owner);

    // Advance time past MIN_WITHDRAWAL_DELAY (60s)
    start_cheat_block_timestamp_global(100);

    // Build Merkle proof (single leaf at index 0)
    let (merkle_path, path_indices) = build_single_leaf_proof();

    // Withdraw with Merkle proof
    let mut spy = spy_events();

    pool.withdraw(1, secret, blinder, nullifier, merkle_path, path_indices, recipient, 0);

    // Verify
    assert(wbtc.balance_of(recipient) == 1_000_000_000, 'Recipient wrong WBTC');
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool should be empty');
    assert(pool.is_nullifier_spent(nullifier), 'Nullifier not marked');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::Withdrawal(
                    ShieldedPool::Withdrawal {
                        nullifier,
                        recipient,
                        wbtc_amount: 1_000_000_000,
                        batch_id: 0,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_two_users_withdraw_with_merkle_proofs() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user1 = addr('user1');
    let user2 = addr('user2');
    let recip1 = addr('recip1');
    let recip2 = addr('recip2');

    // Both deposit same denomination (1_000_000_000 USDC each)
    let amount: u256 = 1_000_000_000;
    let secret1: felt252 = 0xAAA;
    let blinder1: felt252 = 0xBBB;
    let commitment1 = compute_commitment(amount, secret1, blinder1);

    let secret2: felt252 = 0xCCC;
    let blinder2: felt252 = 0xDDD;
    let commitment2 = compute_commitment(amount, secret2, blinder2);

    usdc_mock.mint(user1, 100_000_000_000);
    usdc_mock.mint(user2, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user1, commitment1, 1, amount);
    do_deposit(pool_addr, usdc_addr, user2, commitment2, 1, amount);

    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    // User 1 withdraws with Merkle proof for leaf index 0
    let nullifier1 = compute_nullifier(secret1);
    let (path1, indices1) = build_two_leaf_proof_for_index(commitment1, commitment2, 0);
    pool.withdraw(1, secret1, blinder1, nullifier1, path1, indices1, recip1, 0);
    assert(wbtc.balance_of(recip1) == 1_000_000_000, 'User1 wrong share');

    // User 2 withdraws with Merkle proof for leaf index 1
    let nullifier2 = compute_nullifier(secret2);
    let (path2, indices2) = build_two_leaf_proof_for_index(commitment1, commitment2, 1);
    pool.withdraw(1, secret2, blinder2, nullifier2, path2, indices2, recip2, 0);
    assert(wbtc.balance_of(recip2) == 1_000_000_000, 'User2 wrong share');

    assert(wbtc.balance_of(pool_addr) == 0, 'Pool not fully drained');
}

#[test]
fn test_withdrawal_with_exchange_rate() {
    // 2:1 rate: 1 USDC -> 2 WBTC
    let usdc_addr = deploy_mock_erc20();
    let wbtc_addr = deploy_mock_erc20();
    let router_addr = deploy_mock_router(2, 1);
    let owner = addr('owner');
    let pool_addr = deploy_shielded_pool(usdc_addr, wbtc_addr, owner, router_addr);

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xFFF;
    let blinder: felt252 = 0xEEE;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(user, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let result = pool.get_batch_result(0);
    assert(result.total_usdc_in == 1_000_000_000, 'Wrong batch USDC');
    assert(result.total_wbtc_out == 2_000_000_000, 'Wrong batch WBTC');

    // Withdraw: share = (1_000_000_000 * 2_000_000_000) / 1_000_000_000 = 2_000_000_000 WBTC
    let (merkle_path, path_indices) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, nullifier, merkle_path, path_indices, recipient, 0);
    assert(wbtc.balance_of(recipient) == 2_000_000_000, 'Wrong WBTC with 2x rate');
}

#[test]
#[should_panic(expected: 'Note already spent')]
fn test_double_withdrawal_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0x123;
    let blinder: felt252 = 0x456;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(user, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (path1, indices1) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, nullifier, path1, indices1, recipient, 0);

    // Second withdrawal — nullifier already spent
    let (path2, indices2) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, nullifier, path2, indices2, recipient, 0);
}

#[test]
#[should_panic(expected: 'Invalid commitment')]
fn test_invalid_preimage_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0x214E;
    let blinder: felt252 = 0xB11D;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    // Wrong secret
    let wrong_secret: felt252 = 0xBAD0;
    let nullifier = compute_nullifier(wrong_secret);
    let (path, indices) = build_single_leaf_proof();
    pool.withdraw(1, wrong_secret, blinder, nullifier, path, indices, recipient, 0);
}

#[test]
#[should_panic(expected: 'Batch not finalized')]
fn test_cannot_withdraw_before_batch_finalized() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xABC;
    let blinder: felt252 = 0xDEF;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(user, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user, commitment, 1, amount);

    let (path, indices) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, nullifier, path, indices, recipient, 0);
}

#[test]
#[should_panic(expected: 'Invalid nullifier')]
fn test_wrong_nullifier_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xABC;
    let blinder: felt252 = 0xDEF;
    let commitment = compute_commitment(amount, secret, blinder);

    usdc_mock.mint(user, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, user, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    // Wrong nullifier (not derived from the correct secret)
    let wrong_nullifier: felt252 = 0xBAD;
    let (path, indices) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, wrong_nullifier, path, indices, recipient, 0);
}

// ========================================
// Relayer Withdrawal Tests
// ========================================

#[test]
fn test_relayer_withdrawal_with_fee() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let relayer = addr('relayer');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xA1B1;
    let blinder: felt252 = 0xA1B2;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();

    // Withdraw via relayer with 200 bps (2%) fee
    pool.withdraw_via_relayer(
        1, secret, blinder, nullifier, merkle_path, path_indices,
        recipient, relayer, 200, 0,
    );

    // Relayer gets 2% of 1_000_000_000 = 20_000_000
    assert(wbtc.balance_of(relayer) == 20_000_000, 'Relayer wrong fee');
    // Recipient gets 1_000_000_000 - 20_000_000 = 980_000_000
    assert(wbtc.balance_of(recipient) == 980_000_000, 'Recipient wrong amount');
    assert(pool.is_nullifier_spent(nullifier), 'Nullifier not spent');
}

#[test]
fn test_relayer_withdrawal_zero_fee() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor2');
    let recipient = addr('recipient2');
    let relayer = addr('relayer2');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xA1B3;
    let blinder: felt252 = 0xA1B4;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();

    // Withdraw via relayer with 0% fee (altruistic relayer)
    pool.withdraw_via_relayer(
        1, secret, blinder, nullifier, merkle_path, path_indices,
        recipient, relayer, 0, 0,
    );

    assert(wbtc.balance_of(relayer) == 0, 'Relayer should get nothing');
    assert(wbtc.balance_of(recipient) == 1_000_000_000, 'Recipient wrong amount');
}

#[test]
#[should_panic(expected: 'Relayer fee too high')]
fn test_excessive_relayer_fee_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor3');
    let recipient = addr('recipient3');
    let relayer = addr('relayer3');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xA1B5;
    let blinder: felt252 = 0xA1B6;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();

    // 600 bps > MAX_RELAYER_FEE_BPS (500) — should fail
    pool.withdraw_via_relayer(
        1, secret, blinder, nullifier, merkle_path, path_indices,
        recipient, relayer, 600, 0,
    );
}

// ========================================
// Time-Delay Enforcement Tests
// ========================================

#[test]
#[should_panic(expected: 'Withdrawal too early')]
fn test_withdrawal_too_early_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor4');
    let recipient = addr('recipient4');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xD1E1;
    let blinder: felt252 = 0xD1E2;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);

    // Do NOT advance time — batch.timestamp = 0, block.timestamp = 0
    // 0 < 0 + 60 → should panic
    let (merkle_path, path_indices) = build_single_leaf_proof();
    pool.withdraw(1, secret, blinder, nullifier, merkle_path, path_indices, recipient, 0);
}

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

// ========================================
// Bitcoin Withdrawal Intent Tests
// ========================================

#[test]
fn test_withdrawal_with_btc_intent_event() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xBB01;
    let blinder: felt252 = 0xBB02;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();
    let btc_dest: felt252 = 0xB7CD;

    let mut spy = spy_events();

    pool.withdraw(1, secret, blinder, nullifier, merkle_path, path_indices, recipient, btc_dest);

    assert(wbtc.balance_of(recipient) == 1_000_000_000, 'Recipient wrong WBTC');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::BitcoinWithdrawalIntent(
                    ShieldedPool::BitcoinWithdrawalIntent {
                        nullifier,
                        btc_recipient_hash: btc_dest,
                        wbtc_amount: 1_000_000_000,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_relayer_withdrawal_with_btc_intent() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let relayer = addr('relayer');

    let amount: u256 = 1_000_000_000;
    let secret: felt252 = 0xCC01;
    let blinder: felt252 = 0xCC02;
    let commitment = compute_commitment(amount, secret, blinder);
    let nullifier = compute_nullifier(secret);

    usdc_mock.mint(depositor, 100_000_000_000);
    wbtc_mock.mint(router_addr, 100_000_000_000);

    do_deposit(pool_addr, usdc_addr, depositor, commitment, 1, amount);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();
    let btc_dest: felt252 = 0xB7CD;

    let mut spy = spy_events();

    // 200 bps (2%) fee: recipient gets 980_000_000
    pool.withdraw_via_relayer(
        1, secret, blinder, nullifier, merkle_path, path_indices,
        recipient, relayer, 200, btc_dest,
    );

    assert(wbtc.balance_of(recipient) == 980_000_000, 'Recipient wrong amount');
    assert(wbtc.balance_of(relayer) == 20_000_000, 'Relayer wrong fee');

    // BTC intent should use recipient_amount (after fee), not full share
    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::BitcoinWithdrawalIntent(
                    ShieldedPool::BitcoinWithdrawalIntent {
                        nullifier,
                        btc_recipient_hash: btc_dest,
                        wbtc_amount: 980_000_000,
                    },
                ),
            ),
        ],
    );
}
