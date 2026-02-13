# GhostSats Phase 2 — Testing Guide

## Deployed Addresses (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af` |
| GaragaVerifier | `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` |
| USDC (Mock) | `0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e` |
| WBTC (Mock) | `0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769` |
| MockAvnuRouter | `0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647` |
| Deployer | `0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5` |

**Frontend:** https://ghostsats.vercel.app
**Explorer:** https://sepolia.voyager.online/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af

---

## 1. Contract Tests (40 passing)

```bash
cd contracts
snforge test
```

Expected output: `Tests: 40 passed, 0 failed, 0 ignored, 0 filtered out`

### Test breakdown

**Core engine (13 tests)** — `test_dark_engine.cairo`
- Denomination amounts, invalid denomination rejection
- Deposit, batch execution, Merkle root updates
- Multi-batch sequencing, leaf retrieval
- Anonymity set tracking, view key registration
- Bitcoin identity storage/linking, empty batch rejection

**Withdrawal (16 tests)** — `test_withdrawal.cairo`
- Full flow: deposit → execute_batch → withdraw with Merkle proof
- Invalid preimage / wrong nullifier rejection
- Double withdrawal prevention (nullifier spent)
- Timing delay enforcement (60s cooldown)
- Relayer withdrawal with fee (+ zero fee, excessive fee rejection)
- Exchange rate calculation, BTC intent events

**ZK Privacy (11 tests)** — `test_zk_privacy.cairo`
- `test_deposit_private_stores_zk_mapping` — verifies ZK commitment maps to Pedersen commitment
- `test_withdraw_private_full_flow` — full deposit_private → execute → withdraw_private flow, PrivateWithdrawal event emitted
- `test_zk_double_spend_rejected` — same ZK nullifier cannot be reused
- `test_wrong_zk_commitment_rejected` — unknown ZK commitment panics
- `test_zk_withdrawal_timing_delay_enforced` — 60s cooldown applies to ZK withdrawals
- `test_zk_relayer_fee_calculation` — 2% relayer fee via withdraw_private_via_relayer
- `test_backward_compat_old_withdraw_still_works` — old deposit()/withdraw() still work
- `test_duplicate_zk_commitment_rejected` — same ZK commitment cannot be deposited twice
- `test_deposit_private_with_btc_identity` — BTC identity linked + events emitted
- `test_zero_zk_commitment_rejected` — zero ZK commitment invalid
- `test_zk_withdrawal_with_btc_intent` — Bitcoin withdrawal intent event with ZK

---

## 2. Noir ZK Circuit

```bash
cd circuits/ghostsats
nargo test        # Run circuit unit tests
nargo compile     # Compile to ACIR
nargo execute     # Generate witness from Prover.toml
```

The circuit proves knowledge of (secret, blinder) for a commitment without revealing them:
- `zk_commitment = Poseidon_BN254(secret, blinder, denomination)`
- `nullifier = Poseidon_BN254(secret, 1)`

**Test values** (from Prover.toml):
- secret: 12345, blinder: 67890, denomination: 1
- commitment: `0x2c3e4b6cea90e24ccb7d548bb01060a0471b4a040b9117cdf53486d31308b5ec`
- nullifier: `0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9a`

---

## 3. Garaga On-Chain Verifier

```bash
cd circuits/ghostsats/zk_verifier
scarb build
snforge test
```

The test `test_verify_ultra_keccak_zk_honk_proof` forks Sepolia and verifies a real proof on-chain. Requires network access (Cartridge RPC).

### 3.1 End-to-End Proof Generation (Prover Service)

The relayer includes a `/prove` endpoint that generates real ZK proofs:

```bash
# Start the prover/relayer service
cd scripts
npm run relayer

# Test proof generation
curl -X POST http://localhost:3001/prove \
  -H "Content-Type: application/json" \
  -d '{"secret":"12345","blinder":"67890","denomination":1}'
```

**Pipeline**: `nargo execute` (witness) → `bb prove` (UltraKeccakZKHonk proof) → `garaga calldata` (2835 felt252 elements with MSM/KZG hints)

**Expected response**: JSON with `proof` (array of ~2835 hex strings), `zkCommitment`, `zkNullifier`

**What this proves**: The prover knows `(secret, blinder)` such that:
- `Poseidon_BN254(secret, blinder, denomination) == zk_commitment`
- `Poseidon_BN254(secret, 1) == nullifier`

Secret and blinder NEVER appear in the on-chain calldata — only the proof does.

---

## 4. Frontend Testing

### 4.1 ZK-Private Deposit (Shield tab)

1. Go to https://ghostsats.vercel.app/app
2. Connect Starknet wallet (Argent/Braavos on Sepolia)
3. Connect Bitcoin wallet (Xverse on Testnet4)
4. Select a denomination tier (100 / 1,000 / 10,000 USDC)
5. Click "Shield [amount] USDC"

**What to verify:**
- Phase shows "Generating zero-knowledge commitment..." (new ZK phase)
- Phase shows "Bitcoin wallet signing commitment hash..."
- Phase shows "Depositing to shielded pool & triggering batch swap..."
- Transaction calls `deposit_private` (not old `deposit`)
- Toast notification shows "USDC shielded and batch swap triggered"
- On-chain: verify ZK commitment mapping exists via `get_zk_commitment_mapping()`
- Dashboard stats update: pending USDC, commitment count, anonymity set

### 4.2 ZK-Private Withdrawal (Unveil tab)

