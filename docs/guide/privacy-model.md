# Privacy Model

Veil Protocol provides multiple layers of privacy protection, each addressing a specific attack vector.

## Privacy Guarantees

| Property | Mechanism |
|----------|-----------|
| **Deposit unlinkability** | Fixed denominations — all deposits in a tier are indistinguishable |
| **Withdrawal unlinkability** | ZK proof + different recipient address + optional gasless relayer |
| **No secrets in calldata** | Noir ZK circuit proves knowledge; Garaga verifier validates on-chain |
| **Double-spend prevention** | Nullifier set: `Poseidon(secret, 1)` — marked spent on first use |
| **Merkle membership** | 20-level Pedersen Merkle tree (1M+ capacity) |
| **Timing protection** | 60-second minimum delay blocks deposit→withdraw attacks |
| **Gasless withdrawal** | Relayer pays gas, breaks sender-link (2% fee, 5% cap) |
| **Bitcoin identity** | BTC wallet signs commitment; Pedersen hash stored on-chain |
| **Note encryption** | AES-GCM with wallet-derived key (client-side) |
| **Compliance** | Optional view keys + exportable JSON proofs |

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

### Double-Spending
**Attack**: Use the same deposit to withdraw multiple times.

**Mitigation**: Nullifier = `Poseidon_BN254(secret, 1)`. On first withdrawal, the nullifier is stored in a set. Any subsequent attempt with the same nullifier is rejected.

### Front-Running
**Attack**: See a withdrawal transaction in the mempool and front-run it.

**Mitigation**: Batch execution (not individual trades). The nullifier is unique to the depositor's secret — only they can generate a valid proof.

### Note Theft
**Attack**: Steal the encrypted note from the browser to learn the secret.

**Mitigation**: Notes encrypted with AES-GCM using a wallet-derived key. Even if localStorage is compromised, the attacker needs the wallet to decrypt.

### Gas-Based Deanonymization
**Attack**: Track which wallet pays gas for the withdrawal transaction.

**Mitigation**: Relayer-powered gasless withdrawals. The relayer pays gas; the user never signs.

### Proof Replay
**Attack**: Reuse a valid proof with different parameters.

**Mitigation**: Public inputs (commitment, nullifier, denomination) are embedded in the proof and verified against the parameters passed to the contract.

## Anonymity Set Strength

The privacy of each withdrawal depends on the **anonymity set size** — the number of deposits in the same denomination tier:

| Deposits | Privacy Level | Description |
|----------|--------------|-------------|
| 1-2 | Low | Trivially linkable |
| 3-9 | Growing | Some ambiguity |
| 10-19 | Strong | Difficult to link |
| 20+ | Maximum | Near-impossible to link |

## Known Limitations

- **Proof generation is server-side** — In the hackathon version, the prover service runs nargo/bb/garaga CLI tools. In production, this would run in-browser via WASM. The prover sees secrets temporarily in memory (never persisted). The critical guarantee holds: **secrets never appear in on-chain calldata**.

- **Keeper centralization** — Batch execution is currently owner-only. Decentralized keeper networks would be the next step.

- **Mock tokens** — USDC/WBTC are MockERC20 on Sepolia for demonstration purposes.
