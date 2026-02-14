# How It Works

Veil Protocol operates in three phases: **Shield**, **Batch**, and **Unveil**.

## Phase 1: Shield (Deposit)

When you deposit USDC into the shielded pool:

1. **Choose a denomination** — 100, 1,000, or 10,000 USDC. Fixed amounts make deposits indistinguishable.

2. **Client-side commitment generation**:
   - Generate random `secret` and `blinder` values
   - Compute **Pedersen commitment** = `H(H(0, amount_hash), secret_hash)` (Stark field)
   - Compute **ZK commitment** = `Poseidon_BN254(secret, blinder, denomination)` (BN254 field)

3. **Bitcoin attestation** — Your Bitcoin wallet (Xverse) signs the commitment hash, binding your BTC identity to the deposit.

4. **On-chain storage** — `deposit_private(commitment, denomination, btc_identity, zk_commitment)` stores:
   - Pedersen commitment → inserted into 20-level Merkle tree
   - ZK commitment → mapped for later verification
   - USDC transferred to pool

::: info Key Privacy Property
The `secret` and `blinder` **never leave your browser**. Only cryptographic commitments are stored on-chain.
:::

## Phase 2: Batch (Keeper Execution)

A keeper (currently owner-only) aggregates all pending deposits:

1. Calls `execute_batch(min_wbtc_out, routes)` on the ShieldedPool contract
2. Pool approves USDC spending to the Avnu router
3. Avnu executes a single USDC → WBTC swap across configured routes
4. Exchange rate locked: `wbtc_received / total_usdc`
5. Batch marked as executed, Merkle tree updated

**Why batch?** Individual swaps reveal the depositor's intent timing. A batch hides your trade among all concurrent deposits.

## Phase 3: Unveil (Withdrawal)

After a 60-second cooldown, you can withdraw your WBTC share:

### ZK Proof Generation

```
Browser → POST /prove (to prover service)
  ├── nargo execute    → witness generation
  ├── bb prove         → UltraKeccakZKHonk proof (7KB binary)
  └── garaga calldata  → 2835 felt252 values (proof + MSM/KZG hints)
```

The proof demonstrates:
- You **know** the `secret` and `blinder` that produce the committed `zk_commitment`
- The derived `nullifier = Poseidon_BN254(secret, 1)` hasn't been used before

### On-Chain Verification

```
withdraw_private(denomination, zk_nullifier, zk_commitment, proof[2835], merkle_path, indices, recipient)
  ├── Garaga verifier validates proof on-chain
  ├── Nullifier marked spent (no double-spend)
  ├── Merkle proof verified for Pedersen commitment
  └── WBTC transferred to recipient
```

### Gasless Option

With the relayer enabled:
- The relayer's address appears as tx sender, **not yours**
- You never sign anything — the ZK proof is your authorization
- No gas payment from your wallet = no on-chain footprint
- Relayer takes a small fee (2%, capped at 5%)

::: tip Why Gasless Matters
Without the relayer, your wallet signs the withdrawal tx → on-chain link between depositor and withdrawer. With the relayer, the link is completely broken.
:::

## Timing Protection

A 60-second minimum delay between deposit and withdrawal prevents:
- Deposit-and-immediately-withdraw attacks
- Timing correlation between deposits and withdrawals
- Front-running withdrawal transactions
