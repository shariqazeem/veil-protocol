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

fn hash_pair(left: felt252, right: felt252) -> felt252 {
    PedersenTrait::new(0).update(left).update(right).finalize()
}

fn get_zero_hash(level: u32) -> felt252 {
    let mut current: felt252 = 0;
    let mut i: u32 = 0;
    while i < level {
        current = hash_pair(current, current);
        i += 1;
    };
    current
}

fn build_single_leaf_proof() -> (Array<felt252>, Array<u8>) {
    let tree_depth: u32 = 20;
    let mut path: Array<felt252> = array![];
    let mut indices: Array<u8> = array![];
    let mut i: u32 = 0;
    while i < tree_depth {
        path.append(get_zero_hash(i));
        indices.append(0);
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

fn do_execute_batch(pool_addr: ContractAddress, owner: ContractAddress) {
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);
}

// ========================================
// ZK Privacy Tests
// ========================================

#[test]
fn test_deposit_private_stores_zk_mapping() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    usdc_mock.mint(user, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C01;

    start_cheat_caller_address(pool_addr, user);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    // Verify ZK commitment maps to Pedersen commitment
    assert(pool.get_zk_commitment_mapping(zk_commitment) == commitment, 'ZK mapping wrong');
    assert(pool.is_commitment_valid(commitment), 'Commitment not stored');
    assert(pool.get_leaf_count() == 1, 'Leaf not added');
    assert(pool.get_pending_usdc() == 10_000_000, 'USDC not accumulated');
}

#[test]
fn test_withdraw_private_full_flow() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C02;
    let zk_nullifier: felt252 = 0x40110A;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    // Deposit private
    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    // Execute batch
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    // Build Merkle proof
    let (merkle_path, path_indices) = build_single_leaf_proof();

    // Withdraw private (no secret/blinder in calldata!)
    let mut spy = spy_events();

    pool.withdraw_private(
        1, zk_nullifier, zk_commitment,
        array![zk_commitment, zk_nullifier, 1, recipient_felt],
        merkle_path, path_indices, recipient, 0,
    );

    // Verify withdrawal
    assert(wbtc.balance_of(recipient) == 10_000_000, 'Recipient wrong WBTC');
    assert(pool.is_zk_nullifier_spent(zk_nullifier), 'ZK nullifier not spent');

    // Verify PrivateWithdrawal event
    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::PrivateWithdrawal(
                    ShieldedPool::PrivateWithdrawal {
                        zk_nullifier,
                        recipient,
                        wbtc_amount: 10_000_000,
                        batch_id: 0,
                    },
                ),
            ),
        ],
    );
}

#[test]
#[should_panic(expected: 'Note already spent')]
fn test_zk_double_spend_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C03;
    let zk_nullifier: felt252 = 0x40110B;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (path1, indices1) = build_single_leaf_proof();
    pool.withdraw_private(1, zk_nullifier, zk_commitment, array![zk_commitment, zk_nullifier, 1, recipient_felt], path1, indices1, recipient, 0);

    // Second withdrawal with same ZK nullifier — should panic
    let (path2, indices2) = build_single_leaf_proof();
    pool.withdraw_private(1, zk_nullifier, zk_commitment, array![zk_commitment, zk_nullifier, 1, recipient_felt], path2, indices2, recipient, 0);
}

#[test]
#[should_panic(expected: 'ZK commitment not found')]
fn test_wrong_zk_commitment_rejected() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C04;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    // Use a wrong ZK commitment that was never deposited
    let wrong_zk: felt252 = 0xBAD;
    let (path, indices) = build_single_leaf_proof();
    pool.withdraw_private(1, 0x40110C, wrong_zk, array![wrong_zk, 0x40110C, 1, recipient_felt], path, indices, recipient, 0);
}

#[test]
#[should_panic(expected: 'Withdrawal too early')]
fn test_zk_withdrawal_timing_delay_enforced() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C05;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    do_execute_batch(pool_addr, owner);
    // Do NOT advance time — should fail

    let (path, indices) = build_single_leaf_proof();
    pool.withdraw_private(1, 0x40110D, zk_commitment, array![zk_commitment, 0x40110D, 1, recipient_felt], path, indices, recipient, 0);
}

