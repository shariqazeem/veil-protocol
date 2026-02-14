# Veil Protocol

Confidential Bitcoin accumulation infrastructure on Starknet.

[Live Demo](https://theveilprotocol.vercel.app) · [Docs](https://veilprotocol-docs.vercel.app) · [Pool Contract](https://sepolia.starkscan.co/contract/0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210) · [ZK Verifier](https://sepolia.starkscan.co/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07) · Re{define} Hackathon 2026

---

## Why This Matters

Public Bitcoin accumulation exposes treasury strategy. Every on-chain purchase signals intent: competitors front-run positions, analysts reconstruct allocation patterns, and MEV bots extract value from visible orders.

Standardized transaction amounts alone are insufficient. Without verified zero-knowledge proofs, deposits and withdrawals remain linkable through timing analysis, gas payment correlation, and calldata inspection. Most privacy protocols either post secrets in calldata or skip on-chain proof verification entirely.

Veil Protocol eliminates these vectors. Capital enters standardized privacy pools. Batch execution hides individual intent. STARK-verified zero-knowledge proofs enable unlinkable exits. Secrets never appear on-chain.

## What We Built

A complete confidential accumulation pipeline deployed and verified end-to-end on Starknet Sepolia:

1. **Allocate** -- Deposit USDC into fixed tranches ($1 / $10 / $100). A Pedersen commitment and BN254 Poseidon ZK commitment are computed client-side. Only hashes are stored on-chain.
2. **Batch Execute** -- All deposits aggregate into a single USDC-to-BTC conversion via AVNU DEX aggregator. Individual accumulation intent is hidden within the batch.
3. **Verify** -- Zero-knowledge proof generated entirely in-browser (noir_js + bb.js WASM). Garaga verifier validates the UltraKeccakZKHonk proof on-chain (~2,835 felt252 calldata elements).
4. **Confidential Exit** -- Claim BTC on Starknet or settle to native Bitcoin via intent bridge. Gasless relayer option breaks the sender-link entirely. No cryptographic connection to the original allocation.

52 contract tests passing. Full E2E verified on Sepolia.

## Technical Architecture

### Cairo Contracts

The `ShieldedPool` contract manages the complete lifecycle: deposits with dual commitment schemes (Pedersen for Merkle membership, Poseidon BN254 for ZK circuit compatibility), batch execution via AVNU router, and two withdrawal paths (legacy Pedersen and ZK-private). A 20-level Merkle tree provides capacity for over 1 million commitments. Nullifier tracking prevents double-spending.

### STARK-Based Verification (Garaga)

The Noir circuit proves knowledge of `(secret, blinder, denomination)` such that `Poseidon_BN254(secret, blinder, denomination) == commitment` and `Poseidon_BN254(secret, 1) == nullifier`. The proof is generated client-side via `@noir-lang/noir_js` (witness) and `@aztec/bb.js` (UltraKeccakZKHonk proof), then converted to calldata by Garaga. The on-chain verifier validates the proof and extracts public inputs for parameter matching. Secrets never leave the browser.

### Pedersen Commitments

Each deposit produces a Pedersen commitment in the Stark field: `H(H(0, amount_hash), secret_hash)`. These commitments form the leaves of the on-chain Merkle tree. Withdrawal requires proving Merkle membership of the commitment corresponding to the caller's secret, without revealing the secret itself.

### Relayer Abstraction

Gasless withdrawals eliminate the final deanonymization vector. The relayer submits the transaction on behalf of the user, paying gas from its own account. The ZK proof is the authorization -- the relayer cannot modify the recipient, steal funds, or link the withdrawal to a deposit. A configurable fee (default 2%, capped at 5%) compensates the relayer.

### Oracle Settlement

Intent-based Bitcoin bridge: a user locks BTC in escrow with a destination Bitcoin address hash. A solver claims the intent, sends native Bitcoin, and an oracle confirms settlement on-chain. If no solver fills the intent within the timeout period, the escrowed BTC is refunded. This enables cross-chain settlement without custodial bridges.

## Why Starknet

**Quantum-secure STARK proofs.** STARKs require no trusted setup and are resistant to quantum computing attacks. For institutional capital with multi-decade time horizons, this is a non-negotiable property. The Garaga verifier operates within Starknet's STARK-based proof system, providing defense in depth.

**Cairo-native design.** The entire protocol is built in Cairo 2.15. Pedersen hashing, Merkle tree construction, batch execution, and access control run natively on the Starknet VM. No EVM compatibility layer. No bridge dependencies for core protocol operations.

**Bitcoin DeFi economics.** Sub-$0.01 transaction costs make batch execution viable at any scale. Account abstraction enables the gasless withdrawal pattern. AVNU aggregation ensures best execution across all Starknet liquidity sources.

## Security Considerations

**Protected against:** deposit-withdrawal linking (ZK proofs + relayer), double-spending (nullifier set), front-running (batch execution), timing correlation (60-second mandatory delay), gas-based deanonymization (gasless relayer), proof replay (public input validation), BN254-to-felt252 overflow (STARK_PRIME reduction).

**Hackathon scope limitations:** single-owner keeper for batch execution (production: permissionless with incentives), no pause mechanism, no upgradeability proxy, mock tokens on testnet (contract supports real tokens without changes). The relayer is trust-minimized -- it can refuse service but cannot steal funds or break privacy guarantees.

**Compliance.** Optional view keys allow users to voluntarily prove transaction history to auditors without compromising other participants' privacy. Exportable cryptographic proofs provide verifiable evidence of specific deposits.

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x4606a71755ae44459a9fc2105945c3fc3d88227169f834bb0d8a4c86b8b0210` |
| Garaga Verifier | `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` |

## Running Locally

```
cd contracts && scarb build && snforge test    # 52 tests
cd frontend && npm install && npm run dev      # localhost:3000
cd scripts && npm install && npm run keeper    # batch executor
```

## Future Roadmap

- Mainnet deployment with real USDC/WBTC
- Decentralized relayer network with staked operators
- Garaga WASM for fully client-side calldata generation (zero server dependency)
- Larger anonymity sets through cross-protocol deposit aggregation
- Recursive proof composition for reduced on-chain verification cost
- Multi-asset support beyond BTC

## License

MIT
