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

fn do_deposit_private(
    pool_addr: ContractAddress,
    usdc_addr: ContractAddress,
    user: ContractAddress,
    commitment: felt252,
    denomination: u8,
    amount: u256,
    zk_commitment: felt252,
) {
    let usdc = IERC20Dispatcher { contract_address: usdc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    start_cheat_caller_address(usdc_addr, user);
    usdc.approve(pool_addr, amount);
    stop_cheat_caller_address(usdc_addr);

    start_cheat_caller_address(pool_addr, user);
    pool.deposit_private(commitment, denomination, 0, zk_commitment);
    stop_cheat_caller_address(pool_addr);
}

fn do_execute_batch(pool_addr: ContractAddress, owner: ContractAddress) {
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    start_cheat_caller_address(pool_addr, owner);
    pool.execute_batch(1, array![]);
    stop_cheat_caller_address(pool_addr);
}

/// Setup a ready-to-withdraw intent scenario.
/// Returns (pool, wbtc IERC20, intent_id=0).
fn setup_intent(
) -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };

    let depositor = addr('depositor');
    let amount: u256 = 10_000_000;
    let commitment = compute_commitment(amount, 0xA1A1, 0xA1A2);
    let zk_commitment: felt252 = 0xFAC1;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    do_deposit_private(pool_addr, usdc_addr, depositor, commitment, 1, amount, zk_commitment);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    let (merkle_path, path_indices) = build_single_leaf_proof();
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    pool.withdraw_with_btc_intent(
        1, 0xABC1, zk_commitment, array![zk_commitment, 0xABC1, 1, recipient_felt],
        merkle_path, path_indices, recipient, 0xBBCC,
    );

    (pool_addr, usdc_addr, wbtc_addr, router_addr, owner)
}

// ========================================
// Intent Escrow Tests
// ========================================

#[test]
fn test_withdraw_with_btc_intent_creates_lock() {
    let (pool_addr, usdc_addr, wbtc_addr, router_addr, owner) = setup();

    let usdc_mock = IMockERC20Dispatcher { contract_address: usdc_addr };
    let wbtc_mock = IMockERC20Dispatcher { contract_address: wbtc_addr };
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let depositor = addr('depositor');
    let recipient = addr('recipient');
    let recipient_felt: felt252 = recipient.into();

    let amount: u256 = 10_000_000;
    let secret: felt252 = 0xE1E1;
    let blinder: felt252 = 0xE1E2;
    let commitment = compute_commitment(amount, secret, blinder);
    let zk_commitment: felt252 = 0xFA01;

    usdc_mock.mint(depositor, 1_000_000_000);
    wbtc_mock.mint(router_addr, 1_000_000_000);

    do_deposit_private(pool_addr, usdc_addr, depositor, commitment, 1, amount, zk_commitment);
    do_execute_batch(pool_addr, owner);
    start_cheat_block_timestamp_global(100);

    let (merkle_path, path_indices) = build_single_leaf_proof();
    let btc_addr_hash: felt252 = 0xB7C1;

    let mut spy = spy_events();

    // Withdraw with BTC intent — WBTC stays in pool
    pool.withdraw_with_btc_intent(
        1, 0xAA01, zk_commitment, array![zk_commitment, 0xAA01, 1, recipient_felt],
        merkle_path, path_indices, recipient, btc_addr_hash,
    );

    // WBTC should still be in the pool (escrowed), NOT sent to recipient
    assert(wbtc.balance_of(recipient) == 0, 'Recipient should get 0');
    assert(wbtc.balance_of(pool_addr) == 10_000_000, 'Pool should hold WBTC');

    // Intent created
    assert(pool.get_intent_count() == 1, 'Intent count wrong');
    let intent = pool.get_intent(0);
    assert(intent.amount == 10_000_000, 'Intent amount wrong');
    assert(intent.btc_address_hash == btc_addr_hash, 'BTC hash wrong');
    assert(intent.recipient == recipient, 'Recipient wrong');
    assert(intent.status == 0, 'Status should be CREATED');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::IntentCreated(
                    ShieldedPool::IntentCreated {
                        intent_id: 0,
                        btc_address_hash: btc_addr_hash,
                        amount: 10_000_000,
                        recipient,
                        timestamp: 100,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_claim_intent_sets_solver() {
    let (pool_addr, _, _, _, _) = setup_intent();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    let solver = addr('solver');

    let mut spy = spy_events();

    start_cheat_caller_address(pool_addr, solver);
    pool.claim_intent(0);
    stop_cheat_caller_address(pool_addr);

    let intent = pool.get_intent(0);
    assert(intent.status == 1, 'Status should be CLAIMED');
    assert(intent.solver == solver, 'Solver wrong');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::IntentClaimed(
                    ShieldedPool::IntentClaimed { intent_id: 0, solver },
                ),
            ),
        ],
    );
}

#[test]
fn test_confirm_and_release_to_solver() {
    let (pool_addr, _, wbtc_addr, _, owner) = setup_intent();
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    let solver = addr('solver');

    // Solver claims
    start_cheat_caller_address(pool_addr, solver);
    pool.claim_intent(0);
    stop_cheat_caller_address(pool_addr);

    let mut spy = spy_events();

    // Oracle (owner is default oracle) confirms — auto-releases
    start_cheat_caller_address(pool_addr, owner);
    pool.confirm_btc_payment(0);
    stop_cheat_caller_address(pool_addr);

    assert(wbtc.balance_of(solver) == 10_000_000, 'Solver should have WBTC');
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool should be empty');

    let intent = pool.get_intent(0);
    assert(intent.status == 2, 'Status should be SETTLED');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::IntentSettled(
                    ShieldedPool::IntentSettled {
                        intent_id: 0,
                        solver,
                        amount: 10_000_000,
                    },
                ),
            ),
        ],
    );
}

