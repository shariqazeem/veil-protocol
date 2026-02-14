# What is Veil Protocol?

Veil Protocol is a privacy protocol on Starknet that enables private USDC-to-WBTC execution with **real on-chain ZK proof verification**.

## The Problem

On-chain privacy is table stakes — the real question is **can you prove it without revealing anything?**

Most "privacy" protocols either:

- **Post secrets in calldata** — any indexer can link deposits to withdrawals
- **Claim ZK proofs but skip on-chain verification** — the proof exists but nobody checks it
- **Require gas payments** that deanonymize the withdrawer

Veil Protocol solves all three.

## What Makes This Different

| Feature | Veil Protocol | Typical Privacy Pool |
|---------|-----------|---------------------|
| **ZK proof verified on-chain** | Garaga UltraKeccakZKHonk verifier (2835 felt252 calldata) | Mock verifier or off-chain only |
| **Secrets in calldata** | Never — only the ZK proof | Secret + blinder posted as calldata |
| **Gasless withdrawal** | Relayer submits tx, user never signs | User pays gas (deanonymization vector) |
| **Dual-chain identity** | Starknet wallet + Bitcoin wallet (Xverse) | Single chain |
| **Compliance** | Optional view keys + exportable proofs | None |

## Protocol Flow

```
User A deposits 1,000 USDC ──┐
User B deposits 1,000 USDC ──┼──▶ Shielded Pool ──▶ Batch Swap (Avnu) ──▶ WBTC
User C deposits 1,000 USDC ──┘       │                                      │
                                      │                                      │
                            Pedersen Commitments                      Pro-rata shares
                            + ZK Commitments                       withdrawn privately
                            stored in Merkle Tree                  via ZK proof + relayer
```

1. **Shield** — Pick a denomination (100 / 1,000 / 10,000 USDC). Pedersen + Poseidon BN254 commitments computed client-side. Bitcoin wallet signs the commitment.

2. **Batch** — Keeper aggregates deposits → single USDC→WBTC swap via Avnu DEX. Individual intent hidden in the batch.

3. **Unveil** — Generate a ZK proof (Noir → Barretenberg → Garaga calldata). Submit to `withdraw_private`. Garaga verifier validates on-chain. WBTC sent to any address, optionally via gasless relayer.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo 2.15, OpenZeppelin Interfaces |
| ZK Circuit | Noir (Aztec), compiled to ACIR |
| ZK Prover | Barretenberg (`bb`) — UltraKeccakZKHonk |
| On-Chain Verifier | Garaga UltraKeccakZKHonkVerifier |
| DEX | Avnu Aggregator (batch swaps) |
| Frontend | Next.js 16, React 19, Tailwind 4, Framer Motion |
| Wallets | Starknet (Argent/Braavos) + Bitcoin (Xverse via sats-connect) |
| Cryptography | Pedersen (Stark), Poseidon BN254, AES-GCM |
| Testing | snforge 0.56.0 (40 passing tests) |
| Deployment | Vercel (frontend), Starknet Sepolia (contracts) |
