# Veil Protocol -- Submission

## Project Description (500 words)

### Veil Protocol: The First Intelligent Privacy Layer for Bitcoin on Starknet

**Veil Protocol is the first intelligent privacy layer for Bitcoin on Starknet** -- deployed on mainnet, not a testnet demo, with 127 tests (37 Cairo + 90 Vitest), real ZK proofs verified on-chain, and an AI agent that scores your anonymity in real-time.

**Problem.** Every DeFi transaction is public. Depositors, traders, and institutions expose their strategy, timing, and position sizes on-chain. Privacy pools exist, but they offer no guidance on *how private you actually are*. Users deposit blindly with no way to measure anonymity strength, identify timing risks, or optimize their privacy posture. Meanwhile, front-runners and chain analysts exploit this transparency.

**Solution.** Veil Protocol is production-grade privacy infrastructure deployed on Starknet mainnet. Users deposit USDC into fixed-denomination shielded pools ($10/$100/$1,000), which batch into unified conversions via AVNU DEX. Withdrawals require zero-knowledge proofs generated entirely in-browser -- each proof produces approximately 2,835 calldata elements in UltraKeccakZKHonk format. What makes Veil unique is the **AI Privacy Agent** -- a conversational interface that scores, analyzes, and optimizes your on-chain privacy in real-time using a 4-factor privacy scoring engine across 5 weighted dimensions, with premium features gated by x402 micropayments.

**How It Works.**

1. **Shield** -- Deposit USDC into standardized tranches. A Pedersen commitment (Merkle membership) and Poseidon BN254 commitment (ZK withdrawal) are computed client-side. Only hashes stored on-chain.

2. **Batch** -- Deposits aggregate into a single USDC-to-BTC swap at market price via AVNU. Individual intent is invisible within the batch.

3. **Verify** -- A Noir ZK circuit proves knowledge of the deposit secret. The proof (~2,835 calldata elements, UltraKeccakZKHonk format) is generated in-browser using bb.js WASM and verified on-chain by a Garaga verifier contract.

4. **Unveil** -- Claim WBTC with ZK proof or exit to native Bitcoin via intent settlement. Gasless relayer breaks the sender-link. x402 flat-fee option eliminates percentage-based fees.

5. **Analyze** -- The AI Privacy Agent scores every deposit across four dimensions: anonymity set size (40%), time elapsed (20%), deposits-since count (20%), and timing safety (20%). Ask "how private am I?" and receive actionable intelligence with threat detection and withdrawal recommendations.

**AI Privacy Agent.**

The Privacy Agent processes 8 distinct intents via natural language: privacy scoring, pool health analysis, deposit strategy, education, premium audits, withdrawal timing, and more. All responses include structured data cards rendered as interactive UI. Premium analysis (deep per-deposit audits, advanced strategy) is gated behind x402 micropayments -- pay 0.005 STRK per query, settled and verified on-chain. **Veil is the first privacy protocol with native HTTP 402 micropayment monetization.** The agent is also accessible via **Telegram bot** (@VeilStrategistBot) for mobile-native privacy management.

**Technical Innovation.**

- **On-chain ZK verification**: Real Noir proofs verified by Garaga on Starknet mainnet. No mocks.
- **Browser-side proving**: bb.js WASM. Secrets never leave the browser.
- **Dual commitment scheme**: Pedersen + Poseidon BN254, bridging Starknet-native and ZK domains.
- **Privacy scoring engine**: Weighted multi-factor privacy scores computed from live on-chain pool state.
- **Starkzap social login**: Cartridge Controller integration via `@cartridge/connector` — Google, email, and passkey authentication as a native wallet option alongside Argent and Braavos. Web2-friendly onboarding.
- **Starkzap DeFi dashboard**: ERC20 token balance queries (USDC, STRK, ETH, WBTC) and STRK delegation staking with validator selection — powered by Starkzap SDK token and validator presets.
- **x402 micropayment-gated APIs**: HTTP 402 for premium AI features. Pay-per-query privacy analytics.
- **127 tests**: 37 Cairo contract tests + 90 Vitest frontend tests.

**Deployed on Starknet Mainnet -- Not a Testnet Demo.** ShieldedPool and GaragaVerifier are live on Starknet mainnet with real USDC, real WBTC, and production AVNU DEX integration. Every transaction is verifiable on-chain.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: ZK proofs, shielded pools, k-anonymity, Garaga on-chain verifier, gasless relayer, AI privacy scoring, timing protection, anonymity set analysis, threat detection, privacy-optimized withdrawal recommendations
- **AI Agents Track**: Privacy Agent with 8-intent natural language processing, structured card responses, real-time on-chain analytics, per-deposit privacy scoring, pool health monitoring, strategy planning
- **Starkzap Track**: Cartridge Controller social login (Google, email, passkeys) as a native starknet-react connector, web2-friendly onboarding, DeFi dashboard with ERC20 balance queries and STRK staking delegation using Starkzap SDK presets
- **x402 Integration**: First privacy protocol with native HTTP 402 micropayment monetization, STRK on-chain settlement, x402 flat-fee relay for zero-percentage withdrawals, pay-per-query privacy audits

## Starknet Wallet Address

0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