#[test]
fn test_expire_intent_refunds_recipient() {
    let (pool_addr, _, wbtc_addr, _, _) = setup_intent();
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };
    let recipient = addr('recipient');

    // Fast forward past timeout (intent created at t=100, timeout=3600)
    start_cheat_block_timestamp_global(100 + 3601);

    let mut spy = spy_events();

    pool.expire_intent(0);

    assert(wbtc.balance_of(recipient) == 10_000_000, 'Recipient should get refund');
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool should be empty');

    let intent = pool.get_intent(0);
    assert(intent.status == 3, 'Status should be EXPIRED');

    spy.assert_emitted(
        @array![
            (
                pool_addr,
                ShieldedPool::Event::IntentExpired(
                    ShieldedPool::IntentExpired {
                        intent_id: 0,
                        refund_recipient: recipient,
                    },
                ),
            ),
        ],
    );
}

#[test]
#[should_panic(expected: 'Intent not claimable')]
fn test_double_claim_rejected() {
    let (pool_addr, _, _, _, _) = setup_intent();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let solver1 = addr('solver1');
    let solver2 = addr('solver2');

    start_cheat_caller_address(pool_addr, solver1);
    pool.claim_intent(0);
    stop_cheat_caller_address(pool_addr);

    // Second claim should fail
    start_cheat_caller_address(pool_addr, solver2);
    pool.claim_intent(0);
}

#[test]
#[should_panic(expected: 'Not an oracle')]
fn test_non_oracle_cannot_confirm() {
    let (pool_addr, _, _, _, _) = setup_intent();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let solver = addr('solver');
    let fake_oracle = addr('fake');

    start_cheat_caller_address(pool_addr, solver);
    pool.claim_intent(0);
    stop_cheat_caller_address(pool_addr);

    start_cheat_caller_address(pool_addr, fake_oracle);
    pool.confirm_btc_payment(0);
}

#[test]
#[should_panic(expected: 'Intent not expired')]
fn test_cannot_expire_before_timeout() {
    let (pool_addr, _, _, _, _) = setup_intent();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    // Intent created at t=100, timeout=3600. Current t=100. Should fail.
    pool.expire_intent(0);
}

#[test]
fn test_oracle_config_update() {
    let (pool_addr, _, _, _, owner) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    assert(pool.get_oracle_threshold() == 1, 'Default threshold wrong');
    assert(pool.is_oracle(owner), 'Owner should be oracle');

    let oracle1 = addr('oracle1');
    let oracle2 = addr('oracle2');

    start_cheat_caller_address(pool_addr, owner);
    pool.set_oracle_config(array![oracle1, oracle2], 2, 7200);
    stop_cheat_caller_address(pool_addr);

    assert(pool.get_oracle_threshold() == 2, 'Threshold not updated');
    assert(pool.get_intent_timeout() == 7200, 'Timeout not updated');
    assert(pool.is_oracle(oracle1), 'Oracle 1 not set');
    assert(pool.is_oracle(oracle2), 'Oracle 2 not set');
}

// ========================================
// Security: Oracle Revocation Tests
// ========================================

#[test]
fn test_oracle_revocation_on_reconfig() {
    let (pool_addr, _, _, _, owner) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    // Owner is default oracle
    assert(pool.is_oracle(owner), 'Owner should be oracle');

    let oracle1 = addr('oracle1');
    let oracle2 = addr('oracle2');

    // Reconfig: replace owner with oracle1 + oracle2
    start_cheat_caller_address(pool_addr, owner);
    pool.set_oracle_config(array![oracle1, oracle2], 2, 7200);
    stop_cheat_caller_address(pool_addr);

    // Owner should no longer be an oracle (revoked)
    assert(!pool.is_oracle(owner), 'Owner should be revoked');
    assert(pool.is_oracle(oracle1), 'Oracle 1 not set');
    assert(pool.is_oracle(oracle2), 'Oracle 2 not set');
}

// ========================================
// Security: Minimum Timeout Enforcement
// ========================================

#[test]
#[should_panic(expected: 'Timeout too short')]
fn test_min_timeout_enforced() {
    let (pool_addr, _, _, _, owner) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let oracle1 = addr('oracle1');

    // Try to set timeout = 0 (should fail, minimum is 600)
    start_cheat_caller_address(pool_addr, owner);
    pool.set_oracle_config(array![oracle1], 1, 0);
}

#[test]
fn test_full_intent_lifecycle() {
    let (pool_addr, _, wbtc_addr, _, owner) = setup_intent();
    let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
    let pool = IShieldedPoolDispatcher { contract_address: pool_addr };

    let solver = addr('solver');
    let recipient = addr('recipient');

    // 1. Intent exists (created in setup_intent)
    assert(pool.get_intent_count() == 1, 'Count wrong');

    // 2. Solver claims
    start_cheat_caller_address(pool_addr, solver);
    pool.claim_intent(0);
    stop_cheat_caller_address(pool_addr);

    // 3. Oracle confirms → auto-releases
    start_cheat_caller_address(pool_addr, owner);
    pool.confirm_btc_payment(0);
    stop_cheat_caller_address(pool_addr);

    // 4. Final state
    let intent = pool.get_intent(0);
    assert(intent.status == 2, 'Should be SETTLED');
    assert(intent.solver == solver, 'Solver wrong');
    assert(wbtc.balance_of(solver) == 10_000_000, 'Solver WBTC wrong');
    assert(wbtc.balance_of(pool_addr) == 0, 'Pool not drained');
    assert(wbtc.balance_of(recipient) == 0, 'Recipient should get 0 WBTC');
}
