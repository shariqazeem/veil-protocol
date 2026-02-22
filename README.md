# Veil Protocol

Privacy infrastructure for confidential transactions on Starknet.

[Live App](https://theveilprotocol.vercel.app) | [Docs](https://veilprotocol-docs.vercel.app) | [Pool on Voyager](https://voyager.online/contract/0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38) | [Verifier on Voyager](https://voyager.online/contract/0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c) | Re{define} Starknet Hackathon 2026

---

## What We Built

A production-grade privacy protocol deployed on Starknet mainnet with real assets. Users deposit USDC into shielded pools, receive privacy-preserving withdrawals via zero-knowledge proofs, and interact with an AI Privacy Agent that scores, analyzes, and optimizes their on-chain privacy posture — with premium analysis gated by x402 micropayments.

1. **Shield** -- Deposit USDC into fixed-denomination privacy pools ($1 / $10 / $100 / $1,000). Pedersen + Poseidon BN254 commitments computed client-side. Only hashes stored on-chain.
2. **Batch** -- Deposits aggregate into a single USDC-to-BTC conversion via AVNU DEX. Individual intent is invisible within the batch.
3. **Verify** -- Zero-knowledge proof generated entirely in-browser (noir_js + bb.js WASM). Garaga verifier validates the UltraKeccakZKHonk proof on-chain (~2,835 felt252 calldata).
4. **Unveil** -- Claim WBTC with ZK proof or exit to native Bitcoin via intent bridge. Gasless relayer breaks the sender-link entirely. x402 flat-fee option for zero-percentage withdrawals.

52 contract tests + 90 frontend tests passing. Deployed on Starknet mainnet.

## Key Features

### Privacy Layer
- **On-chain ZK verification** -- Noir circuit verified by Garaga on Starknet mainnet. Real proofs, not mocks.
- **Browser-side proving** -- bb.js WASM generates proofs client-side. Secrets never leave the browser.
- **Dual commitment scheme** -- Pedersen for Merkle membership + Poseidon BN254 for ZK circuit compatibility.
- **k-Anonymity pools** -- Fixed denominations create anonymity sets. Your deposit is indistinguishable from all others in the same tier.
- **Gasless withdrawals** -- Relayer submits on-chain transactions. No gas payment, no sender link.
- **Timing protection** -- Privacy scoring penalizes immediate withdrawals, encouraging wait periods for stronger anonymity.

### AI Privacy Agent
- **Privacy Chat** -- Natural language interface for privacy questions. "How private am I?" returns scored analysis of your deposits with per-factor breakdowns.
- **Privacy Scoring Engine** -- Weighted scoring across anonymity set size (40%), time elapsed (20%), deposits-since (20%), and timing safety (20%). Real-time, on-chain data.
- **Pool Health Monitor** -- Live analysis of all 4 tiers: anonymity set sizes, active tier count, deposit diversity, and overall protocol health rating.
- **Threat Detection** -- Identifies timing correlation risks, small anonymity sets, and potential deanonymization vectors.
- **Withdrawal Recommendations** -- Per-deposit advice on optimal withdrawal timing based on current pool state.
- **Strategy Planner** -- Five deposit strategies (privacy-first, stealth DCA, whale distribution, efficiency, balanced) with projected privacy impact.

### x402 Micropayments
- **HTTP 402 Payment Protocol** -- Premium AI endpoints gated by x402-starknet micropayments. Pay-per-query, settled on-chain.
- **Premium Privacy Audit** -- Deep per-deposit analysis, threat scoring, and personalized recommendations for 0.005 STRK per audit.
- **Premium Strategy Analysis** -- Advanced BTC projections, risk scoring, and optimal entry timing for $0.01 USDC.
- **x402 Flat-Fee Relay** -- Withdraw with 0% fee by paying a flat x402 micropayment instead of the default 2% relayer fee.
- **On-chain settlement** -- Payments verified via STRK transfer receipts. No trusted intermediary.

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

The **Cairo contract layer** manages deposits with dual commitment schemes, batch execution via AVNU, and ZK-verified withdrawals. A 20-level Merkle tree supports 1M+ commitments. The **ZK layer** uses a Noir circuit compiled to UltraKeccakZKHonk proofs, verified on-chain by the Garaga verifier. The **relayer layer** provides gasless submission, x402 flat-fee relay, and DCA execution. The **AI layer** provides privacy scoring, chat-based analysis, threat detection, and x402-gated premium features. The **client layer** is a Next.js app with in-browser proving, dual wallet connectivity, and the Privacy Agent interface.

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
cd contracts && scarb build && snforge test    # 52 tests

# Frontend + API routes
cd frontend && npm install && npm run dev      # localhost:3000

# Run tests
cd frontend && npm test                        # 90 tests

# Batch executor
cd scripts && npm install && npm run keeper

# Pool seeding (mainnet)
cd scripts && npx tsx seed-pool.ts             # dry-run
cd scripts && npx tsx seed-pool.ts --execute   # live
```

## AI Privacy Agent

The Privacy Agent is a conversational AI that helps users understand and optimize their on-chain privacy. It processes 8 distinct intents:

| Intent | Example | Response |
|--------|---------|----------|
| Greeting | "hello" | Welcome message with quick-action suggestions |
| Privacy Check | "how private am I?" | Per-deposit privacy scores with factor breakdowns |
| Pool Analysis | "check pool health" | Live tier analysis, health metrics, improvement suggestions |
| Strategy | "$100 max privacy" | Structured deposit plan with projected privacy impact |
| Education | "what is a ZK proof?" | Contextual privacy/ZK education |
| Premium Audit | "deep audit" | Redirects to x402-gated premium analysis |
| Withdrawal Timing | "should I withdraw?" | Per-deposit withdrawal safety recommendations |
| General | anything else | Contextual response with pool state |

All responses include structured data cards (privacy scores, pool health, threat alerts) rendered as interactive UI elements.

## x402 API Endpoints

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/api/agent/chat` | POST | Free | AI privacy chat |
| `/api/agent/privacy-score` | GET | Free | Pool health metrics |
| `/api/agent/privacy-audit` | GET/POST | 0.005 STRK | Deep per-deposit audit |
| `/api/agent/premium-strategy` | GET/POST | $0.01 USDC | Advanced strategy analysis |
| `/api/relayer/relay` | POST | 2% or x402 flat | Gasless withdrawal relay |

## Tech Stack

- **Contracts** -- Cairo 2.15, Scarb, snforge (52 tests)
- **ZK** -- Noir circuit, @aztec/bb.js (UltraKeccakZKHonk), Garaga verifier
- **Frontend** -- Next.js 15, TypeScript, Tailwind CSS, starknet.js v7
- **Privacy AI** -- Deterministic scoring engine, 8-intent chat system, structured card responses
- **x402** -- x402-starknet for HTTP 402 micropayment-gated APIs
- **Relayer** -- Embedded Next.js API routes, gasless + x402 flat-fee paths
- **DEX** -- AVNU aggregator for USDC-to-WBTC batch conversion
- **Bot** -- grammY (Telegram Bot API), @VeilStrategistBot
- **Tests** -- 52 Cairo contract tests + 90 Vitest frontend tests (142 total)
- **Explorer** -- Voyager (https://voyager.online)

## License

MIT
