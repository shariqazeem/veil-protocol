# Veil Protocol — Submission

## Project Description (500 words)

### Veil Protocol: Confidential Bitcoin Accumulation Infrastructure on Starknet

**Problem.** Every Bitcoin purchase on DeFi protocols is publicly visible. Institutional treasuries, funds, and individuals accumulating BTC expose their strategy, timing, and position size. Front-runners exploit this transparency. Competitors reconstruct accumulation patterns. Privacy in Bitcoin DeFi doesn't exist today.

**Solution.** Veil Protocol is a production-grade confidential Bitcoin accumulation pipeline deployed on Starknet mainnet. Users deposit USDC into fixed-denomination privacy pools, which batch into a single USDC-to-BTC conversion via AVNU DEX. Withdrawals require a zero-knowledge proof generated entirely in the browser. An intent-based Bitcoin settlement system enables trust-minimized exits to native BTC.

**How It Works.**

1. **Shield** — Deposit USDC into standardized tranches ($1/$10/$100/$1,000). A Pedersen commitment (Merkle membership) and Poseidon BN254 commitment (ZK withdrawal) are computed client-side. Only hashes stored on-chain. Optional Bitcoin wallet attestation via Xverse.

2. **Batch** — Deposits aggregate into one USDC-to-BTC swap at market price via AVNU. Individual accumulation intent is invisible within the batch.

3. **Verify** — A Noir ZK circuit proves knowledge of the deposit secret. The proof (~2,835 calldata elements, UltraKeccakZKHonk format) is generated in-browser using bb.js WASM and verified on-chain by a Garaga verifier contract.

4. **Exit** — Two paths: (a) Claim WBTC on Starknet with ZK proof, or (b) Intent-based Bitcoin settlement — lock WBTC in escrow, a solver delivers native BTC to your Bitcoin address, multi-sig oracles confirm delivery, and the solver receives the escrowed WBTC. Timeout protection ensures refund if no solver fills. Gasless relayer option breaks the sender link entirely.

**Technical Innovation.**

- **On-chain ZK verification**: Real Noir circuits verified by Garaga on Starknet mainnet. Every withdrawal is cryptographically validated — no mock proofs, no trusted backend.
- **Browser-side proving**: noir_js witness generation and bb.js proof generation run entirely in WASM. Secrets never leave the user's device.
- **Dual commitment scheme**: Pedersen for efficient Merkle proofs + Poseidon BN254 for ZK circuit compatibility — bridging Starknet-native and ZK cryptographic domains.
- **Intent-based Bitcoin settlement**: Trustless cross-chain exit using lock-solve-confirm escrow. Users specify a Bitcoin address hash (privacy-preserving), solvers compete to fill, oracles verify delivery. Fully on-chain with timeout protection.
- **AI Strategy Agent**: Five strategy types (privacy-first, stealth DCA, whale distribution, efficiency, balanced) with live pool analytics. Available via web app and Telegram bot.
- **x402 Micropayment-Gated API**: Premium AI strategy analysis behind HTTP 402 payment protocol. Users pay $0.01 USDC via x402-starknet for advanced risk scoring, per-tier analysis, BTC projections, and optimal entry timing. Settled on-chain via AVNU paymaster — the first privacy protocol with x402-native monetization.
- **52 Cairo tests** covering deposits, batching, ZK withdrawals, double-spend prevention, timing delays, relayer fees, intent escrow, and oracle consensus.

**Why Starknet.** STARK proofs provide quantum-resistant security without trusted setup. Garaga enables efficient on-chain verification of Noir proofs. Low gas costs make per-withdrawal ZK verification economically viable. Account abstraction enables gasless relayer patterns.

**Deployed on Mainnet.** ShieldedPool and GaragaVerifier contracts are live on Starknet mainnet with real USDC, WBTC, and AVNU integration. This is not a testnet demo — it's production infrastructure handling real assets.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: ZK proofs, confidential transactions, Garaga on-chain verifier, gasless relayer, anonymity sets, timing protection, x402 micropayment-gated privacy analytics
- **Bitcoin Track**: BTC accumulation pipeline, intent-based Bitcoin settlement with escrow/solver/oracle, Xverse wallet integration, BTC identity attestation
- **x402 Integration**: HTTP 402 payment protocol for premium AI strategy endpoints, AVNU paymaster settlement, privacy-preserving micropayments

## Starknet Wallet Address

0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
