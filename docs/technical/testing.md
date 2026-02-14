# Testing

Veil Protocol has 40 passing tests covering the full protocol.

```bash
cd contracts && snforge test
# Tests: 40 passed, 0 failed, 0 ignored, 0 filtered out
```

## Test Suites

### Core Engine (13 tests)

Tests the fundamental protocol mechanics:

- Denomination validation (100 / 1K / 10K USDC)
- Deposit flow with Pedersen commitments
- Batch execution via Avnu router
- Merkle tree construction and root computation
- Anonymity set tracking per denomination tier
- BTC identity hash binding

### Withdrawal (16 tests)

Tests the complete deposit → execute → withdraw cycle:

- Full lifecycle: deposit → batch execute → withdraw
- Invalid preimage rejection
- Double-spend prevention (nullifier reuse)
- Timing delay enforcement (60s minimum)
- Relayer fee calculation (2% default, 5% cap)
- Exchange rate computation
- BTC withdrawal intent

### ZK Privacy (11 tests)

Tests the ZK-specific functionality:

- `deposit_private` → `withdraw_private` full flow
- ZK double-spend rejection (same nullifier)
- Wrong ZK commitment rejection
- Timing delay with ZK withdrawals
- Relayer fee calculation with ZK
- Backward compatibility with legacy deposits (no ZK)
- Duplicate ZK commitment rejection
- BTC identity with ZK deposits
- Zero commitment rejection

## Running Tests

### Full Suite

```bash
cd contracts
snforge test
```

### Specific Test File

```bash
snforge test --filter test_dark_engine    # Core engine tests
snforge test --filter test_withdrawal     # Withdrawal tests
snforge test --filter test_zk_privacy     # ZK privacy tests
```

### Garaga Verifier Fork Test

The Garaga verifier has a separate fork test that runs against Starknet Sepolia:

```bash
cd circuits/ghostsats/zk_verifier
snforge test
```

This test:
1. Deploys the verifier contract on a Sepolia fork
2. Submits a real proof (2835 felt252 values)
3. Verifies the proof passes on-chain
4. Checks public inputs match expected values

## Test Architecture

Tests use `snforge_std` utilities:

- `deploy_syscall` for contract deployment
- `start_cheat_caller_address` for caller impersonation
- `start_cheat_block_timestamp_global` for time manipulation
- Mock contracts for USDC, WBTC, and Avnu router

### Mock Contracts

| Contract | Purpose |
|----------|---------|
| MockERC20 | USDC and WBTC with public mint |
| MockAvnuRouter | Simulates Avnu swap at a fixed rate |

### Test Flow Example

```cairo
// 1. Deploy mock tokens + pool
let (pool, usdc, wbtc, router) = deploy_test_suite();

// 2. Mint USDC to depositor
usdc.mint(depositor, 1_000_000_000); // 1000 USDC

// 3. Approve + deposit
usdc.approve(pool, 1_000_000_000);
pool.deposit_private(commitment, 1, btc_hash, zk_commitment);

// 4. Execute batch
pool.execute_batch(0, routes);

// 5. Advance time past cooldown
set_block_timestamp(current_time + 61);

// 6. Withdraw with ZK proof
pool.withdraw_private(1, nullifier, zk_commitment, proof, merkle_path, indices, recipient, 0);
```
