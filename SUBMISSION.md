# Veil Protocol -- Submission

## Project Description (500 words)

### Veil Protocol: The First Association Set Privacy Pool on Starknet

**Veil Protocol is the first Association Set privacy pool on Starknet** — implementing the Vitalik/0xbow Privacy Pools compliance model with STARK-native ZK proofs, AI-powered privacy scoring, and strkBTC-ready architecture. Deployed on mainnet with 127 tests (37 Cairo + 90 Vitest), real ZK proofs verified on-chain, and a full compliance portal.

**Problem.** Privacy and compliance are treated as opposites. Privacy pools hide everything — making regulators nervous. Transparent DeFi exposes everything — making users vulnerable. strkBTC promises to solve this for Bitcoin on Starknet, but has zero code today. Meanwhile, existing privacy protocols offer no guidance on *how private or compliant you actually are*.

**Solution: Privacy Pools on Starknet.** Veil Protocol implements the Privacy Pools model (Buterin, Soleimani et al. 2023) — the same compliance framework adopted by 0xbow on Ethereum. Every deposit enters an on-chain Merkle tree that functions as an **Association Set** — a set of verified, compliant commitments. At withdrawal, users generate ZK inclusion proofs that simultaneously prove pool membership and fund ownership without revealing which deposit is theirs. This is the gold standard for compliant privacy.

**How It Works.**

1. **Shield** — Deposit USDC into standardized tiers ($1/$10/$100/$1K). A Pedersen commitment (Merkle membership) and Poseidon BN254 commitment (ZK withdrawal) are computed client-side. The deposit enters the Association Set.

2. **Batch** — Deposits aggregate into a single USDC-to-BTC swap at market price via AVNU. Individual intent is invisible within the batch.

3. **Prove** — A Noir ZK circuit proves knowledge of the deposit secret and membership in the Association Set. The proof (~2,835 calldata elements, UltraKeccakZKHonk format) is generated in-browser using bb.js WASM and verified on-chain by a Garaga verifier contract.

4. **Comply** — Viewing keys enable selective disclosure: prove specific deposits to auditors without compromising other users. Generate compliance bundles with Association Set membership proof, viewing key hash, and deposit metadata. This is the same compliance model strkBTC will use.

5. **Exit** — Claim WBTC with ZK proof or exit to native Bitcoin via intent settlement. Gasless relayer breaks the sender-link. x402 flat-fee option eliminates percentage-based fees.

**What Makes Veil Unique.**

- **Association Set Compliance (Privacy Pools)**: First implementation of the Buterin/0xbow Privacy Pools model on Starknet. Our Merkle tree IS the Association Set. ZK proofs ARE inclusion proofs. This was our architecture from Day 1 — before Privacy Pools was published.
- **strkBTC-Ready**: We independently built shielded/unshielded dual modes, viewing keys, selective disclosure, and STARK-native proofs before strkBTC was announced. Ready for Day 1 integration.
- **AI Privacy Agent with Compliance Intelligence**: 10+ intents including compliance scoring, Association Set status checks, strkBTC readiness assessment, privacy scoring, threat detection, and withdrawal timing. Premium analysis gated by x402 micropayments.
- **EY Nightfall-Compatible**: Our compliance model (viewing keys + selective disclosure + association sets) aligns with Nightfall's enterprise privacy approach.
- **Tongo-Compatible Architecture**: Our shielded pool design is compatible with Tongo's confidential ERC-20 model for future ElGamal integration.
- **On-chain ZK verification**: Real Noir proofs verified by Garaga on Starknet mainnet. No mocks.
- **Browser-side proving**: bb.js WASM. Secrets never leave the browser.
- **Starkzap social login**: Cartridge Controller integration — Google, email, and passkey authentication.
- **AVNU Paymaster (gasless)**: Users pay gas in USDC instead of STRK.
- **x402 micropayment-gated APIs**: HTTP 402 for premium AI compliance and privacy analytics.
- **127 tests**: 37 Cairo contract tests + 90 Vitest frontend tests.

**Deployed on Starknet Mainnet — Not a Testnet Demo.** ShieldedPool and GaragaVerifier are live on Starknet mainnet with real USDC, real WBTC, and production AVNU DEX integration.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: Association Set compliance (Privacy Pools model), ZK proofs verified by Garaga, shielded pools with k-anonymity, viewing keys for selective disclosure, compliance bundles, AI privacy scoring with 10+ intents, threat detection, anonymity set analysis, compliance grading, gasless relayer, timing protection, privacy-optimized withdrawal recommendations
- **Bitcoin Track**: BTC conversion via AVNU, intent-based native Bitcoin settlement via escrow-solver-oracle, strkBTC-ready architecture (shielded modes + viewing keys + STARK-native proofs + Bitcoin settlement built before strkBTC announcement), shielded portfolio dashboard
- **Starkzap Track**: Cartridge Controller social login (Google, email, passkeys) as a native starknet-react connector, web2-friendly onboarding, DeFi dashboard with ERC20 balance queries and STRK staking delegation using Starkzap SDK presets, AVNU paymaster gasless UX
- **x402 Integration**: First privacy protocol with native HTTP 402 micropayment monetization, STRK on-chain settlement, x402 flat-fee relay for zero-percentage withdrawals, pay-per-query AI compliance and privacy analytics

## Starknet Wallet Address

0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