1. Wait 60 seconds after batch execution (privacy cooldown timer visible)
2. (Optional) Toggle "Gasless withdrawal" to use relayer
3. (Optional) Enter Bitcoin withdrawal address for cross-chain intent
4. Click "Claim WBTC" on a ready note

**What to verify:**
- Phase shows "Generating zero-knowledge proof (10-30s)..." (real proof generation via prover service)
- Phase shows "Submitting withdrawal with zero-knowledge proof..."
- Transaction calls `withdraw_private` (not old `withdraw`) — **no secret/blinder in calldata**
- Proof calldata contains ~2835 felt252 values (the UltraKeccakZKHonk proof + Garaga hints)
- On-chain: `is_zk_nullifier_spent()` returns true for the nullifier
- WBTC received in wallet
- Toast notification shows "WBTC withdrawn privately"
- PrivateWithdrawal event emitted (check Voyager)

### 4.3 Backward Compatibility

Notes created before Phase 2 (without `zkCommitment` field) still work:
- They use the legacy `withdraw` entrypoint
- Phase shows "Reconstructing Merkle tree & building proof..."
- No "Generating zero-knowledge proof..." phase

### 4.4 Gasless Relayer Toggle

1. On the Unveil tab, look for "Gasless withdrawal" toggle (only appears for ZK notes)
2. Toggle it on
3. Verify fee display: "Relayer submits your withdrawal — you pay no gas. Fee: 2%"
4. Claim WBTC — the relayer submits the transaction (you don't sign)

**To run the relayer locally:**
```bash
cd scripts
cp .env.example .env  # Fill in PRIVATE_KEY and ACCOUNT_ADDRESS
npm run relayer
```

The relayer runs on port 3001 with endpoints:
- `GET /health` — returns `{"status":"ok","fee_bps":200}`
- `GET /info` — returns pool address, relayer address, fee info
- `POST /relay` — submits a `withdraw_private_via_relayer` transaction

### 4.5 Transaction History

1. After any deposit or withdrawal, scroll down below the tabs
2. The Transaction History section shows a timeline of all notes
3. Each entry shows: Shield/Unveil icon, denomination, batch ID, timestamp
4. Click an entry to expand: commitment hash, ZK commitment, BTC identity, WBTC received

### 4.6 Toast Notifications

- **Success deposit:** green toast "USDC shielded and batch swap triggered"
- **Success withdrawal:** green toast "WBTC withdrawn privately"
- **Wallet rejection:** red toast "Transaction rejected"
- **Insufficient balance:** red toast "Insufficient USDC balance"
- **Cooldown:** red toast "Privacy cooldown not finished"
- **Double spend:** red toast "Note already claimed"

### 4.7 Error Handling

- RPC calls retry 3 times with exponential backoff (500ms → 1s → 2s)
- Dashboard displays 0 instead of NaN/undefined for all stats
- Human-readable error messages for common Starknet errors

---

## 5. Landing Page

Visit https://ghostsats.vercel.app and verify:
- "Zero-Knowledge Proofs" feature card in Privacy Guarantees grid
- "Noir ZK" and "Garaga" badges in the "Built With" tech stack
- Step 3 (Unveil) mentions "zero-knowledge proof"
- Hero: "Zero-knowledge proofs, Pedersen commitments..."
- Footer: "ZK Proofs" in the tech list

---

## 6. Architecture Summary

```
Deposit flow:
  Browser → generatePrivateNote()
    ├── Pedersen commitment = H(H(0, amount_hash), secret_hash)  [Stark field]
    └── ZK commitment = Poseidon(secret, blinder, denomination)  [BN254 field]
  → deposit_private(commitment, denomination, btc_identity, zk_commitment)
    ├── Stores commitment in Merkle tree
    └── Maps zk_commitment → pedersen_commitment

Withdrawal flow:
  Browser → POST /prove to prover service
    ├── Prover: nargo execute → witness
    ├── Prover: bb prove (UltraKeccakZKHonk) → proof binary
    └── Prover: garaga calldata → 2835 felt252 values (proof + MSM/KZG hints)
  Browser receives proof calldata (secret/blinder NOT in response)
  → withdraw_private(denomination, zk_nullifier, zk_commitment, proof[2835], merkle_path, ...)
    ├── Looks up pedersen_commitment from zk_commitment
    ├── Verifies ZK proof via Garaga verifier (if verifier != zero)
    ├── Validates public inputs match parameters (anti-replay)
    ├── Checks zk_nullifier not spent → marks spent
    ├── Verifies Merkle proof for pedersen_commitment
    ├── Enforces 60s timing delay
    └── Transfers WBTC to recipient

Key insight: secret and blinder NEVER appear in calldata
```

---

## 7. Known Limitations (Hackathon Scope)

1. **ZK verifier deployed and active** — The Garaga UltraKeccakZKHonkVerifier is deployed at `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` and wired to the ShieldedPool constructor. Real proofs (~2835 felt252 calldata elements) are generated by the prover service and verified on-chain. Public inputs are reduced modulo STARK_PRIME (BN254→felt252) and validated to prevent proof replay attacks.

2. **Proof generation is server-side** — The prover service (POST /prove) runs nargo → bb → garaga CLI tools. In production, this would run in-browser via `@noir-lang/noir_js` + `@aztec/bb.js` WASM. The prover sees secrets temporarily in-memory (never persisted). The critical guarantee: secrets never appear in on-chain calldata.

3. **Relayer/Prover requires manual startup** — No hosted service yet. Run `npm run relayer` locally for proof generation and gasless withdrawals.

4. **Mock tokens** — USDC/WBTC are MockERC20 on Sepolia, not real tokens.
