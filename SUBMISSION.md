# Veil Protocol -- Submission

## Project Description (500 words)

### Veil Protocol: Privacy Infrastructure with AI-Powered Analytics on Starknet

**Problem.** Every DeFi transaction is public. Depositors, traders, and institutions expose their strategy, timing, and position sizes on-chain. Privacy pools exist, but they offer no guidance on *how private you actually are*. Users deposit blindly with no way to measure anonymity strength, identify timing risks, or optimize their privacy posture. Meanwhile, front-runners and chain analysts exploit this transparency.

**Solution.** Veil Protocol is production-grade privacy infrastructure deployed on Starknet mainnet. Users deposit USDC into fixed-denomination shielded pools ($1/$10/$100/$1,000), which batch into unified conversions via AVNU DEX. Withdrawals require zero-knowledge proofs generated entirely in-browser. What makes Veil unique is the **AI Privacy Agent** -- a conversational interface that scores, analyzes, and optimizes your on-chain privacy in real-time, with premium features gated by x402 micropayments.

**How It Works.**

1. **Shield** -- Deposit USDC into standardized tranches. A Pedersen commitment (Merkle membership) and Poseidon BN254 commitment (ZK withdrawal) are computed client-side. Only hashes stored on-chain.

2. **Batch** -- Deposits aggregate into a single USDC-to-BTC swap at market price via AVNU. Individual intent is invisible within the batch.

3. **Verify** -- A Noir ZK circuit proves knowledge of the deposit secret. The proof (~2,835 calldata elements, UltraKeccakZKHonk format) is generated in-browser using bb.js WASM and verified on-chain by a Garaga verifier contract.

4. **Unveil** -- Claim WBTC with ZK proof or exit to native Bitcoin via intent settlement. Gasless relayer breaks the sender-link. x402 flat-fee option eliminates percentage-based fees.

5. **Analyze** -- The AI Privacy Agent scores every deposit across four dimensions: anonymity set size (40%), time elapsed (20%), deposits-since count (20%), and timing safety (20%). Ask "how private am I?" and receive actionable intelligence with threat detection and withdrawal recommendations.

**AI Privacy Agent.**

The Privacy Agent processes 8 distinct intents via natural language: privacy scoring, pool health analysis, deposit strategy, education, premium audits, withdrawal timing, and more. All responses include structured data cards rendered as interactive UI. Premium analysis (deep per-deposit audits, advanced strategy) is gated behind x402 micropayments -- pay 0.005 STRK per query, settled and verified on-chain. This is the first privacy protocol with x402-native monetization.

**Technical Innovation.**

- **On-chain ZK verification**: Real Noir proofs verified by Garaga on Starknet mainnet. No mocks.
- **Browser-side proving**: bb.js WASM. Secrets never leave the browser.
- **Dual commitment scheme**: Pedersen + Poseidon BN254, bridging Starknet-native and ZK domains.
- **Privacy scoring engine**: Weighted multi-factor privacy scores computed from live on-chain pool state.
- **x402 micropayment-gated APIs**: HTTP 402 for premium AI features. Pay-per-query privacy analytics.
- **142 tests**: 52 Cairo contract tests + 90 Vitest frontend tests.

**Deployed on Mainnet.** ShieldedPool and GaragaVerifier are live on Starknet mainnet with real USDC, WBTC, and AVNU integration. This is not a testnet demo.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: ZK proofs, shielded pools, k-anonymity, Garaga on-chain verifier, gasless relayer, AI privacy scoring, timing protection, anonymity set analysis, threat detection, privacy-optimized withdrawal recommendations
- **AI Agents Track**: Privacy Agent with 8-intent natural language processing, structured card responses, real-time on-chain analytics, per-deposit privacy scoring, pool health monitoring, strategy planning
- **x402 Integration**: HTTP 402 micropayment-gated premium AI endpoints, STRK on-chain settlement, x402 flat-fee relay for zero-percentage withdrawals, pay-per-query privacy audits

## Starknet Wallet Address

0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
