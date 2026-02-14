/// Veil Protocol — Bitcoin's Privacy Layer on Starknet
///
/// Privacy-preserving batch execution with Pedersen commitments, Merkle proofs,
/// relayer-powered gasless withdrawals, and timing-attack protection.

use starknet::ContractAddress;
use ghost_sats::BatchResult;
use ghost_sats::IntentLock;
use ghost_sats::avnu_interface::Route;

/// Interface for the Garaga-generated ZK verifier contract.
/// The verifier validates Noir UltraKeccakZKHonk proofs on-chain.
#[starknet::interface]
pub trait IZKVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    // ========================================
    // Core Protocol
    // ========================================

    /// Deposit USDC with a Pedersen commitment. Fixed denominations only.
    /// btc_identity_hash: Pedersen hash of the depositor's Bitcoin address (0 if none).
    fn deposit(ref self: TContractState, commitment: felt252, denomination: u8, btc_identity_hash: felt252);

    /// Execute the current batch: swap pooled USDC -> WBTC via Avnu.
    fn execute_batch(ref self: TContractState, min_wbtc_out: u256, routes: Array<Route>);

    /// Withdraw WBTC by proving Merkle membership. Caller pays own gas.
    /// btc_recipient_hash: Pedersen hash of a Bitcoin withdrawal address (0 if none).
    fn withdraw(
        ref self: TContractState,
        denomination: u8,
        secret: felt252,
        blinder: felt252,
        nullifier: felt252,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_recipient_hash: felt252,
    );

    /// Withdraw via relayer — relayer pays gas, takes a fee. Maximum privacy.
    /// The relayer (caller) submits the tx. Recipient gets (share - fee).
    fn withdraw_via_relayer(
        ref self: TContractState,
        denomination: u8,
        secret: felt252,
        blinder: felt252,
        nullifier: felt252,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        relayer: ContractAddress,
        fee_bps: u256,
        btc_recipient_hash: felt252,
    );

    // ========================================
    // ZK-Private Protocol (no secret/blinder in calldata)
    // ========================================

    /// Deposit USDC with both Pedersen commitment and BN254 Poseidon ZK commitment.
    /// The ZK commitment enables withdrawal without revealing secret/blinder.
    fn deposit_private(
        ref self: TContractState,
        commitment: felt252,
        denomination: u8,
        btc_identity_hash: felt252,
        zk_commitment: felt252,
    );

    /// Withdraw WBTC using a ZK proof (secret/blinder NEVER appear in calldata).
    fn withdraw_private(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_recipient_hash: felt252,
    );

    /// ZK-private withdrawal via relayer — maximum privacy, gasless.
    fn withdraw_private_via_relayer(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        relayer: ContractAddress,
        fee_bps: u256,
        btc_recipient_hash: felt252,
    );

    // ========================================
    // Views: Pool State
    // ========================================

    fn is_commitment_valid(self: @TContractState, commitment: felt252) -> bool;
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;
    fn get_pending_usdc(self: @TContractState) -> u256;
    fn get_batch_count(self: @TContractState) -> u32;
    fn get_current_batch_id(self: @TContractState) -> u64;
    fn get_batch_result(self: @TContractState, batch_id: u64) -> BatchResult;
    fn get_merkle_root(self: @TContractState) -> felt252;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
    fn get_leaf_count(self: @TContractState) -> u32;
    fn get_leaf(self: @TContractState, index: u32) -> felt252;
    fn get_denomination_amount(self: @TContractState, tier: u8) -> u256;
    fn get_total_volume(self: @TContractState) -> u256;
    fn get_total_batches_executed(self: @TContractState) -> u64;

    // ========================================
    // Views: Privacy Metrics
    // ========================================

    /// Anonymity set size for a denomination tier (total deposits in that tier).
    fn get_anonymity_set(self: @TContractState, tier: u8) -> u32;

    /// Minimum time (seconds) a deposit must age before withdrawal.
    fn get_withdrawal_delay(self: @TContractState) -> u64;

    /// Maximum relayer fee in basis points.
    fn get_max_relayer_fee_bps(self: @TContractState) -> u256;

    // ========================================
    // Views: Bitcoin Identity
    // ========================================

    /// Get the Bitcoin identity hash linked to a commitment.
    fn get_btc_identity(self: @TContractState, commitment: felt252) -> felt252;

    /// Get total number of Bitcoin-linked deposits.
    fn get_btc_linked_count(self: @TContractState) -> u32;

    // ========================================
    // Views: ZK Privacy
    // ========================================

    /// Check if a ZK nullifier has been spent.
    fn is_zk_nullifier_spent(self: @TContractState, zk_nullifier: felt252) -> bool;

    /// Get the Pedersen commitment linked to a ZK commitment.
    fn get_zk_commitment_mapping(self: @TContractState, zk_commitment: felt252) -> felt252;

    /// Set the ZK verifier contract address (owner only).
    fn set_zk_verifier(ref self: TContractState, verifier: ContractAddress);

    // ========================================
    // Bitcoin Intent Settlement (Optimistic Escrow)
    // ========================================

    /// Withdraw via BTC intent: ZK verify + lock WBTC in escrow (not sent to user).
    /// A solver will send BTC off-chain, oracle confirms, solver gets WBTC.
    fn withdraw_with_btc_intent(
        ref self: TContractState,
        denomination: u8,
        zk_nullifier: felt252,
        zk_commitment: felt252,
        proof: Array<felt252>,
        merkle_path: Array<felt252>,
        path_indices: Array<u8>,
        recipient: ContractAddress,
        btc_address_hash: felt252,
    );

    /// Solver claims an intent — announces they will send BTC.
    fn claim_intent(ref self: TContractState, intent_id: u64);

    /// Oracle confirms BTC payment observed on Bitcoin network.
    /// Auto-releases WBTC to solver when oracle threshold is met.
    fn confirm_btc_payment(ref self: TContractState, intent_id: u64);

    /// Release escrowed WBTC to solver (callable by anyone if threshold met).
    fn release_to_solver(ref self: TContractState, intent_id: u64);

    /// Expire intent and refund WBTC to recipient after timeout.
    fn expire_intent(ref self: TContractState, intent_id: u64);

    /// Configure oracle signers, threshold, and timeout (owner only).
    fn set_oracle_config(
        ref self: TContractState,
        signers: Array<ContractAddress>,
        threshold: u32,
        timeout: u64,
    );

    // ========================================
    // Views: Intent Settlement
    // ========================================

    fn get_intent(self: @TContractState, intent_id: u64) -> IntentLock;
    fn get_intent_count(self: @TContractState) -> u64;
    fn get_oracle_threshold(self: @TContractState) -> u32;
    fn get_intent_timeout(self: @TContractState) -> u64;
    fn is_oracle(self: @TContractState, address: ContractAddress) -> bool;

    /// Protocol version for upgrade tracking.
    fn get_protocol_version(self: @TContractState) -> u32;

    // ========================================
    // Compliance
    // ========================================

    fn register_view_key(ref self: TContractState, commitment: felt252, view_key_hash: felt252);
    fn get_view_key(self: @TContractState, commitment: felt252) -> felt252;
}

