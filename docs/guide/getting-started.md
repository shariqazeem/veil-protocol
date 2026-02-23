# Getting Started

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) 20+ | Frontend, relayer, Telegram bot |
| npm | Package management |
| [Scarb](https://docs.swmansion.com/scarb/) | Cairo package manager and compiler |
| [snforge](https://foundry-rs.github.io/starknet-foundry/) | Starknet testing framework |
| [Nargo](https://noir-lang.org/) | Noir ZK circuit compiler |
| [Barretenberg](https://github.com/AztecProtocol/aztec-packages) (`bb`) | ZK prover (server-side) |
| [Garaga](https://github.com/keep-starknet-strange/garaga) | Starknet calldata generator |

## Smart Contracts

```bash
cd contracts
scarb build        # Compile Cairo contracts
snforge test       # Run 37 Cairo tests
```

All 37 contract tests cover deposits, withdrawals, batch execution, Merkle tree operations, ZK proof verification, intent escrow, and privacy guarantees. The frontend has 90 additional tests (Vitest) covering API routes, components, and utilities -- 127 tests total.

## ZK Circuit

```bash
cd circuits/veil
nargo test         # Run circuit tests
nargo compile      # Compile to ACIR
nargo execute      # Generate witness (with Prover.toml)
```

## Frontend

```bash
cd frontend
npm install
npm run dev            # Starts on http://localhost:3000
```

The frontend includes an **embedded relayer** as Next.js API routes under `/api/relayer/`. This handles gasless withdrawals, batch execution, calldata conversion, and BTC intent relay without requiring a separate relayer service.

**Live app:** [https://theveilprotocol.vercel.app](https://theveilprotocol.vercel.app)

## Relayer and Keeper (scripts/)

For standalone relayer and keeper operation outside of the embedded API routes:

```bash
cd scripts
cp .env.example .env   # Add PRIVATE_KEY, ACCOUNT_ADDRESS
npm install
npm run relayer        # Starts standalone relayer on http://localhost:3001
npm run keeper         # Run batch execution keeper
```

The standalone relayer exposes:
- `POST /prove` -- Generate a ZK proof (nargo, bb, garaga pipeline)
- `POST /relay` -- Submit a gasless withdrawal transaction
- `GET /health` -- Health check with fee configuration

## Telegram Bot

```bash
cd scripts
cp .env.example .env   # Add TELEGRAM_BOT_TOKEN, POOL_ADDRESS
npm install
npm run bot            # Start the Telegram bot
```

Required environment variables:
- `TELEGRAM_BOT_TOKEN` -- Obtain from [@BotFather](https://t.me/BotFather) on Telegram
- `POOL_ADDRESS` -- ShieldedPool contract address (auto-read from `deployment.json` if available)
- `WEB_APP_URL` -- Frontend URL for deep links (default: `http://localhost:3000`)

## Using the App

### 1. Connect Wallets

Connect both:
- **Starknet wallet** (Argent or Braavos) -- for deposits and receiving WBTC
- **Bitcoin wallet** (Xverse) -- for Bitcoin identity attestation and receiving native BTC

### 2. Shield (Deposit)

1. Go to the **Shield** tab
2. Select a denomination ($1 / $10 / $100 / $1,000 USDC)
3. Approve USDC spending
4. Confirm the deposit transaction
5. **Save your encrypted note** -- you will need it for withdrawal

### 3. Wait for Batch Execution

The keeper aggregates deposits and executes a batch USDC-to-WBTC swap using live BTC pricing from CoinGecko. This happens periodically or can be triggered via the embedded relayer API.

### 4. Unveil (Withdraw)

1. Go to the **Unveil** tab
2. Load your encrypted note
3. Choose your withdrawal mode:
   - **WBTC on Starknet** -- enter a Starknet recipient address
   - **Native BTC (intent settlement)** -- enter a Bitcoin address; a solver sends BTC directly
4. Optionally enable **gasless withdrawal** (relayer pays gas)
5. The app generates a ZK proof (in-browser via bb.js WASM, or server-side)
6. Submit the withdrawal transaction
7. Assets are sent to the recipient address

### 5. AI Strategist

1. Go to the **Strategist** tab
2. Type a natural language instruction describing your goal:
   - `"Accumulate $50 in BTC, maximize privacy"`
   - `"DCA $50 over 5 deposits"`
   - `"Invest $200, spread across all pools"`
   - `"Quick $10 deposit, minimize gas"`
3. Watch the agent's real-time thinking log as it analyzes pool state and BTC price
4. Review the generated execution plan (steps, tiers, delays, estimated BTC, privacy score)
5. Approve and execute with a single wallet confirmation

### 6. Telegram Bot

Use the Telegram bot for mobile strategy planning:
- `/strategy Accumulate $50 in BTC, maximize privacy` -- streams a thinking log and generates a strategy
- `/status` -- pool state and BTC price
- `/price` -- live BTC with per-tier conversion rates
- `/pool` -- detailed protocol analytics with a link to view the contract on [Voyager](https://voyager.online)

Tap the **"Execute on Web"** button in the bot's response to deep-link into the web app with the strategy pre-loaded.

### 7. Comply (Optional)

Use the **Comply** tab to:
- Register a view key for your deposit
- Export a compliance proof (JSON) for regulators
