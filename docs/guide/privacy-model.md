# Privacy Model

Veil Protocol provides multiple layers of privacy protection, each addressing a specific attack vector.

## Privacy Guarantees

| Property | Mechanism |
|----------|-----------|
| **Deposit unlinkability** | Fixed denominations ($1 / $10 / $100 / $1,000 USDC) -- all deposits in a tier are indistinguishable |
| **Withdrawal unlinkability** | ZK proof + different recipient address + optional gasless relayer |
| **No secrets in calldata** | Noir ZK circuit proves knowledge; Garaga verifier validates on-chain |
| **In-browser proving** | bb.js WASM -- secrets (secret, blinder) never leave the browser |
| **Double-spend prevention** | Nullifier set: `Poseidon(secret, 1)` -- marked spent on first use |
| **Merkle membership** | 20-level Pedersen Merkle tree (1M+ capacity) |
| **Timing protection** | 60-second minimum delay blocks deposit-to-withdraw attacks |
| **Temporal decorrelation** | AI Strategist autonomous DCA with randomized delays (20-180s) across deposits |
| **Gasless withdrawal** | Relayer pays gas, breaks sender-link (2% fee, 5% cap) |
| **Bitcoin identity** | BTC wallet signs commitment; Pedersen hash stored on-chain |
| **Dual settlement** | WBTC on Starknet OR native BTC via intent settlement -- withdrawal mode adds another decorrelation layer |
| **Note encryption** | AES-GCM with wallet-derived key (client-side) |
| **AI agent privacy** | Strategy engine runs client-side; only commitment hashes go on-chain |
| **Compliance** | Optional view keys + exportable JSON proofs |

## Denomination Tiers

| Tier | Amount | Raw (6 decimals) | Use Case |
|------|--------|-------------------|----------|
| 0 | $1 USDC | 1,000,000 | Micro-transactions, testing |
| 1 | $10 USDC | 10,000,000 | Standard privacy deposits |
| 2 | $100 USDC | 100,000,000 | Larger accumulation |
| 3 | $1,000 USDC | 1,000,000,000 | Whale-scale privacy |

Fixed denominations ensure all deposits within a tier are identical on-chain. An observer cannot distinguish one $10 deposit from another.

## Attack Vectors & Mitigations

### Balance Tracking
**Attack**: Track USDC/WBTC balances to link deposits to withdrawals.

**Mitigation**: No public balance mapping exists. All deposits go into a shared pool. Fixed denominations prevent amount-based correlation.

### Deposit-Withdrawal Linking
**Attack**: Correlate deposit and withdrawal transactions by address, timing, or amount.

**Mitigation**:
- Different recipient address
- ZK proof (no signing required)
- Gasless relayer (no gas payment)
- Timing delay (60s minimum)
- Fixed denominations (no amount correlation)
- AI Strategist adds temporal decorrelation via randomized DCA delays

### Double-Spending
**Attack**: Use the same deposit to withdraw multiple times.

**Mitigation**: Nullifier = `Poseidon_BN254(secret, 1)`. On first withdrawal, the nullifier is stored in a set. Any subsequent attempt with the same nullifier is rejected.

### Front-Running
**Attack**: See a withdrawal transaction in the mempool and front-run it.

**Mitigation**: Batch execution (not individual trades). The nullifier is unique to the depositor's secret -- only they can generate a valid proof.

### Note Theft
**Attack**: Steal the encrypted note from the browser to learn the secret.

**Mitigation**: Notes encrypted with AES-GCM using a wallet-derived key. Even if localStorage is compromised, the attacker needs the wallet to decrypt.

### Gas-Based Deanonymization
**Attack**: Track which wallet pays gas for the withdrawal transaction.

**Mitigation**: Relayer-powered gasless withdrawals. The relayer pays gas; the user never signs.

### Proof Replay
**Attack**: Reuse a valid proof with different parameters.

**Mitigation**: Public inputs (commitment, nullifier, denomination) are embedded in the proof and verified against the parameters passed to the contract.

### Temporal Correlation
**Attack**: Correlate the timing of deposits to link them to a single user running a DCA strategy.

**Mitigation**: The AI Strategist's autonomous DCA adds randomized delays between deposits (20-180 seconds depending on strategy type). Stealth DCA mode additionally randomizes the tier selection per deposit, making cross-pool correlation analysis computationally infeasible.

### AI Agent as Privacy Leak
**Attack**: The AI strategy agent could leak user intentions or deposit patterns to an external service.

**Mitigation**: The strategy engine is fully deterministic and runs entirely client-side. No external API calls are made for strategy generation. The agent reads on-chain pool state (public data) and the user's natural language input (never transmitted). Only standard commitment hashes go on-chain -- the agent's strategy plan, tier selection logic, and timing decisions are never revealed.

## Anonymity Set Strength

The privacy of each withdrawal depends on the **anonymity set size** -- the number of deposits in the same denomination tier:

| Deposits in Tier | Privacy Level | Description |
|------------------|--------------|-------------|
| 1-2 | Low | Trivially linkable |
| 3-9 | Growing | Some ambiguity |
| 10-19 | Strong | Difficult to link |
| 20+ | Maximum | Near-impossible to link |

The **Confidentiality Strength Index (CSI)** combines anonymity set sizes across all tiers:

```
CSI = max_participants x active_tiers
```

The AI Strategist displays CSI impact for every plan, showing how your deposits strengthen protocol-wide privacy.

## Known Limitations

- **In-browser proving requires WASM support** -- The bb.js WASM prover runs client-side in modern browsers, keeping secrets fully local. Older browsers or restricted environments fall back to the server-side prover, which sees secrets temporarily in memory (never persisted). In both modes, **secrets never appear in on-chain calldata**.

- **Keeper centralization** -- Batch execution is currently owner-only. The embedded relayer API can trigger batches, but only with the configured keeper key. Decentralized keeper networks would be the next step.

- **Intent settlement trust assumption** -- BTC intent settlement relies on a solver network to fill BTC orders. The escrow mechanism protects against solver default (WBTC is returned if the intent is not filled), but settlement time depends on solver availability.

- **Strategy engine is deterministic** -- The AI Strategist uses template-based logic, not a large language model. It covers the 5 defined strategy types well but cannot handle arbitrary complex instructions outside its pattern matching.