#[starknet::contract]
pub mod ShieldedPool {
    use core::pedersen::PedersenTrait;
    use core::hash::HashStateTrait;
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use ghost_sats::BatchResult;
    use ghost_sats::IntentLock;
    use ghost_sats::avnu_interface::{
        IAvnuExchangeDispatcher, IAvnuExchangeDispatcherTrait, Route,
    };
    use super::{IZKVerifierDispatcher, IZKVerifierDispatcherTrait};

    // ========================================
    // Constants
    // ========================================

    const TREE_DEPTH: u32 = 20;
    const ZERO_VALUE: felt252 = 0;

    /// Minimum withdrawal delay: 60 seconds after batch finalization.
    /// Prevents trivial timing-attack: deposit + immediate withdraw = anonymity set of 1.
    const MIN_WITHDRAWAL_DELAY: u64 = 60;

    /// Maximum relayer fee: 500 bps (5%). Protects users from predatory relayers.
    const MAX_RELAYER_FEE_BPS: u256 = 500;

    /// Minimum deposits before batch execution becomes permissionless.
    /// Below this, only owner can execute (prevents griefing with tiny batches).
    const MIN_BATCH_SIZE: u32 = 1;

    // ========================================
    // Storage
    // ========================================

    #[storage]
    struct Storage {
        // ---- Privacy Layer ----
        commitments: Map<felt252, bool>,
        nullifiers: Map<felt252, bool>,
        commitment_to_batch: Map<felt252, u64>,

        // ---- Merkle Tree ----
        merkle_leaves: Map<u32, felt252>,
        merkle_nodes: Map<u32, Map<u32, felt252>>,
        leaf_count: u32,
        merkle_root: felt252,
        /// Historical Merkle roots — prevents proofs breaking when new deposits arrive.
        merkle_root_history: Map<felt252, bool>,

        // ---- Batch Accumulator ----
        pending_usdc: u256,
        batch_count: u32,
        current_batch_id: u64,

        // ---- Batch Results ----
        batch_results: Map<u64, BatchResult>,

        // ---- Protocol Stats ----
        total_volume: u256,
        total_batches_executed: u64,

        // ---- Anonymity Set Tracking ----
        /// Number of deposits per denomination tier (anonymity set size).
        denomination_deposit_count: Map<u8, u32>,

        // ---- Bitcoin Identity ----
        commitment_btc_identity: Map<felt252, felt252>,
        btc_linked_count: u32,

        // ---- Compliance ----
        view_keys: Map<felt252, felt252>,
        /// Tracks who deposited each commitment (for view key access control).
        commitment_depositor: Map<felt252, ContractAddress>,

        // ---- ZK Privacy Layer ----
        /// Maps BN254 Poseidon ZK commitment → Pedersen commitment.
        zk_commitments: Map<felt252, felt252>,
        /// Tracks spent ZK nullifiers (derived from Poseidon BN254).
        zk_nullifiers: Map<felt252, bool>,

        // ---- Bitcoin Intent Settlement ----
        intent_locks: Map<u64, IntentLock>,
        intent_count: u64,
        oracle_signers: Map<ContractAddress, bool>,
        oracle_signer_list: Map<u32, ContractAddress>,
        oracle_signer_count: u32,
        oracle_confirmations: Map<u64, Map<ContractAddress, bool>>,
        oracle_confirmation_count: Map<u64, u32>,
        oracle_threshold: u32,
        intent_timeout: u64,

        // ---- Protocol Config ----
        usdc_token: ContractAddress,
        wbtc_token: ContractAddress,
        avnu_router: ContractAddress,
        zk_verifier: ContractAddress,
        owner: ContractAddress,
    }

