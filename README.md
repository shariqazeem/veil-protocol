# Veil Protocol — Re{defining} Privacy on Starknet

Privacy protocols force you to choose: hide everything (and scare regulators) or expose everything (and lose your privacy). Veil Protocol re{defines} that choice.

We built the **first Association Set Privacy Pool on Starknet** — implementing the Vitalik/0xbow Privacy Pools compliance model with STARK-native ZK proofs. You get mathematically provable privacy AND selective compliance disclosure. Not one or the other — both.

Deployed on **Starknet mainnet** with real assets. Not a testnet demo.

[Live App](https://theveilprotocol.vercel.app) | [Demo Video](https://youtu.be/Oc4nk4HWEZA) | [Docs](https://veilprotocol-docs.vercel.app) | [Pool on Voyager](https://voyager.online/contract/0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38) | [Verifier on Voyager](https://voyager.online/contract/0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c)

**Re{define} Starknet Hackathon 2026** — Privacy + Bitcoin + x402 + Starkzap Tracks

---

## What We Re{define}

1. **Privacy ≠ Lawlessness** — Association Sets let you prove compliance without revealing transaction history. Same model proposed by Vitalik Buterin, adopted by 0xbow on Ethereum.

2. **ZK Proofs ≠ Slow** — Browser-side Noir proofs via bb.js WASM, on-chain Garaga verification (~2,835 calldata felt252), gasless relayer submission. Real proofs, not mocks.

3. **Bitcoin on Starknet ≠ Just Wrapped Tokens** — Shielded BTC accumulation via AVNU batch swaps + native Bitcoin exit intents via escrow-solver-oracle. strkBTC-ready from Day 1.

4. **AI ≠ Chatbot** — Privacy Strategist analyzes live pool conditions, anonymity sets, and timing to generate optimal deposit plans. Five strategy modes from stealth DCA to whale distribution.

5. **Monetization ≠ Subscriptions** — x402 micropayments: pay fractions of a cent per query, settled on-chain via AVNU paymaster. No API keys, no accounts.

---

## How It Works

1. **Shield** — Deposit USDC into fixed-denomination privacy pools ($1 / $10 / $100 / $1,000). Pedersen + Poseidon BN254 commitments computed client-side. Only hashes stored on-chain.

2. **Batch** — Deposits aggregate into a single USDC-to-BTC conversion via AVNU DEX. Individual intent is invisible within the batch.

3. **Verify** — Zero-knowledge proof generated entirely in-browser (noir_js + bb.js WASM). Garaga verifier validates the UltraKeccakZKHonk proof on-chain.

4. **Comply** — Viewing keys enable selective disclosure to auditors. Association Set membership proof without revealing transaction history.

5. **Unveil** — Claim WBTC with ZK proof or exit to native Bitcoin via intent bridge. Gasless relayer breaks the sender-link entirely. x402 flat-fee option for zero-percentage withdrawals.

**The killer feature:** Export your private note from Wallet A, import it into Wallet B, and claim your funds. Two wallets. Zero on-chain connection. That's Veil.

164 tests passing (37 Cairo + 4 Noir + 123 Vitest). Deployed on Starknet mainnet.

---

## Key Features

### Privacy Layer
- **Association Set Privacy Pool** — First implementation of the Buterin/0xbow Privacy Pools compliance model on Starknet
- **On-chain ZK verification** — Noir circuit verified by Garaga on Starknet mainnet. Real proofs, not mocks.
- **Browser-side proving** — bb.js WASM generates proofs client-side. Secrets never leave the browser.
- **Dual commitment scheme** — Pedersen for Merkle membership + Poseidon BN254 for ZK circuit compatibility.
- **k-Anonymity pools** — Fixed denominations create anonymity sets. Your deposit is indistinguishable from all others in the same tier.
- **Gasless withdrawals** — Relayer submits on-chain transactions. No gas payment, no sender link.
- **Timing protection** — Privacy scoring penalizes immediate withdrawals, encouraging wait periods for stronger anonymity.

### AI Privacy Agent
- **Privacy Chat** — Natural language interface for privacy questions. "How private am I?" returns scored analysis of your deposits with per-factor breakdowns.
- **Privacy Scoring Engine** — Weighted scoring across anonymity set size (40%), time elapsed (20%), deposits-since (20%), and timing safety (20%).
- **Pool Health Monitor** — Live analysis of all 4 tiers: anonymity set sizes, active tier count, deposit diversity, and overall protocol health rating.
- **Threat Detection** — Identifies timing correlation risks, small anonymity sets, and potential deanonymization vectors.
- **Withdrawal Recommendations** — Per-deposit advice on optimal withdrawal timing based on current pool state.
- **Strategy Planner** — Five deposit strategies (privacy-first, stealth DCA, whale distribution, efficiency, balanced) with projected privacy impact.

### x402 Micropayments
- **HTTP 402 Payment Protocol** — Premium AI endpoints gated by x402-starknet micropayments. Pay-per-query, settled on-chain.
- **Premium Privacy Audit** — Deep per-deposit analysis, threat scoring, and personalized recommendations for 0.005 STRK per audit.
- **Premium Strategy Analysis** — Advanced BTC projections, risk scoring, and optimal entry timing for $0.01 USDC.
- **x402 Flat-Fee Relay** — Withdraw with 0% fee by paying a flat x402 micropayment instead of the default 2% relayer fee.

### Bitcoin Integration
- **BTC Accumulation** — USDC deposits batch-convert to WBTC via AVNU at market price
- **Native Bitcoin Exit** — Intent-based escrow with solver network for native BTC settlement
- **Bitcoin Wallet** — Xverse (sats-connect) integration for Bitcoin identity linking
- **Address Validation** — P2PKH, P2SH, Bech32, and Taproot address validation

### Starkzap SDK Integration
- **Portfolio Dashboard** — 9 token balances with on-chain logos
- **Send Tokens** — Transfer any token to any Starknet address
- **STRK Staking** — Stake to top validators (Karnot, Argent, AVNU, Braavos, Nethermind)
- **Social Login** — Cartridge Controller for email/passkey authentication — no seed phrase, any device

---

## Architecture

```
                          +-------------------+
                          |   Privacy Agent   |
                          |  (AI Chat + x402) |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |   Next.js Frontend |
                          |  + Embedded APIs   |
                          +--------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
    +---------v------+   +--------v-------+   +--------v-------+
    |  ZK Layer      |   |  Relayer       |   |  Scoring       |
    |  noir_js/bb.js |   |  Gasless + x402|   |  Engine        |
    |  (browser WASM)|   |  (API routes)  |   |  (on-chain)    |
    +---------+------+   +--------+-------+   +--------+-------+
              |                    |                    |
              +--------------------+--------------------+
                                   |
                          +--------v----------+
                          |  Cairo Contracts  |
                          |  ShieldedPool +   |
                          |  Garaga Verifier  |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |  Starknet Mainnet |
                          +-------------------+
```

---

## Deployed Contracts (Starknet Mainnet)

| Contract | Address |
|----------|---------|
| ShieldedPool | `0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38` |
| GaragaVerifier | `0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c` |
| USDC | `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` |
| WBTC | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` |
| AVNU Router | `0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f` |

## Running Locally

```bash
# Contracts
cd contracts && scarb build && snforge test    # 37 Cairo tests

# ZK Circuits
cd circuits/ghostsats && nargo test            # 4 Noir tests

# Frontend + API routes
cd frontend && npm install && npm run dev      # localhost:3000

# Run tests
cd frontend && npm test                        # 123 Vitest tests

# Batch executor
cd scripts && npm install && npm run keeper

# Pool seeding (mainnet)
cd scripts && npx tsx seed-pool.ts             # dry-run
cd scripts && npx tsx seed-pool.ts --execute   # live
```

## x402 API Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/agent/chat` | POST | Free | AI privacy chat |
| `/api/agent/privacy-score` | GET | Free | Pool health metrics |
| `/api/agent/privacy-audit` | GET/POST | 0.005 STRK | Deep per-deposit audit |
| `/api/agent/premium-strategy` | GET/POST | $0.01 USDC | Advanced strategy analysis |
| `/api/relayer/relay` | POST | 2% or x402 flat | Gasless withdrawal relay |

## Tech Stack

- **Contracts** — Cairo 2.15, Scarb, snforge (37 Cairo tests)
- **ZK** — Noir circuit, @aztec/bb.js (UltraKeccakZKHonk), Garaga verifier (4 circuit tests)
- **Frontend** — Next.js 15, TypeScript, Tailwind CSS, starknet.js v7 (123 Vitest tests)
- **Privacy AI** — Deterministic scoring engine, 8-intent chat system, structured card responses
- **x402** — x402-starknet for HTTP 402 micropayment-gated APIs
- **Relayer** — Embedded Next.js API routes, gasless + x402 flat-fee paths
- **DEX** — AVNU aggregator for USDC-to-WBTC batch conversion
- **Portfolio** — Starkzap SDK for token balances, send, STRK staking
- **Social Login** — Cartridge Controller (email, passkeys) via Starkzap
- **Bot** — grammY (Telegram Bot API), @VeilProtocolBot
- **Tests** — 37 Cairo + 4 Noir + 123 Vitest = **164 total tests**
- **Explorer** — Voyager (https://voyager.online)

## License

MIT