#[test]
fn test_zk_relayer_fee_calculation() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();
    let relayer = addr('relayer');

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C06;
    let zk_nullifier: felt252 = 0x40110E;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();

    // Withdraw via relayer with 200 bps (2%) fee
    pool.withdraw_private_via_relayer(
        1, zk_nullifier, zk_commitment, array![zk_commitment, zk_nullifier, 1, recipient_felt],
        merkle_path, path_indices, recipient, relayer, 200, 0,
    );

    // Relayer gets 2% of 10_000_000 = 200_000
    assert(wbtc.balance_of(relayer) == 200_000, 'Relayer wrong fee');
    assert(wbtc.balance_of(recipient) == 9_800_000, 'Recipient wrong amount');
    assert(pool.is_zk_nullifier_spent(zk_nullifier), 'ZK nullifier not spent');
}

#[test]
#[should_panic(expected: 'ZK commitment exists')]
fn test_duplicate_zk_commitment_rejected() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    usdc_mock.mint(user, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, 1_000_000_000);
    stop_cheat_caller_address(usdc_addr);

    let c1 = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let c2 = compute_commitment(10_000_000, 0xCCC, 0xDDD);
    let same_zk: felt252 = 0x2CD0;

    start_cheat_caller_address(pool_addr, user);
    pool.deposit_private(c1, 1, 0, same_zk);
    pool.deposit_private(c2, 1, 0, same_zk); // Same ZK commitment — should panic
}

#[test]
fn test_deposit_private_with_btc_identity() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    usdc_mock.mint(user, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C07;
    let btc_identity: felt252 = 0xB7C1;

    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, user);
    pool.deposit_private(commitment, 1, btc_identity, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_btc_identity(commitment) == btc_identity, 'BTC identity not stored');
    assert(pool.get_btc_linked_count() == 1, 'BTC count wrong');
    assert(pool.get_anonymity_set(1) == 1, 'Anon set wrong');

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
#[should_panic(expected: 'Invalid ZK commitment')]
fn test_zero_zk_commitment_rejected() {
    let (pool_addr, usdc_addr, _, _, _) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let user = addr('user');
    usdc_mock.mint(user, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);

    start_cheat_caller_address(pool_addr, user);
    pool.deposit_private(commitment, 1, 0, 0); // Zero ZK commitment — should panic
}

#[test]
fn test_zk_withdrawal_with_btc_intent_creates_escrow() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let commitment = compute_commitment(10_000_000, 0xAAA, 0xBBB);
    let zk_commitment: felt252 = 0x2C08;
    let zk_nullifier: felt252 = 0x40110F;
    let btc_dest: felt252 = 0xB7CD;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    start_cheat_caller_address(usdc_addr, depositor);
    usdc.approve(pool_addr, 10_000_000);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, depositor);
    pool.deposit_private(commitment, 1, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);

    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();
    let mut spy = spy_events();

    pool.withdraw_private(
        1, zk_nullifier, zk_commitment, array![zk_commitment, zk_nullifier, 1, recipient_felt],
        merkle_path, path_indices, recipient, btc_dest,
    );

    // WBTC should be locked in pool (escrowed), NOT sent to recipient
    assert(wbtc.balance_of(recipient) == 0, 'Recipient should get 0');
    assert(wbtc.balance_of(pool_addr) == 10_000_000, 'Pool should hold WBTC');

    // Intent escrow created
    assert(pool.get_intent_count() == 1, 'Intent count wrong');
    let intent = pool.get_intent(0);
    assert(intent.amount == 10_000_000, 'Intent amount wrong');
    assert(intent.btc_address_hash == btc_dest, 'BTC hash wrong');
    assert(intent.recipient == recipient, 'Recipient wrong');
    assert(intent.status == 0, 'Status should be CREATED');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::IntentCreated(
                    ShieldedPool::IntentCreated {
                        intent_id: 0,
                        btc_address_hash: btc_dest,
                        amount: 10_000_000,
                        recipient,
                        timestamp: 100,
                    },
                ),
            ),
        ],
    );
}
