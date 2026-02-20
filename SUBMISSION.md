# Veil Protocol — Submission

## Project Description (500 words)

### Veil Protocol: Confidential Bitcoin Accumulation Infrastructure on Starknet

**Problem.** Every Bitcoin purchase on DeFi protocols is publicly visible. Institutional treasuries, funds, and privacy-conscious individuals accumulating BTC expose their strategy, timing, and position size to the entire blockchain. Front-runners exploit this transparency. Competitors monitor accumulation patterns. Privacy in Bitcoin DeFi doesn't exist today.

**Solution.** Veil Protocol is a complete confidential accumulation pipeline deployed on Starknet. Users deposit USDC into fixed-denomination tranches ($1, $10, $100), which are batched into a single USDC-to-BTC conversion via AVNU DEX. Individual intent is hidden within the batch. Withdrawals require a zero-knowledge proof generated entirely in the user's browser — secrets never leave the device.

**How It Works.**

1. **Shield** — Deposit USDC into a shielded pool. A Pedersen commitment (for Merkle membership) and a Poseidon BN254 commitment (for ZK circuit compatibility) are computed client-side. Only hashes are stored on-chain.

2. **Batch** — All deposits aggregate into one USDC→BTC swap at live market prices. Individual accumulation intent is invisible within the batch.

3. **Verify** — A Noir ZK circuit proves knowledge of the deposit secret without revealing it. The proof (UltraKeccakZKHonk format, ~2,835 calldata elements) is generated in-browser using bb.js WASM and verified on-chain by a Garaga verifier contract.

4. **Exit** — Claim BTC on Starknet or settle to native Bitcoin via an intent bridge. A gasless relayer option breaks the sender link entirely — no gas payment, no on-chain trace to the original deposit.

**Technical Innovation.**

- **On-chain ZK verification**: Real Noir circuit compiled to UltraKeccakZKHonk proof, verified by Garaga verifier on Starknet. Not mock proofs — the verifier is a deployed contract that validates every withdrawal cryptographically.
- **Browser-side proving**: Witness generation (noir_js) and proof generation (bb.js) run entirely in WASM. The server converts the proof binary to Starknet-compatible calldata but never sees secrets.
- **Dual commitment scheme**: Pedersen commitments for efficient Merkle membership proofs combined with Poseidon BN254 commitments for ZK circuit compatibility — bridging two cryptographic domains.
- **AI Strategy Agent**: Five strategy types (privacy-first, efficiency, stealth DCA, whale distribution, balanced) generate structured accumulation plans from natural language. Live pool analytics inform recommendations.
- **52 Cairo tests** covering deposits, batching, ZK withdrawals, double-spend prevention, timing delays, relayer fees, and intent escrow.

**Why Starknet.** STARK-based validity proofs provide quantum-resistant security. Garaga enables efficient on-chain verification of Noir proofs. Low gas costs make per-withdrawal ZK verification economically viable — the same flow on Ethereum L1 would cost 50-100x more.

**What We Deployed.** ShieldedPool and GaragaVerifier contracts on Sepolia with enforced ZK verification. A rate-limited relayer API. A Telegram bot (@VeilStrategistBot) for strategy planning. Complete documentation. Everything is open source.

**Impact.** Veil Protocol demonstrates that institutional-grade confidential Bitcoin accumulation is possible on Starknet today — with real ZK proofs, not trusted intermediaries.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Pool on Voyager**: https://sepolia.voyager.online/contract/0x36d381583268dc5730735a9359d467ae5094d1b8c11fad53d72497c0a3fde77
- **Verifier on Voyager**: https://sepolia.voyager.online/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: ZK proofs, confidential transactions, Garaga verifier, gasless relayer
- **Bitcoin Track**: BTC accumulation, USDC→BTC conversion, BTC intent settlement, Xverse wallet integration

## Starknet Wallet Address

(For prize distribution — fill in before submission)
