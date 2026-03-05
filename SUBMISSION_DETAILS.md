# Veil Protocol — Re{defining} Privacy on Starknet

## The Problem

Every on-chain transaction is public. When you deposit, withdraw, or move tokens — your entire financial history is exposed. Anyone can trace your wallet, analyze your strategy, and link your identities. Current privacy solutions force a choice: hide everything (and scare regulators) or expose everything (and lose your privacy).

**Veil Protocol re{defines} that choice.** We built the first Association Set Privacy Pool on Starknet — where privacy and compliance aren't enemies, they're the same thing. Deployed on mainnet with real money, not a testnet demo.

---

## How It Works

### Shield & Unveil — True ZK Privacy

Users **shield** tokens (USDC) into tiered anonymity pools ($10, $100, $1,000). A zero-knowledge proof is generated entirely **client-side** in the browser — only cryptographic commitments go on-chain. The deposit becomes indistinguishable from every other deposit in the same tier.

To withdraw, users **unveil** using a private note. The protocol verifies the ZK proof on-chain via a **Garaga verifier** without revealing which deposit the note corresponds to. The result: **cryptographic unlinkability** — not mixing, not tumbling, mathematically provable privacy.

**The killer feature:** Export your private note from Wallet A, import it into Wallet B, and claim your funds. Two wallets, zero connection. This is privacy that actually works.

### Gasless Transactions via AVNU Paymaster

Users pay gas fees in USDC instead of STRK through **AVNU's paymaster integration**. No need to hold a separate gas token — the experience feels like a traditional fintech app. For Cartridge Controller users (social login via Starkzap), onboarding is completely frictionless on any device.

---

## What We Re{define}

1. **Privacy ≠ Lawlessness** — Association Sets let you prove compliance without revealing transaction history. Same model proposed by Vitalik Buterin, adopted by 0xbow on Ethereum.

2. **ZK Proofs ≠ Slow** — Browser-side Noir proofs, on-chain Garaga verification (~2,835 calldata felt252), gasless relayer submission.

3. **Bitcoin on Starknet ≠ Just Wrapped Tokens** — Shielded BTC accumulation via AVNU batch swaps + native Bitcoin exit intents. strkBTC-ready from Day 1.

4. **AI ≠ Chatbot** — Privacy Strategist analyzes live pool conditions and generates optimal multi-step deposit plans. Five strategy modes.

5. **Monetization ≠ Subscriptions** — x402 micropayments: pay fractions of a cent per query, settled on-chain.

---

## AI Privacy Strategist

For users accumulating larger positions, manually picking tiers isn't optimal. Our **AI Strategist** solves this:

- Describe your goal in plain English: *"Shield $40 with maximum privacy"*
- The agent analyzes **live pool conditions** — anonymity set sizes, tier distributions, Confidentiality Strength Index (CSI)
- Generates an optimal multi-step deposit plan with temporal decorrelation
- Supports 5 strategy modes: Privacy-First, Efficiency, Stealth DCA, Whale Distribution, Balanced
- One-click execution of the entire plan

The strategist includes **risk assessment** — flagging low anonymity sets, single-tier concentration, and timing vulnerabilities before you deposit.

---

## x402 Micropayments — Premium Privacy Intelligence

We integrated the **x402 protocol** for on-chain micropayments, enabling premium features without subscriptions:

- **Deep Privacy Audit** — granular analysis of your deposit's privacy posture, costing fractions of a cent in STRK
- **Premium Strategy Analysis** — advanced tier optimization with projected CSI impact

x402 enables **pay-per-query AI intelligence** settled directly on Starknet — no API keys, no accounts, no middlemen. This is how AI services should be monetized in Web3.

---

## Starkzap SDK Integration

Veil Protocol is one of the **first applications to integrate the newly launched Starkzap SDK** for full portfolio management:

- **Token Balances** — 9 tokens (USDC, ETH, STRK, WBTC, tBTC, LBTC, wstETH, DAI, USDT) with on-chain logos
- **Send Tokens** — Transfer any token to any Starknet address
- **Multi-Token Staking** — Stake STRK to top validators (Karnot, Argent, AVNU, Braavos, Nethermind)
- **Position Management** — View staked amounts, pending rewards, unstaking status, claim rewards
- **Social Login** — Cartridge Controller for email/passkey authentication on any device — no seed phrase needed

All within a single Portfolio tab — no need to leave the app.

---

## Telegram Bot — Plan Strategies From Chat

The **Veil Strategist Bot** brings privacy planning to Telegram:

| Command | What It Does |
|---------|-------------|
| `/strategy $50 max privacy` | AI-powered deposit plan with deep link to execute |
| `/status` | Live pool analytics — anonymity sets, CSI, health score |
| `/price` | Real-time BTC price with tier conversion rates |
| `/pool` | Detailed tier breakdown with privacy strength ratings |

The bot **reads only** — it never holds keys or signs transactions. Users plan in Telegram, then execute in their own wallet via deep link.

---

## Compliance — Association Sets

Privacy doesn't mean lawlessness. Our **Compliance tab** implements Association Set verification — users can prove their funds are not associated with sanctioned addresses **without revealing their full transaction history**. Privacy and compliance, together. This is the same model strkBTC will use.

---

## Technical Architecture

| Component | Technology |
|-----------|-----------|
| Smart Contracts | Cairo 2.15 (Starknet mainnet) |
| ZK Proofs | Noir circuits, Garaga on-chain verifier |
| Frontend | Next.js 15, starknet-react, Framer Motion |
| Wallet Support | Cartridge Controller (social login via Starkzap), Argent, Braavos, Xverse (Bitcoin) |
| Gas Abstraction | AVNU Paymaster (pay in USDC) |
| Portfolio & Staking | Starkzap SDK |
| AI Engine | Deterministic strategy engine with structured card responses |
| Micropayments | x402 protocol |
| Bot | grammY framework, Telegram Bot API |
| Tests | 37 Cairo + 4 Noir + 123 Vitest = **164 total** |
| Deployment | Vercel (frontend), Oracle Cloud VM (relayer + keeper + bot) |

---

## Deployed on Mainnet

This is not a testnet demo. Veil Protocol is **live on Starknet mainnet** with real assets. Real USDC deposits, real ZK proofs, real AVNU swaps, real Garaga verification. Every feature uses real money on production infrastructure.

---

**Veil Protocol — re{defining} privacy on Starknet. Where compliance and confidentiality aren't enemies, they're the same thing.**
