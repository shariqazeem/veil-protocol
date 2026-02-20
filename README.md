# Veil Protocol

Confidential Bitcoin accumulation infrastructure on Starknet.

[Live App](https://theveilprotocol.vercel.app) | [Docs](https://veilprotocol-docs.vercel.app) | [Pool on Voyager](https://sepolia.voyager.online/contract/0x36d381583268dc5730735a9359d467ae5094d1b8c11fad53d72497c0a3fde77) | [Verifier on Voyager](https://sepolia.voyager.online/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07) | Re{define} Starknet Hackathon 2026

---

## What We Built

A complete confidential accumulation pipeline deployed and verified end-to-end on Starknet Sepolia.

1. **Allocate** -- Deposit USDC into fixed tranches ($1 / $10 / $100). A Pedersen commitment and BN254 Poseidon ZK commitment are computed client-side. Only hashes are stored on-chain.
2. **Batch Execute** -- All deposits aggregate into a single USDC-to-BTC conversion via AVNU DEX aggregator at live CoinGecko prices. Individual accumulation intent is hidden within the batch.
3. **Verify** -- Zero-knowledge proof generated entirely in-browser (noir_js + bb.js WASM). Garaga verifier validates the UltraKeccakZKHonk proof on-chain (~2,835 felt252 calldata elements).
4. **Confidential Exit** -- Claim BTC on Starknet or settle to native Bitcoin via intent bridge. Gasless relayer option breaks the sender-link entirely. No cryptographic connection to the original allocation.

52 contract tests passing. Full E2E verified on Sepolia.

## Key Features

- **On-chain ZK verification** -- Noir circuit to UltraKeccakZKHonk proof, verified by Garaga on Starknet. No mock proofs.
- **AI Strategy Agent** -- Five strategy types (privacy-first, efficiency, stealth DCA, whale distribution, balanced) with natural language input and live pool analytics.
- **Telegram Bot** -- @VeilStrategistBot provides strategy planning, pool status, BTC price, and deep-link execution from Telegram.
- **Gasless withdrawals** -- Relayer submits transactions on behalf of users. No gas payment, no on-chain link to deposits.
- **BTC intent settlement** -- Lock BTC in escrow with a destination address hash. Solvers send native Bitcoin. Oracle confirms settlement on-chain.
- **In-browser ZK proving** -- bb.js WASM generates proofs entirely client-side. Secrets never leave the browser.
- **Embedded relayer** -- API routes hosted within the Next.js frontend. No separate relayer infrastructure required.
- **Live BTC pricing** -- CoinGecko price feed with CoinCap and Blockchain.info fallbacks for batch execution.

## Architecture

The protocol consists of four layers. The **Cairo contract layer** manages deposits with dual commitment schemes (Pedersen for Merkle membership, Poseidon BN254 for ZK circuit compatibility), batch execution via AVNU router, and two withdrawal paths (legacy Pedersen and ZK-private). A 20-level Merkle tree provides capacity for over 1 million commitments. The **ZK layer** uses a Noir circuit that proves knowledge of secret, blinder, and denomination without revealing them, compiled to an UltraKeccakZKHonk proof and verified on-chain by the Garaga verifier. The **relayer layer** provides gasless transaction submission and autonomous DCA execution with configurable delays. The **client layer** is a Next.js application with in-browser proof generation, dual wallet connectivity (Starknet + Bitcoin via Xverse), an embedded relayer API, and the AI strategy agent.

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x36d381583268dc5730735a9359d467ae5094d1b8c11fad53d72497c0a3fde77` |
| GaragaVerifier | `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` |
| USDC (Mock) | `0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080` |
| WBTC (Mock) | `0x00452bd5c0512a61df7c7be8cfea5e4f893cb40e126bdc40aee6054db955129e` |

## Running Locally

```
# Contracts
cd contracts && scarb build && snforge test    # 52 tests

# Frontend
cd frontend && npm install && npm run dev      # localhost:3000

# Batch executor
cd scripts && npm install && npm run keeper

# Telegram bot
cd scripts && npx tsx bot.ts                   # requires TELEGRAM_BOT_TOKEN in .env
```

## AI Strategy Agent

The Veil Strategist is a deterministic AI engine that generates structured accumulation plans from natural language input. It supports five strategy types:

- **Privacy-first** -- Routes all deposits to the tier with the highest anonymity set.
- **Efficiency** -- Selects the largest affordable tier for minimum transaction count via atomic multicall.
- **Stealth DCA** -- Randomizes deposits across tiers with extended delays for cross-pool obfuscation.
- **Whale distribution** -- Spreads deposits across all tiers to strengthen protocol-wide anonymity.
- **Balanced** -- Default mode. Selects the optimal tier based on amount and current pool state.

The agent reads live pool state (anonymity sets, pending USDC, batch count) and BTC price from CoinGecko to generate real-time strategy recommendations with projected privacy impact scores.

## Telegram Bot

@VeilStrategistBot provides a conversational interface for strategy planning.

- `/strategy <instruction>` -- Generate an accumulation plan from natural language (e.g., "/strategy $50 max privacy").
- `/status` -- Pool state, anonymity sets, BTC price, and Confidentiality Strength Index.
- `/price` -- Live BTC price with per-tier conversion rates.
- `/pool` -- Detailed protocol analytics.
- `/help` -- Command reference.

Strategies generate deep links that open the web app with pre-filled parameters for single-confirmation execution.

## Tech Stack

- **Contracts** -- Cairo 2.15, Scarb, snforge (52 tests)
- **ZK** -- Noir circuit, @aztec/bb.js (UltraKeccakZKHonk), Garaga verifier
- **Frontend** -- Next.js 15, TypeScript, Tailwind CSS, starknet.js, sats-connect (Xverse)
- **Relayer** -- Embedded Next.js API routes, starknet.js account abstraction
- **Bot** -- grammY (Telegram Bot API), deterministic strategy engine
- **DEX** -- AVNU aggregator for USDC-to-WBTC batch conversion
- **Oracle** -- CoinGecko price feed with triple fallback
- **Explorer** -- Voyager (https://sepolia.voyager.online)
- **Theme** -- Light institutional white with #FF5A00 orange accent

## License

MIT
