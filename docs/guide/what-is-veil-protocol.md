# What is Veil Protocol?

Veil Protocol is a privacy protocol on Starknet that enables private USDC-to-BTC execution with **real on-chain ZK proof verification**, an **AI Strategy Agent**, and a **Telegram bot** for planning confidential accumulation strategies.

## The Problem

On-chain privacy is table stakes -- the real question is **can you prove it without revealing anything?**

Most "privacy" protocols either:

- **Post secrets in calldata** -- any indexer can link deposits to withdrawals
- **Claim ZK proofs but skip on-chain verification** -- the proof exists but nobody checks it
- **Require gas payments** that deanonymize the withdrawer

Veil Protocol solves all three -- and adds intelligent strategy planning on top.

## What Makes This Different

| Feature | Veil Protocol | Typical Privacy Pool |
|---------|-----------|---------------------|
| **ZK proof verified on-chain** | Garaga UltraKeccakZKHonk verifier (2835 felt252 calldata) | Mock verifier or off-chain only |
| **Secrets in calldata** | Never -- only the ZK proof | Secret + blinder posted as calldata |
| **In-browser ZK proving** | bb.js WASM -- secrets never leave your browser | Server-side prover sees secrets |
| **Gasless withdrawal** | Relayer submits tx, user never signs | User pays gas (deanonymization vector) |
| **Dual-chain settlement** | WBTC on Starknet OR native BTC via intent settlement | Single chain |
| **AI Strategy Agent** | 5 strategy types, natural language input, autonomous DCA | Manual deposits only |
| **Telegram bot** | Plan and execute strategies from Telegram | No off-chain interface |
| **Compliance** | Optional view keys + exportable proofs | None |

## Protocol Flow

```
User A deposits $1 USDC   ──┐
User B deposits $10 USDC  ──┼──> Shielded Pool ──> Batch Swap (Avnu) ──> WBTC
User C deposits $100 USDC ──┘       |                                     |
                                     |                                     |
                           Pedersen Commitments                     Pro-rata shares
                           + ZK Commitments                       withdrawn privately
                           stored in Merkle Tree                  via ZK proof + relayer
                                                                         |
                                                              WBTC on Starknet
                                                              OR native BTC (intent)
```

1. **Shield** -- Pick a denomination ($1 / $10 / $100 / $1,000 USDC). Pedersen + Poseidon BN254 commitments computed client-side. Bitcoin wallet signs the commitment.

2. **Batch** -- Keeper aggregates deposits into a single USDC-to-WBTC swap via Avnu DEX, using live BTC pricing from CoinGecko. Individual intent hidden in the batch.

3. **Unveil** -- Generate a ZK proof (in-browser via bb.js WASM, or server-side via Barretenberg). Submit to `withdraw_private`. Garaga verifier validates on-chain. Receive WBTC on Starknet or native BTC via intent settlement, optionally via gasless relayer.

4. **Strategist** -- Describe your goal in natural language. The AI Strategy Agent analyzes pool state, selects one of 5 strategies, and generates an execution plan with autonomous DCA and randomized delays.

## AI Strategy Agent

The Strategist tab provides a deterministic AI agent that runs entirely client-side. It supports 5 strategy types:

| Strategy | Behavior |
|----------|----------|
| **Privacy-First** | Routes all deposits to the tier with the highest anonymity set |
| **Efficiency** | Largest affordable tier, single atomic multicall, zero delays |
| **Stealth DCA** | Randomizes across tiers with 45-180s delays for cross-pool obfuscation |
| **Whale Distribution** | Spreads across ALL tiers to strengthen protocol-wide anonymity |
| **Balanced** | Default -- optimal tier by amount with moderate timing protection |

The agent parses natural language input (e.g., "DCA $50 over 5 deposits, maximize privacy"), reads live pool state and BTC price, and generates a step-by-step execution plan.

## Telegram Bot

The Veil Strategist Telegram bot provides a mobile-first interface for:

- `/strategy <instruction>` -- Plan an accumulation strategy with streaming "thinking" output
- `/status` -- Live pool state, anonymity sets, and BTC price
- `/price` -- BTC price with per-tier conversion rates
- `/pool` -- Detailed protocol analytics

Strategies planned in Telegram can be executed on the web app via deep links.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo 2.15, OpenZeppelin Interfaces |
| ZK Circuit | Noir (Aztec), compiled to ACIR |
| ZK Prover | Barretenberg -- in-browser (bb.js WASM) or server-side (`bb` CLI) |
| On-Chain Verifier | Garaga UltraKeccakZKHonkVerifier |
| DEX | Avnu Aggregator (batch swaps) |
| BTC Settlement | Native Bitcoin via intent settlement + solver network |
| Frontend | Next.js 15, React 19, Tailwind CSS, Framer Motion |
| Embedded Relayer | Next.js API routes (`/api/relayer/*`) |
| AI Agent | Deterministic strategy engine (client-side, no external API) |
| Telegram Bot | Grammy framework with live pool state and deep links |
| Wallets | Starknet (Argent/Braavos) + Bitcoin (Xverse via sats-connect) |
| Cryptography | Pedersen (Stark), Poseidon BN254, AES-GCM |
| Testing | snforge (37 Cairo tests) + nargo (4 Noir tests) + Vitest (123 frontend tests) = **164 total** |
| Deployment | Vercel (frontend), **Starknet Mainnet** (contracts) |
| Explorer | [Voyager](https://voyager.online) |
