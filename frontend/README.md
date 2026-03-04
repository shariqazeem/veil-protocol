# Veil Protocol — Frontend

Next.js 15 frontend for Veil Protocol, a privacy-first DeFi protocol on Starknet mainnet.

[Live App](https://theveilprotocol.vercel.app) | [Root README](../README.md) | [Docs](https://veilprotocol-docs.vercel.app)

---

## Features

- **Shield** — Deposit USDC into fixed-denomination privacy pools ($10 / $100 / $1,000). Pedersen + Poseidon BN254 commitments computed client-side.
- **Unveil** — ZK-verified withdrawals via Garaga on-chain verifier. Gasless relayer option breaks sender link entirely.
- **Bitcoin Settlement** — Exit to native BTC via intent-based escrow with solver network. Address validation for P2PKH, P2SH, Bech32, and Taproot.
- **AI Privacy Agent** — Natural language chat for privacy scoring, pool health, threat detection, and strategy planning.
- **x402 Micropayments** — Premium AI analytics gated by HTTP 402 micropayments, settled on-chain via AVNU paymaster.
- **Portfolio** — View balances, staking positions, and send tokens. Manage STRK staking via StarkZap SDK.
- **Note Management** — Export/import privacy notes for cross-wallet recovery. Encrypted local storage per wallet.
- **Telegram Bot** — @VeilProtocolBot for strategy planning via chat, linking to web app for execution.

## Architecture

```
src/
├── app/              # Next.js App Router pages + API routes
│   ├── api/
│   │   ├── agent/    # AI chat, privacy scoring, x402 premium endpoints
│   │   └── relayer/  # Gasless relay, batch execution, calldata, solver
│   ├── app/          # Main application (shield, unveil, portfolio, agent)
│   └── page.tsx      # Landing page
├── components/       # React components (ShieldForm, UnveilForm, PrivacyAgent, etc.)
├── context/          # React contexts (Wallet, Toast, Telegram)
├── contracts/        # ABIs and deployed addresses
├── hooks/            # Custom hooks (useSmartSend, useGasless)
└── utils/            # Utilities (privacy, zkProver, bitcoin, x402, network)
```

## Running Locally

```bash
npm install
npm run dev          # http://localhost:3000
```

### Environment Variables

```env
NEXT_PUBLIC_RELAYER_URL=     # Relayer API base (defaults to /api/relayer)
NEXT_PUBLIC_PROVER_URL=      # ZK calldata service (defaults to /api/relayer)
RELAYER_PRIVATE_KEY=         # Starknet account key for gasless relay
ANTHROPIC_API_KEY=           # Claude API for AI Privacy Agent
TELEGRAM_BOT_TOKEN=          # Telegram bot token
```

## Tests

```bash
npm test             # Run all tests
npm test -- --watch  # Watch mode
```

## Deployed Contracts (Starknet Mainnet)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38` |
| GaragaVerifier | `0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c` |

## Tech Stack

Next.js 15, TypeScript, Tailwind CSS, starknet.js v7, noir_js + bb.js (in-browser ZK proving), x402-starknet, Framer Motion, Vitest + Testing Library.
