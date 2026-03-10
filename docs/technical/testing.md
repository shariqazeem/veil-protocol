# Testing

Veil Protocol has **164 passing tests** -- 37 Cairo contract tests, 4 Noir circuit tests, and 123 frontend tests (Vitest).

## Cairo Contract Tests (37 tests)

```bash
cd contracts && snforge test
# Tests: 37 passed, 0 failed, 0 ignored, 0 filtered out
```

### Core Engine (7 tests)

**File**: `tests/test_dark_engine.cairo`

Tests the fundamental protocol mechanics:

- Three-user deposit and batch execution flow
- Merkle root updates on deposit
- Denomination amounts ($1 / $10 / $100 / $1,000 USDC)
- View key registration
- Anonymity set tracking per denomination tier
- BTC identity hash stored on deposit
- BTC-linked deposit counter increments

### ZK Privacy (16 tests)

**File**: `tests/test_zk_privacy.cairo`

Tests the ZK-specific functionality:

- `deposit_private` stores ZK commitment mapping
- `deposit_private` to `withdraw_private` full flow
- ZK double-spend rejection (same nullifier)
- Wrong ZK commitment rejection
- Timing delay with ZK withdrawals
- Relayer fee calculation with ZK
- Backward compatibility with legacy deposits (no ZK)
- Duplicate ZK commitment rejection
- BTC identity with ZK deposits
- Zero ZK commitment rejection
- ZK withdrawal with BTC intent creates escrow

### Intent Escrow (9 tests)

**File**: `tests/test_intent_escrow.cairo`

Tests the BTC intent settlement system:

- `withdraw_with_btc_intent` creates intent lock
- `claim_intent` sets solver address
- Oracle confirmation and release to solver
- Intent expiration refunds recipient
- Double claim rejection
- Non-oracle confirmation rejection
- Full intent lifecycle (create, claim, confirm, release)

### Withdrawal (2 tests)

**File**: `tests/test_withdrawal.cairo`

- Full lifecycle: deposit, batch execute, withdraw with Merkle proof
- Two-user withdrawal with independent Merkle proofs

## Noir Circuit Tests (4 tests)

```bash
cd circuits/ghostsats && nargo test
# [ghostsats] 4 tests passed
```

- `test_valid_proof` -- Valid withdrawal proof generation
- `test_invalid_commitment` -- Rejects wrong commitment
- `test_invalid_nullifier` -- Rejects wrong nullifier
- `test_zero_recipient` -- Rejects zero recipient

## Frontend Tests (123 tests)

```bash
cd frontend && npx vitest run
# Test Files  20 passed (20)
#      Tests  123 passed (123)
```

### API Route Tests (36 tests)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `chat.test.ts` | 6 | Greeting, pool analysis, privacy check, strategy |
| `privacy-score.test.ts` | 2 | Pool health metrics + error handling |
| `privacy-audit.test.ts` | 6 | x402 payment flow + verification |
| `premium-strategy.test.ts` | 4 | x402 payment + personalized analysis |
| `relay.test.ts` | 7 | Transaction execution + error handling |
| `relayer-shared.test.ts` | 5 | Rate limiting, account setup |
| `notify.test.ts` | 3 | Telegram webhook validation |
| `validate-init.test.ts` | 7 | Bot init validation |

### Utility Tests (27 tests)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `strategyEngine.test.ts` | 15 | Strategy parsing, plan generation, all 5 types |
| `privacy.test.ts` | 12 | Merkle proof generation, Pedersen hashing |

### Component Tests (17 tests)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `TransactionHistory.test.tsx` | 5 | Transaction display |
| `PrivacyScore.test.tsx` | 6 | Animated score circle |
| `OnboardingBanner.test.tsx` | 4 | First-time user guide |
| `TelegramAppShell.test.tsx` | 3 | Telegram Mini App |

### Context Tests (4 tests)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `TelegramContext.test.tsx` | 4 | Telegram context provider |

## Running Tests

### Full Suite

```bash
# Cairo contracts
cd contracts && snforge test

# Frontend
cd frontend && npx vitest run
```

### Specific Test File

```bash
# Cairo
snforge test --filter test_dark_engine       # Core engine tests
snforge test --filter test_zk_privacy        # ZK privacy tests
snforge test --filter test_intent_escrow     # Intent escrow tests

# Frontend
npx vitest run src/__tests__/api/chat.test.ts
npx vitest run src/__tests__/utils/strategyEngine.test.ts
```

## Test Architecture

### Cairo Tests

Tests use `snforge_std` utilities:

- `deploy_syscall` for contract deployment
- `start_cheat_caller_address` for caller impersonation
- `start_cheat_block_timestamp_global` for time manipulation
- Mock contracts for USDC, WBTC, and Avnu router in test environment

### Frontend Tests

Tests use Vitest + React Testing Library:

- `vi.mock()` for starknet contract mocking
- JSDOM environment for component tests
- Proper async state management testing
- x402 payment verification tested with mock Transfer events

### Denomination Reference for Tests

| Tier | Label | Raw Amount (USDC 6 decimals) |
|------|-------|------------------------------|
| 0 | $1 | 1,000,000 |
| 1 | $10 | 10,000,000 |
| 2 | $100 | 100,000,000 |
| 3 | $1,000 | 1,000,000,000 |