    // ========================================
    // Events
    // ========================================

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DepositCommitted: DepositCommitted,
        BatchExecuted: BatchExecuted,
        Withdrawal: Withdrawal,
        PrivateWithdrawal: PrivateWithdrawal,
        MerkleRootUpdated: MerkleRootUpdated,
        ViewKeyRegistered: ViewKeyRegistered,
        BitcoinIdentityLinked: BitcoinIdentityLinked,
        BitcoinWithdrawalIntent: BitcoinWithdrawalIntent,
        IntentCreated: IntentCreated,
        IntentClaimed: IntentClaimed,
        IntentConfirmed: IntentConfirmed,
        IntentSettled: IntentSettled,
        IntentExpired: IntentExpired,
        OracleConfigUpdated: OracleConfigUpdated,
        ZkVerifierUpdated: ZkVerifierUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DepositCommitted {
        #[key]
        pub commitment: felt252,
        pub batch_id: u64,
        pub leaf_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BatchExecuted {
        #[key]
        pub batch_id: u64,
        pub total_usdc: u256,
        pub wbtc_received: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawal {
        #[key]
        pub nullifier: felt252,
        pub recipient: ContractAddress,
        pub wbtc_amount: u256,
        pub batch_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrivateWithdrawal {
        #[key]
        pub zk_nullifier: felt252,
        pub recipient: ContractAddress,
        pub wbtc_amount: u256,
        pub batch_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MerkleRootUpdated {
        pub new_root: felt252,
        pub leaf_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ViewKeyRegistered {
        #[key]
        pub commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BitcoinIdentityLinked {
        #[key]
        pub commitment: felt252,
        pub btc_identity_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BitcoinWithdrawalIntent {
        #[key]
        pub nullifier: felt252,
        pub btc_recipient_hash: felt252,
        pub wbtc_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IntentCreated {
        #[key]
        pub intent_id: u64,
        pub btc_address_hash: felt252,
        pub amount: u256,
        pub recipient: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IntentClaimed {
        #[key]
        pub intent_id: u64,
        pub solver: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IntentConfirmed {
        #[key]
        pub intent_id: u64,
        pub oracle: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IntentSettled {
        #[key]
        pub intent_id: u64,
        pub solver: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IntentExpired {
        #[key]
        pub intent_id: u64,
        pub refund_recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OracleConfigUpdated {
        pub threshold: u32,
        pub signer_count: u32,
        pub timeout: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ZkVerifierUpdated {
        pub old_verifier: ContractAddress,
        pub new_verifier: ContractAddress,
    }

    // ========================================
    // Constructor
    // ========================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        usdc_token: ContractAddress,
        wbtc_token: ContractAddress,
        owner: ContractAddress,
        avnu_router: ContractAddress,
        zk_verifier: ContractAddress,
    ) {
        // Validate non-zero addresses for critical config
        let zero_addr: ContractAddress = 0.try_into().unwrap();
        assert(usdc_token != zero_addr, 'USDC cannot be zero');
        assert(wbtc_token != zero_addr, 'WBTC cannot be zero');
        assert(owner != zero_addr, 'Owner cannot be zero');
        assert(avnu_router != zero_addr, 'Router cannot be zero');

        self.usdc_token.write(usdc_token);
        self.wbtc_token.write(wbtc_token);
        self.owner.write(owner);
        self.avnu_router.write(avnu_router);
        self.zk_verifier.write(zk_verifier);

        // Default intent settlement config: 1-of-1 oracle, 1hr timeout
        self.oracle_threshold.write(1);
        self.intent_timeout.write(3600);
        // Owner is default oracle signer
        self.oracle_signers.entry(owner).write(true);
        self.oracle_signer_list.entry(0).write(owner);
        self.oracle_signer_count.write(1);

        let empty_root = InternalImpl::compute_empty_root();
        self.merkle_root.write(empty_root);
        self.merkle_root_history.entry(empty_root).write(true);
    }

    // ========================================
    // External: The Dark Engine
    // ========================================

    #[abi(embed_v0)]
    impl ShieldedPoolImpl of super::IShieldedPool<ContractState> {
        fn deposit(ref self: ContractState, commitment: felt252, denomination: u8, btc_identity_hash: felt252) {
            let amount = InternalImpl::denomination_to_amount(denomination);
            assert(amount > 0, 'Invalid denomination tier');
            assert(!self.commitments.entry(commitment).read(), 'Commitment already exists');
            assert(self.leaf_count.read() < 1048576, 'Merkle tree full');

            // Transfer USDC into pool
            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let caller = get_caller_address();
            let pool = get_contract_address();
            let success = usdc.transfer_from(caller, pool, amount);
            assert(success, 'USDC transfer failed');

            // Store commitment
            self.commitments.entry(commitment).write(true);
            self.commitment_to_batch.entry(commitment).write(self.current_batch_id.read());

            // Insert into Merkle tree
            let leaf_index = self.leaf_count.read();
            self.merkle_leaves.entry(leaf_index).write(commitment);
            self.leaf_count.write(leaf_index + 1);

            let new_root = InternalImpl::update_merkle_root(ref self, leaf_index, commitment);
            self.merkle_root.write(new_root);
            self.merkle_root_history.entry(new_root).write(true);

            // Accumulate into batch
            self.pending_usdc.write(self.pending_usdc.read() + amount);
            self.batch_count.write(self.batch_count.read() + 1);

            // Update stats
            self.total_volume.write(self.total_volume.read() + amount);

            // Update anonymity set counter
            let prev_count = self.denomination_deposit_count.entry(denomination).read();
            self.denomination_deposit_count.entry(denomination).write(prev_count + 1);

            // Store Bitcoin identity link (if provided)
            if btc_identity_hash != 0 {
                self.commitment_btc_identity.entry(commitment).write(btc_identity_hash);
                self.btc_linked_count.write(self.btc_linked_count.read() + 1);
                self.emit(BitcoinIdentityLinked { commitment, btc_identity_hash });
            }

            // Track depositor for access control (view keys)
            self.commitment_depositor.entry(commitment).write(get_caller_address());

            // Emit
            self.emit(DepositCommitted {
                commitment,
                batch_id: self.current_batch_id.read(),
                leaf_index,
            });
            self.emit(MerkleRootUpdated {
                new_root,
                leaf_count: leaf_index + 1,
            });
        }

        fn execute_batch(ref self: ContractState, min_wbtc_out: u256, routes: Array<Route>) {
            let pending = self.pending_usdc.read();
            assert(pending > 0, 'Batch is empty');

            // Owner-only: prevents sandwich attacks with attacker-controlled routes
            assert(get_caller_address() == self.owner.read(), 'Only owner can execute');

            let pool = get_contract_address();
            let usdc_addr = self.usdc_token.read();
            let wbtc_addr = self.wbtc_token.read();
            let router_address = self.avnu_router.read();

            let usdc = IERC20Dispatcher { contract_address: usdc_addr };
            usdc.approve(router_address, pending);

            let wbtc = IERC20Dispatcher { contract_address: wbtc_addr };
            let wbtc_before = wbtc.balance_of(pool);

            let avnu = IAvnuExchangeDispatcher { contract_address: router_address };
            let zero_addr: ContractAddress = 0.try_into().unwrap();
            let success = avnu.multi_route_swap(
                usdc_addr, pending, wbtc_addr, 0, min_wbtc_out,
                pool, 0, zero_addr, routes,
            );
            assert(success, 'Avnu swap failed');

            let wbtc_after = wbtc.balance_of(pool);
            let wbtc_received = wbtc_after - wbtc_before;

            let current_batch = self.current_batch_id.read();
            let result = BatchResult {
                total_usdc_in: pending,
                total_wbtc_out: wbtc_received,
                timestamp: get_block_timestamp(),
                is_finalized: true,
            };
            self.batch_results.entry(current_batch).write(result);

            self.pending_usdc.write(0);
            self.batch_count.write(0);
            self.current_batch_id.write(current_batch + 1);
            self.total_batches_executed.write(self.total_batches_executed.read() + 1);

            self.emit(BatchExecuted {
                batch_id: current_batch,
                total_usdc: pending,
                wbtc_received,
            });
        }

        fn withdraw(
            ref self: ContractState,
            denomination: u8,
            secret: felt252,
            blinder: felt252,
            nullifier: felt252,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
            recipient: ContractAddress,
            btc_recipient_hash: felt252,
        ) {
            let (user_share, batch_id) = InternalImpl::verify_and_nullify(
                ref self, denomination, secret, blinder, nullifier, merkle_path, path_indices,
            );

            if btc_recipient_hash != 0 {
                // Bitcoin bridge: lock WBTC in intent escrow (stays in pool)
                InternalImpl::create_intent(ref self, user_share, btc_recipient_hash, recipient);
            } else {
                // Starknet withdrawal: transfer WBTC directly to recipient
                let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
                let success = wbtc.transfer(recipient, user_share);
                assert(success, 'WBTC transfer failed');
                self.emit(Withdrawal { nullifier, recipient, wbtc_amount: user_share, batch_id });
            }
        }

        fn withdraw_via_relayer(
            ref self: ContractState,
            denomination: u8,
            secret: felt252,
            blinder: felt252,
            nullifier: felt252,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
            recipient: ContractAddress,
            relayer: ContractAddress,
            fee_bps: u256,
            btc_recipient_hash: felt252,
        ) {
            // Validate relayer fee isn't predatory
            assert(fee_bps <= MAX_RELAYER_FEE_BPS, 'Relayer fee too high');

            let (user_share, batch_id) = InternalImpl::verify_and_nullify(
                ref self, denomination, secret, blinder, nullifier, merkle_path, path_indices,
            );

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };

            // Calculate and send relayer fee
            let relayer_fee = (user_share * fee_bps) / 10000;
            let recipient_amount = user_share - relayer_fee;

            // Pay relayer fee regardless of bridge mode
            if relayer_fee > 0 {
                let fee_success = wbtc.transfer(relayer, relayer_fee);
                assert(fee_success, 'Relayer fee transfer failed');
            }

            if btc_recipient_hash != 0 {
                // Bitcoin bridge: lock remainder in intent escrow
                InternalImpl::create_intent(ref self, recipient_amount, btc_recipient_hash, recipient);
            } else {
                // Starknet withdrawal: transfer remainder to recipient
                let success = wbtc.transfer(recipient, recipient_amount);
                assert(success, 'WBTC transfer failed');
                self.emit(Withdrawal {
                    nullifier, recipient, wbtc_amount: recipient_amount, batch_id,
                });
            }
        }

        // ========================================
        // ZK-Private Protocol
        // ========================================

        fn deposit_private(
            ref self: ContractState,
            commitment: felt252,
            denomination: u8,
            btc_identity_hash: felt252,
            zk_commitment: felt252,
        ) {
            let amount = InternalImpl::denomination_to_amount(denomination);
            assert(amount > 0, 'Invalid denomination tier');
            assert(!self.commitments.entry(commitment).read(), 'Commitment already exists');
            assert(self.leaf_count.read() < 1048576, 'Merkle tree full');
            assert(zk_commitment != 0, 'Invalid ZK commitment');
            assert(self.zk_commitments.entry(zk_commitment).read() == 0, 'ZK commitment exists');

            // Transfer USDC into pool
            let usdc = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let caller = get_caller_address();
            let pool = get_contract_address();
            let success = usdc.transfer_from(caller, pool, amount);
            assert(success, 'USDC transfer failed');

            // Store commitment
            self.commitments.entry(commitment).write(true);
            self.commitment_to_batch.entry(commitment).write(self.current_batch_id.read());

            // Store ZK commitment mapping: zk_commitment -> pedersen commitment
            self.zk_commitments.entry(zk_commitment).write(commitment);

            // Insert into Merkle tree
            let leaf_index = self.leaf_count.read();
            self.merkle_leaves.entry(leaf_index).write(commitment);
            self.leaf_count.write(leaf_index + 1);

            let new_root = InternalImpl::update_merkle_root(ref self, leaf_index, commitment);
            self.merkle_root.write(new_root);
            self.merkle_root_history.entry(new_root).write(true);

            // Accumulate into batch
            self.pending_usdc.write(self.pending_usdc.read() + amount);
            self.batch_count.write(self.batch_count.read() + 1);

            // Update stats
            self.total_volume.write(self.total_volume.read() + amount);

            // Update anonymity set counter
            let prev_count = self.denomination_deposit_count.entry(denomination).read();
            self.denomination_deposit_count.entry(denomination).write(prev_count + 1);

            // Store Bitcoin identity link (if provided)
            if btc_identity_hash != 0 {
                self.commitment_btc_identity.entry(commitment).write(btc_identity_hash);
                self.btc_linked_count.write(self.btc_linked_count.read() + 1);
                self.emit(BitcoinIdentityLinked { commitment, btc_identity_hash });
            }

            // Track depositor for access control (view keys)
            self.commitment_depositor.entry(commitment).write(get_caller_address());

            // Emit
            self.emit(DepositCommitted {
                commitment,
                batch_id: self.current_batch_id.read(),
                leaf_index,
            });
            self.emit(MerkleRootUpdated {
                new_root,
                leaf_count: leaf_index + 1,
            });
        }

        fn withdraw_private(
            ref self: ContractState,
            denomination: u8,
            zk_nullifier: felt252,
            zk_commitment: felt252,
            proof: Array<felt252>,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
            recipient: ContractAddress,
            btc_recipient_hash: felt252,
        ) {
            let (user_share, batch_id) = InternalImpl::verify_zk_and_nullify(
                ref self, denomination, zk_nullifier, zk_commitment, proof, merkle_path, path_indices,
            );

            if btc_recipient_hash != 0 {
                // Bitcoin bridge: lock WBTC in intent escrow
                InternalImpl::create_intent(ref self, user_share, btc_recipient_hash, recipient);
            } else {
                // Starknet withdrawal: transfer WBTC directly to recipient
                let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
                let success = wbtc.transfer(recipient, user_share);
                assert(success, 'WBTC transfer failed');
                self.emit(PrivateWithdrawal { zk_nullifier, recipient, wbtc_amount: user_share, batch_id });
            }
        }

        fn withdraw_private_via_relayer(
            ref self: ContractState,
            denomination: u8,
            zk_nullifier: felt252,
            zk_commitment: felt252,
            proof: Array<felt252>,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
            recipient: ContractAddress,
            relayer: ContractAddress,
            fee_bps: u256,
            btc_recipient_hash: felt252,
        ) {
            assert(fee_bps <= MAX_RELAYER_FEE_BPS, 'Relayer fee too high');

            let (user_share, batch_id) = InternalImpl::verify_zk_and_nullify(
                ref self, denomination, zk_nullifier, zk_commitment, proof, merkle_path, path_indices,
            );

            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };

            // Calculate and send relayer fee
            let relayer_fee = (user_share * fee_bps) / 10000;
            let recipient_amount = user_share - relayer_fee;

            // Pay relayer fee regardless of bridge mode
            if relayer_fee > 0 {
                let fee_success = wbtc.transfer(relayer, relayer_fee);
                assert(fee_success, 'Relayer fee transfer failed');
            }

            if btc_recipient_hash != 0 {
                // Bitcoin bridge: lock remainder in intent escrow
                InternalImpl::create_intent(ref self, recipient_amount, btc_recipient_hash, recipient);
            } else {
                // Starknet withdrawal: transfer remainder to recipient
                let success = wbtc.transfer(recipient, recipient_amount);
                assert(success, 'WBTC transfer failed');
                self.emit(PrivateWithdrawal {
                    zk_nullifier, recipient, wbtc_amount: recipient_amount, batch_id,
                });
            }
        }

        // ========================================
        // Views
        // ========================================

        fn is_commitment_valid(self: @ContractState, commitment: felt252) -> bool {
            self.commitments.entry(commitment).read()
        }

        fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers.entry(nullifier).read()
        }

        fn get_pending_usdc(self: @ContractState) -> u256 {
            self.pending_usdc.read()
        }

        fn get_batch_count(self: @ContractState) -> u32 {
            self.batch_count.read()
        }

        fn get_current_batch_id(self: @ContractState) -> u64 {
            self.current_batch_id.read()
        }

        fn get_batch_result(self: @ContractState, batch_id: u64) -> BatchResult {
            self.batch_results.entry(batch_id).read()
        }

        fn get_merkle_root(self: @ContractState) -> felt252 {
            self.merkle_root.read()
        }

        fn is_known_root(self: @ContractState, root: felt252) -> bool {
            self.merkle_root_history.entry(root).read()
        }

        fn get_leaf_count(self: @ContractState) -> u32 {
            self.leaf_count.read()
        }

        fn get_leaf(self: @ContractState, index: u32) -> felt252 {
            self.merkle_leaves.entry(index).read()
        }

        fn get_denomination_amount(self: @ContractState, tier: u8) -> u256 {
            InternalImpl::denomination_to_amount(tier)
        }

        fn get_total_volume(self: @ContractState) -> u256 {
            self.total_volume.read()
        }

        fn get_total_batches_executed(self: @ContractState) -> u64 {
            self.total_batches_executed.read()
        }

        fn get_anonymity_set(self: @ContractState, tier: u8) -> u32 {
            self.denomination_deposit_count.entry(tier).read()
        }

        fn get_withdrawal_delay(self: @ContractState) -> u64 {
            MIN_WITHDRAWAL_DELAY
        }

        fn get_max_relayer_fee_bps(self: @ContractState) -> u256 {
            MAX_RELAYER_FEE_BPS
        }

        fn get_btc_identity(self: @ContractState, commitment: felt252) -> felt252 {
            self.commitment_btc_identity.entry(commitment).read()
        }

        fn get_btc_linked_count(self: @ContractState) -> u32 {
            self.btc_linked_count.read()
        }

        fn is_zk_nullifier_spent(self: @ContractState, zk_nullifier: felt252) -> bool {
            self.zk_nullifiers.entry(zk_nullifier).read()
        }

        fn get_zk_commitment_mapping(self: @ContractState, zk_commitment: felt252) -> felt252 {
            self.zk_commitments.entry(zk_commitment).read()
        }

        fn set_zk_verifier(ref self: ContractState, verifier: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            let old_verifier = self.zk_verifier.read();
            self.zk_verifier.write(verifier);
            self.emit(ZkVerifierUpdated { old_verifier, new_verifier: verifier });
        }

        fn register_view_key(ref self: ContractState, commitment: felt252, view_key_hash: felt252) {
            assert(self.commitments.entry(commitment).read(), 'Commitment not found');
            assert(view_key_hash != 0, 'Invalid view key');
            // Only the original depositor (or owner) can register a view key
            let caller = get_caller_address();
            let depositor = self.commitment_depositor.entry(commitment).read();
            let zero_addr: ContractAddress = 0.try_into().unwrap();
            assert(
                caller == depositor || caller == self.owner.read() || depositor == zero_addr,
                'Not authorized',
            );
            self.view_keys.entry(commitment).write(view_key_hash);
            self.emit(ViewKeyRegistered { commitment });
        }

        fn get_view_key(self: @ContractState, commitment: felt252) -> felt252 {
            self.view_keys.entry(commitment).read()
        }

        // ========================================
        // Bitcoin Intent Settlement
        // ========================================

        fn withdraw_with_btc_intent(
            ref self: ContractState,
            denomination: u8,
            zk_nullifier: felt252,
            zk_commitment: felt252,
            proof: Array<felt252>,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
            recipient: ContractAddress,
            btc_address_hash: felt252,
        ) {
            assert(btc_address_hash != 0, 'BTC address required');

            // ZK verify + nullify (same as withdraw_private, but don't transfer WBTC)
            let (user_share, _batch_id) = InternalImpl::verify_zk_and_nullify(
                ref self, denomination, zk_nullifier, zk_commitment, proof, merkle_path, path_indices,
            );

            // Lock WBTC in intent escrow (stays in pool contract)
            InternalImpl::create_intent(ref self, user_share, btc_address_hash, recipient);
        }

        fn claim_intent(ref self: ContractState, intent_id: u64) {
            let mut lock = self.intent_locks.entry(intent_id).read();
            assert(lock.status == 0, 'Intent not claimable');

            let solver = get_caller_address();
            lock.solver = solver;
            lock.status = 1; // CLAIMED
            self.intent_locks.entry(intent_id).write(lock);

            self.emit(IntentClaimed { intent_id, solver });
        }

        fn confirm_btc_payment(ref self: ContractState, intent_id: u64) {
            let oracle = get_caller_address();
            assert(self.oracle_signers.entry(oracle).read(), 'Not an oracle');

            let lock = self.intent_locks.entry(intent_id).read();
            assert(lock.status == 1, 'Intent not claimed');

            // Record oracle confirmation (idempotent per oracle)
            assert(
                !self.oracle_confirmations.entry(intent_id).entry(oracle).read(),
                'Already confirmed',
            );
            self.oracle_confirmations.entry(intent_id).entry(oracle).write(true);
            let count = self.oracle_confirmation_count.entry(intent_id).read() + 1;
            self.oracle_confirmation_count.entry(intent_id).write(count);

            self.emit(IntentConfirmed { intent_id, oracle });

            // Auto-release WBTC to solver if oracle threshold met
            let threshold = self.oracle_threshold.read();
            if count >= threshold {
                InternalImpl::do_release_to_solver(ref self, intent_id);
            }
        }

        fn release_to_solver(ref self: ContractState, intent_id: u64) {
            let count = self.oracle_confirmation_count.entry(intent_id).read();
            let threshold = self.oracle_threshold.read();
            assert(count >= threshold, 'Threshold not met');

            InternalImpl::do_release_to_solver(ref self, intent_id);
        }

        fn expire_intent(ref self: ContractState, intent_id: u64) {
            let mut lock = self.intent_locks.entry(intent_id).read();
            assert(lock.status == 0 || lock.status == 1, 'Intent not active');

            let now = get_block_timestamp();
            let timeout = self.intent_timeout.read();
            assert(now >= lock.timestamp + timeout, 'Intent not expired');

            lock.status = 3; // EXPIRED
            self.intent_locks.entry(intent_id).write(lock);

            // Refund WBTC to recipient
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let success = wbtc.transfer(lock.recipient, lock.amount);
            assert(success, 'WBTC refund failed');

            self.emit(IntentExpired { intent_id, refund_recipient: lock.recipient });
        }

        fn set_oracle_config(
            ref self: ContractState,
            signers: Array<ContractAddress>,
            threshold: u32,
            timeout: u64,
        ) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            assert(threshold > 0, 'Threshold must be > 0');
            assert(threshold <= signers.len(), 'Threshold > signers');
            assert(timeout >= 600, 'Timeout too short');

            // Revoke old signers before adding new ones
            let old_count = self.oracle_signer_count.read();
            let mut j: u32 = 0;
            while j < old_count {
                let old_signer = self.oracle_signer_list.entry(j).read();
                self.oracle_signers.entry(old_signer).write(false);
                j += 1;
            };

            // Add new signers
            let mut i: u32 = 0;
            let len = signers.len();
            while i < len {
                self.oracle_signers.entry(*signers.at(i)).write(true);
                self.oracle_signer_list.entry(i).write(*signers.at(i));
                i += 1;
            };

            self.oracle_signer_count.write(len);
            self.oracle_threshold.write(threshold);
            self.intent_timeout.write(timeout);

            self.emit(OracleConfigUpdated { threshold, signer_count: len, timeout });
        }

        fn get_intent(self: @ContractState, intent_id: u64) -> IntentLock {
            self.intent_locks.entry(intent_id).read()
        }

        fn get_intent_count(self: @ContractState) -> u64 {
            self.intent_count.read()
        }

        fn get_oracle_threshold(self: @ContractState) -> u32 {
            self.oracle_threshold.read()
        }

        fn get_intent_timeout(self: @ContractState) -> u64 {
            self.intent_timeout.read()
        }

        fn is_oracle(self: @ContractState, address: ContractAddress) -> bool {
            self.oracle_signers.entry(address).read()
        }

        fn get_protocol_version(self: @ContractState) -> u32 {
            3
        }
    }

    // ========================================
    // Internal: Cryptographic Primitives
    // ========================================

    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Shared verification logic for both withdraw() and withdraw_via_relayer().
        /// Returns (user_share, batch_id).
        fn verify_and_nullify(
            ref self: ContractState,
            denomination: u8,
            secret: felt252,
            blinder: felt252,
            nullifier: felt252,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
        ) -> (u256, u64) {
            // 1. Validate denomination
            let amount = Self::denomination_to_amount(denomination);
            assert(amount > 0, 'Invalid denomination tier');

            // 2. Recompute commitment
            let amount_low: felt252 = amount.low.into();
            let amount_high: felt252 = amount.high.into();
            let commitment = Self::compute_commitment(
                amount_low, amount_high, secret, blinder,
            );

            // 3. Verify commitment exists
            assert(self.commitments.entry(commitment).read(), 'Invalid commitment');

            // 4. Verify nullifier derivation
            let expected_nullifier = PedersenTrait::new(0)
                .update(secret)
                .update(1)
                .finalize();
            assert(nullifier == expected_nullifier, 'Invalid nullifier');

            // 5. Nullifier check — prevent double-spend
            assert(!self.nullifiers.entry(nullifier).read(), 'Note already spent');
            self.nullifiers.entry(nullifier).write(true);

            // 6. Verify Merkle proof against any historical root
            // This allows proofs generated before new deposits to remain valid.
            let computed_root = Self::compute_merkle_root_from_proof(
                commitment, merkle_path, path_indices,
            );
            assert(
                self.merkle_root_history.entry(computed_root).read(),
                'Invalid Merkle proof',
            );

            // 7. Get batch and verify finalized
            let batch_id = self.commitment_to_batch.entry(commitment).read();
            let batch = self.batch_results.entry(batch_id).read();
            assert(batch.is_finalized, 'Batch not finalized');

            // 8. Enforce minimum withdrawal delay (timing-attack protection)
            let now = get_block_timestamp();
            assert(now >= batch.timestamp + MIN_WITHDRAWAL_DELAY, 'Withdrawal too early');

            // 9. Calculate pro-rata WBTC share
            let user_share = (amount * batch.total_wbtc_out) / batch.total_usdc_in;
            assert(user_share > 0, 'Share rounds to zero');

            (user_share, batch_id)
        }

        /// ZK-private verification: verifies proof via Garaga verifier, no secret/blinder needed.
        /// Returns (user_share, batch_id).
        fn verify_zk_and_nullify(
            ref self: ContractState,
            denomination: u8,
            zk_nullifier: felt252,
            zk_commitment: felt252,
            proof: Array<felt252>,
            merkle_path: Array<felt252>,
            path_indices: Array<u8>,
        ) -> (u256, u64) {
            // 1. Validate denomination
            let amount = Self::denomination_to_amount(denomination);
            assert(amount > 0, 'Invalid denomination tier');

            // 2. Look up Pedersen commitment from ZK commitment
            let commitment = self.zk_commitments.entry(zk_commitment).read();
            assert(commitment != 0, 'ZK commitment not found');

            // 3. Verify commitment exists
            assert(self.commitments.entry(commitment).read(), 'Invalid commitment');

            // 4. Verify ZK proof via Garaga verifier
            let verifier_addr = self.zk_verifier.read();
            let zero_addr: ContractAddress = 0.try_into().unwrap();
            if verifier_addr != zero_addr {
                let verifier = IZKVerifierDispatcher { contract_address: verifier_addr };
                let result = verifier.verify_ultra_keccak_zk_honk_proof(proof.span());
                assert(result.is_ok(), 'ZK proof verification failed');

                // Verify public inputs match parameters (prevents proof replay)
                // BN254 Poseidon outputs (~2^254) are reduced % STARK_PRIME for felt252 storage.
                // The proof's public inputs are unreduced BN254 values, so reduce before comparing.
                let pub_inputs = result.unwrap();
                let stark_prime: u256 = 0x800000000000011000000000000000000000000000000000000000000000001;
                let expected_commitment: u256 = zk_commitment.into();
                let expected_nullifier: u256 = zk_nullifier.into();
                let expected_denom: u256 = denomination.into();
                assert(*pub_inputs.at(0) % stark_prime == expected_commitment, 'ZK commitment mismatch');
                assert(*pub_inputs.at(1) % stark_prime == expected_nullifier, 'ZK nullifier mismatch');
                assert(*pub_inputs.at(2) == expected_denom, 'ZK denomination mismatch');
            }

            // 5. ZK Nullifier check — prevent double-spend
            assert(!self.zk_nullifiers.entry(zk_nullifier).read(), 'Note already spent');
            self.zk_nullifiers.entry(zk_nullifier).write(true);

            // 6. Verify Merkle proof against any historical root
            let computed_root = Self::compute_merkle_root_from_proof(
                commitment, merkle_path, path_indices,
            );
            assert(
                self.merkle_root_history.entry(computed_root).read(),
                'Invalid Merkle proof',
            );

            // 7. Get batch and verify finalized
            let batch_id = self.commitment_to_batch.entry(commitment).read();
            let batch = self.batch_results.entry(batch_id).read();
            assert(batch.is_finalized, 'Batch not finalized');

            // 8. Enforce minimum withdrawal delay
            let now = get_block_timestamp();
            assert(now >= batch.timestamp + MIN_WITHDRAWAL_DELAY, 'Withdrawal too early');

            // 9. Calculate pro-rata WBTC share
            let user_share = (amount * batch.total_wbtc_out) / batch.total_usdc_in;
            assert(user_share > 0, 'Share rounds to zero');

            (user_share, batch_id)
        }

        fn compute_commitment(
            amount_low: felt252, amount_high: felt252, secret: felt252, blinder: felt252,
        ) -> felt252 {
            let amount_hash = PedersenTrait::new(0)
                .update(amount_low)
                .update(amount_high)
                .finalize();
            let secret_hash = PedersenTrait::new(0)
                .update(secret)
                .update(blinder)
                .finalize();
            PedersenTrait::new(0).update(amount_hash).update(secret_hash).finalize()
        }

        fn denomination_to_amount(tier: u8) -> u256 {
            // Amounts in USDC with 6 decimals (1 USDC = 1_000_000)
            if tier == 0 {
                1_000_000_u256 // $1 USDC
            } else if tier == 1 {
                10_000_000_u256 // $10 USDC
            } else if tier == 2 {
                100_000_000_u256 // $100 USDC
            } else {
                0_u256
            }
        }

        fn hash_pair(left: felt252, right: felt252) -> felt252 {
            PedersenTrait::new(0).update(left).update(right).finalize()
        }

        fn compute_empty_root() -> felt252 {
            let mut current = ZERO_VALUE;
            let mut i: u32 = 0;
            while i < TREE_DEPTH {
                current = Self::hash_pair(current, current);
                i += 1;
            };
            current
        }

        fn update_merkle_root(
            ref self: ContractState, leaf_index: u32, leaf_value: felt252,
        ) -> felt252 {
            let mut current_hash = leaf_value;
            let mut current_index = leaf_index;
            let mut level: u32 = 0;

            while level < TREE_DEPTH {
                self.merkle_nodes.entry(level).entry(current_index).write(current_hash);

                let sibling_index = if current_index % 2 == 0 {
                    current_index + 1
                } else {
                    current_index - 1
                };

                let sibling = self.merkle_nodes.entry(level).entry(sibling_index).read();
                let sibling_hash = if sibling == 0 {
                    Self::get_zero_hash(level)
                } else {
                    sibling
                };

                current_hash = if current_index % 2 == 0 {
                    Self::hash_pair(current_hash, sibling_hash)
                } else {
                    Self::hash_pair(sibling_hash, current_hash)
                };

                current_index = current_index / 2;
                level += 1;
            };

            current_hash
        }

        fn get_zero_hash(level: u32) -> felt252 {
            let mut current = ZERO_VALUE;
            let mut i: u32 = 0;
            while i < level {
                current = Self::hash_pair(current, current);
                i += 1;
            };
            current
        }

        /// Create an intent escrow lock. WBTC stays in pool until settled or expired.
        fn create_intent(
            ref self: ContractState,
            amount: u256,
            btc_address_hash: felt252,
            recipient: ContractAddress,
        ) {
            let intent_id = self.intent_count.read();
            let now = get_block_timestamp();
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            let lock = IntentLock {
                amount,
                btc_address_hash,
                recipient,
                solver: zero_addr,
                timestamp: now,
                status: 0, // CREATED
            };

            self.intent_locks.entry(intent_id).write(lock);
            self.intent_count.write(intent_id + 1);

            self.emit(IntentCreated {
                intent_id,
                btc_address_hash,
                amount,
                recipient,
                timestamp: now,
            });
        }

        /// Release escrowed WBTC to the solver. Called when oracle threshold met.
        fn do_release_to_solver(ref self: ContractState, intent_id: u64) {
            let mut lock = self.intent_locks.entry(intent_id).read();
            assert(lock.status == 1, 'Intent not claimed');

            lock.status = 2; // SETTLED
            self.intent_locks.entry(intent_id).write(lock);

            // Transfer escrowed WBTC to solver
            let wbtc = IERC20Dispatcher { contract_address: self.wbtc_token.read() };
            let success = wbtc.transfer(lock.solver, lock.amount);
            assert(success, 'Solver WBTC transfer failed');

            self.emit(IntentSettled {
                intent_id,
                solver: lock.solver,
                amount: lock.amount,
            });
        }

        /// Compute the Merkle root from a leaf and its proof path.
        /// Used with historical root tracking — returns the root so caller
        /// can check if it exists in merkle_root_history.
        fn compute_merkle_root_from_proof(
            leaf: felt252,
            path: Array<felt252>,
            indices: Array<u8>,
        ) -> felt252 {
            assert(path.len() == TREE_DEPTH, 'Invalid proof length');
            assert(path.len() == indices.len(), 'Path/indices length mismatch');

            let mut current = leaf;
            let mut i: u32 = 0;
            let path_len = path.len();

            while i < path_len {
                let sibling = *path.at(i);
                let index = *indices.at(i);

                current = if index == 0 {
                    Self::hash_pair(current, sibling)
                } else {
                    Self::hash_pair(sibling, current)
                };

                i += 1;
            };

            current
        }
    }
}
