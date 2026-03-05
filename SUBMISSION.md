# Veil Protocol -- Submission

## Project Description (500 words)

### Veil Protocol: Re{defining} Privacy on Starknet

**Veil Protocol is the first Association Set Privacy Pool on Starknet** — re{defining} the choice between privacy and compliance. We implement the Vitalik/0xbow Privacy Pools model with STARK-native ZK proofs, an AI Privacy Strategist, and strkBTC-ready architecture. Deployed on mainnet with real assets and 164 tests (37 Cairo + 4 Noir + 123 Vitest).

**The status quo is broken.** Privacy protocols hide everything — making regulators suspicious. Transparent DeFi exposes everything — making users vulnerable. strkBTC promises to fix this for Bitcoin on Starknet, but has zero code today. Meanwhile, nobody tells you *how private or compliant you actually are*.

**Veil re{defines} five things the ecosystem treats as trade-offs:**

1. **Privacy ≠ Lawlessness** — Our on-chain Merkle tree IS an Association Set. ZK withdrawal proofs ARE compliance proofs. Viewing keys enable selective disclosure to auditors without compromising other users. Same model Vitalik proposed, same approach 0xbow shipped on Ethereum — now on Starknet.

2. **ZK Proofs ≠ Slow** — Noir circuits generate UltraKeccakZKHonk proofs in-browser via bb.js WASM. Garaga verifies ~2,835 calldata elements on-chain. Secrets never leave your browser. Gasless relayer submits the transaction — no wallet gas limits, no sender link.

3. **Bitcoin on Starknet ≠ Wrapped Tokens** — Shielded USDC batch-converts to BTC via AVNU at market price. Exit to native Bitcoin through intent-based escrow with solver settlement. We built shielded modes, viewing keys, and STARK-native proofs before strkBTC was announced — ready for Day 1 integration.

4. **AI ≠ Chatbot** — The Privacy Strategist analyzes live pool conditions — anonymity set sizes, tier distributions, timing risks — and generates optimal multi-step deposit plans. Five modes from stealth DCA to whale distribution. Ask "shield $40 with maximum privacy" and it does the math.

5. **Monetization ≠ Subscriptions** — x402 micropayments gate premium AI analytics. Pay fractions of a cent per query, settled on-chain via AVNU paymaster. No API keys, no accounts, no middlemen. HTTP 402 is how AI services should work in Web3.

**How It Works.** Shield USDC into fixed-denomination anonymity pools ($1/$10/$100/$1K). Pedersen + Poseidon BN254 commitments computed client-side. Deposits batch-convert to BTC via AVNU. Generate a ZK proof in your browser. Unveil from a completely different wallet — two wallets, zero on-chain link. That's real cryptographic unlinkability.

**What We Built.** Cairo smart contracts (ShieldedPool + GaragaVerifier) on mainnet. Noir ZK circuits with browser-side proving. Next.js frontend with Cartridge social login (Starkzap SDK), Argent, Braavos, and Xverse Bitcoin wallet. Full portfolio management with STRK staking via Starkzap. AI Privacy Agent with 8 chat intents and compliance scoring. Telegram strategy bot. x402 micropayment-gated premium APIs. Gasless relayer. Bitcoin intent settlement. 164 tests across three languages. Everything deployed, everything real.

**Deployed on Starknet Mainnet — not a testnet demo.** Real USDC deposits, real AVNU swaps, real Garaga ZK verification. Every feature uses real money on production infrastructure.

Re{defining} privacy — where compliance and confidentiality aren't enemies, they're the same thing.

---

## Links

- **Live App**: https://theveilprotocol.vercel.app
- **GitHub**: https://github.com/shariqazeem/veil-protocol
- **Docs**: https://veilprotocol-docs.vercel.app
- **Telegram Bot**: @VeilStrategistBot

## Tracks

- **Privacy Track**: Association Set compliance (Privacy Pools model), ZK proofs verified by Garaga, shielded pools with k-anonymity, viewing keys for selective disclosure, compliance bundles, AI privacy scoring with 8+ intents, threat detection, anonymity set analysis, compliance grading, gasless relayer, timing protection, privacy-optimized withdrawal recommendations
- **Bitcoin Track**: BTC accumulation via AVNU batch swaps, intent-based native Bitcoin settlement via escrow-solver-oracle, strkBTC-ready architecture (shielded modes + viewing keys + STARK-native proofs + Bitcoin settlement built before strkBTC announcement), Bitcoin address validation (P2PKH/P2SH/Bech32/Taproot), Xverse wallet integration via sats-connect
- **Starkzap Track**: Cartridge Controller social login (email, passkeys) as a native starknet-react connector, web2-friendly onboarding on any device, DeFi portfolio dashboard with 9 token balances and logos, send any token, STRK staking delegation to top validators using Starkzap SDK, AVNU paymaster gasless UX
- **x402 Integration**: First privacy protocol with native HTTP 402 micropayment monetization, STRK on-chain settlement, x402 flat-fee relay for zero-percentage withdrawals, pay-per-query AI compliance and privacy analytics

## Starknet Wallet Address

0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
