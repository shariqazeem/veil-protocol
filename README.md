# GhostSats

> **Private USDC-to-WBTC execution on Starknet with real on-chain ZK proof verification.**
>
> Secrets never appear in calldata. A Noir ZK circuit proves deposit knowledge. The Garaga UltraKeccakZKHonk verifier validates the proof on-chain. Gasless relayer breaks the sender-link entirely.

**[Live Demo](https://ghostsats.vercel.app)** &nbsp;&middot;&nbsp; **[Explorer](https://sepolia.starkscan.co/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af)** &nbsp;&middot;&nbsp; **[ZK Verifier](https://sepolia.starkscan.co/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07)** &nbsp;&middot;&nbsp; **[Docs](https://ghostsats-docs.vercel.app)** &nbsp;&middot;&nbsp; Built for [Re{define} Starknet Hackathon 2026](https://dorahacks.io/)

---

## The Problem

On-chain privacy is table stakes — the real question is **can you prove it without revealing anything?**

Most "privacy" protocols either:
- Post secrets in calldata (any indexer can link deposits to withdrawals)
- Claim ZK proofs but skip on-chain verification (the proof exists but nobody checks it)
- Require gas payments that deanonymize the withdrawer

GhostSats solves all three.

---

## What Makes This Different

| Feature | GhostSats | Typical Privacy Pool |
|---------|-----------|---------------------|
| **ZK proof verified on-chain** | Garaga UltraKeccakZKHonk verifier (2835 felt252 calldata) | Mock verifier or off-chain only |
| **Secrets in calldata** | Never — only the ZK proof | Secret + blinder posted as calldata |
| **Gasless withdrawal** | Relayer submits tx, user never signs | User pays gas (deanonymization vector) |
| **Dual-chain identity** | Starknet wallet + Bitcoin wallet (Xverse) | Single chain |
| **Compliance** | Optional view keys + exportable proofs | None |

### The ZK Proof Pipeline (Working End-to-End)

```
Deposit:
  Browser computes:
    Pedersen commitment = H(H(0, amount_hash), secret_hash)     [Stark field]
    ZK commitment = Poseidon_BN254(secret, blinder, denomination) [BN254 field]
  → deposit_private(commitment, denomination, btc_identity, zk_commitment)

Withdrawal:
  Browser → POST /prove to prover service
    ├── nargo execute    → witness generation
    ├── bb prove         → UltraKeccakZKHonk proof (7KB binary)
    └── garaga calldata  → 2835 felt252 values (proof + MSM/KZG hints)
  → withdraw_private(denomination, zk_nullifier, zk_commitment, proof[2835], ...)
    ├── Garaga verifier validates proof on-chain
    ├── Public inputs verified: commitment, nullifier, denomination match
    ├── Nullifier marked spent (no double-spend)
    ├── Merkle proof verified for Pedersen commitment
    └── WBTC transferred to recipient

Key guarantee: secret and blinder NEVER appear in on-chain calldata
```

---

## How It Works

```
  User A deposits 1,000 USDC ──┐
  User B deposits 1,000 USDC ──┼──▶ Shielded Pool ──▶ Batch Swap (Avnu DEX) ──▶ WBTC
  User C deposits 1,000 USDC ──┘       │                                          │
                                        │                                          │
                              Pedersen Commitments                          Pro-rata shares
                              + ZK Commitments                           withdrawn privately
                              stored in Merkle Tree                      via ZK proof + relayer
                                        │
                                        ▼
                               On-chain Merkle Root
```

1. **Shield**: Pick a denomination (100 / 1,000 / 10,000 USDC). A Pedersen commitment + BN254 Poseidon ZK commitment are computed client-side. Bitcoin wallet signs the commitment. Only hashes stored on-chain.

2. **Batch**: Keeper aggregates all deposits → single USDC→WBTC swap via Avnu. Individual intent hidden in the batch.

3. **Unveil** (after 60s cooldown): Generate a ZK proof via prover service (nargo → bb → garaga). Submit to `withdraw_private` — Garaga verifier validates on-chain. WBTC sent to any address. Optionally via gasless relayer (you never sign).

### Why Gasless Matters for Privacy

Without the relayer, your wallet signs the withdrawal tx → on-chain link between depositor and withdrawer. With the relayer:
- The relayer's address appears as tx sender, not yours
- You never sign anything — the ZK proof is your authorization
- No gas payment from your wallet = no on-chain footprint

---

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| ShieldedPool | [`0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af`](https://sepolia.starkscan.co/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af) |
| GaragaVerifier | [`0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07`](https://sepolia.starkscan.co/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07) |
| USDC (Mock) | [`0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e`](https://sepolia.starkscan.co/contract/0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e) |
| WBTC (Mock) | [`0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769`](https://sepolia.starkscan.co/contract/0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769) |
| MockAvnuRouter | [`0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647`](https://sepolia.starkscan.co/contract/0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647) |

---

## Test Coverage (40 Tests Passing)

```bash
cd contracts && snforge test
# Tests: 40 passed, 0 failed, 0 ignored, 0 filtered out
```

**Core Engine (13 tests)** — Denominations, deposits, batch execution, Merkle tree, anonymity sets, BTC identity binding

**Withdrawal (16 tests)** — Full deposit→execute→withdraw flow, invalid preimage rejection, double-spend prevention, timing delay, relayer fees, exchange rates, BTC intent

**ZK Privacy (11 tests)** — `deposit_private` → `withdraw_private` full flow, ZK double-spend rejection, wrong commitment rejection, timing delay, relayer fee calculation, backward compatibility with legacy deposits, duplicate commitment rejection, BTC identity with ZK, zero commitment rejection

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 16 + React 19 + starknet.js)            │
│                                                              │
│  Landing → /app (WalletBar + Dashboard + Shield/Unveil/     │
│                   Comply tabs + Transaction History)          │
│                                                              │
│  Privacy Utils:                                              │
│  - Pedersen commitment (Stark field)                         │
│  - Poseidon BN254 ZK commitment (via poseidon-lite)          │
│  - Merkle proof construction                                 │
│  - AES-GCM encrypted note storage                            │
│  - BTC attestation (signMessage via sats-connect/Xverse)     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  PROVER + RELAYER SERVICE (Node.js, port 3001)              │
│                                                              │
│  POST /prove  → nargo execute → bb prove → garaga calldata  │
│                  (witness)     (UltraHonk)  (2835 felt252s)  │
│  POST /relay  → starknet.js invoke withdraw_private_via_relayer│
│  GET  /health → { status: ok, fee_bps: 200 }                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  SMART CONTRACTS (Cairo 2.15 on Starknet Sepolia)           │
│                                                              │
│  ShieldedPool.cairo                                          │
│  ├── deposit_private(commitment, denom, btc_id, zk_commit)  │
│  ├── execute_batch(min_wbtc_out, routes)                     │
│  ├── withdraw_private(denom, nullifier, commit, proof[2835], │
│  │                    merkle_path, indices, recipient, ...)   │
│  ├── withdraw_private_via_relayer(... + relayer, fee_bps)    │
│  └── register_view_key(commitment, view_key_hash)            │
│                                                              │
│  GaragaVerifier (UltraKeccakZKHonkVerifier)                  │
│  └── verify_ultra_keccak_zk_honk_proof(proof) → Result       │
│                                                              │
│  Noir Circuit (circuits/ghostsats/src/main.nr)               │
│  ├── zk_commitment = Poseidon_BN254(secret, blinder, denom)  │
│  └── nullifier = Poseidon_BN254(secret, 1)                   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo 2.15, OpenZeppelin Interfaces |
| ZK Circuit | Noir (Aztec), compiled to ACIR |
| ZK Prover | Barretenberg (`bb`) — UltraKeccakZKHonk |
| On-Chain Verifier | Garaga UltraKeccakZKHonkVerifier |
| DEX | Avnu Aggregator (batch swaps) |
| Frontend | Next.js 16, React 19, Tailwind 4, Framer Motion |
| Wallets | Starknet (Argent/Braavos) + Bitcoin (Xverse via sats-connect) |
| Cryptography | Pedersen (Stark), Poseidon BN254, AES-GCM |
| Testing | snforge 0.56.0 (40 passing tests) |
| Deployment | Vercel (frontend), Starknet Sepolia (contracts) |

## Privacy Guarantees

| Property | Mechanism |
|----------|-----------|
| **Deposit unlinkability** | Fixed denominations — all deposits in a tier are indistinguishable |
| **Withdrawal unlinkability** | ZK proof + different recipient address + optional gasless relayer |
| **No secrets in calldata** | Noir ZK circuit proves knowledge; Garaga verifier validates on-chain |
| **Double-spend prevention** | Nullifier set: `Poseidon(secret, 1)` — marked spent on first use |
| **Merkle membership** | 20-level Pedersen Merkle tree (1M+ capacity) |
| **Timing protection** | 60-second minimum delay blocks deposit→withdraw attacks |
| **Gasless withdrawal** | Relayer pays gas, breaks sender-link (2% fee, 5% cap) |
| **Bitcoin identity** | BTC wallet signs commitment; Pedersen hash stored on-chain |
| **Note encryption** | AES-GCM with wallet-derived key (client-side) |
| **Compliance** | Optional view keys + exportable JSON proofs |

## Security Model

### Protected Against
- On-chain balance tracking (no public balance mapping)
- Deposit-withdrawal linking (ZK proofs + different recipient + relayer)
- Double-spending (nullifier set)
- Front-running (batch execution, not individual trades)
- Note theft from browser (AES-GCM encryption)
- Timing attacks (60s minimum withdrawal delay)
- Gas-based deanonymization (relayer-powered gasless withdrawals)
- Proof replay attacks (public inputs validated against parameters on-chain)
- BN254→felt252 overflow (values reduced modulo STARK_PRIME)

### Known Limitations (Hackathon Scope)
- **Proof generation is server-side** — The prover service runs nargo/bb/garaga CLI tools. In production, this runs in-browser via `@noir-lang/noir_js` + `@aztec/bb.js` WASM. The prover sees secrets temporarily in memory (never persisted). The critical guarantee holds: secrets never appear in on-chain calldata.
- **Mock tokens** — USDC/WBTC are MockERC20 on Sepolia.
- **Keeper centralization** — Batch executor is currently single-owner. Decentralized keeper networks are the next step.

## Running Locally

### Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) (Cairo), [snforge](https://foundry-rs.github.io/starknet-foundry/) (testing)
- [Nargo](https://noir-lang.org/) (Noir), [Barretenberg](https://github.com/AztecProtocol/aztec-packages) (`bb`)
- [Garaga](https://github.com/keep-starknet-strange/garaga) CLI
- Node.js 20+

### Smart Contracts
```bash
cd contracts
scarb build && snforge test   # 40 tests
```

### ZK Circuit
```bash
cd circuits/ghostsats
nargo test && nargo compile && nargo execute
```

### Prover + Relayer
```bash
cd scripts
cp .env.example .env   # Add PRIVATE_KEY, ACCOUNT_ADDRESS
npm install && npm run relayer   # http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install && npm run dev   # http://localhost:3000
```

## Hackathon Tracks

- **Privacy**: ZK proofs verified on-chain (Garaga), Pedersen commitments, Merkle proofs, nullifier set, gasless relayer, timing protection, anonymity sets, compliance portal
- **Bitcoin**: Private USDC→WBTC via Avnu, dual wallet (Starknet + Bitcoin/Xverse), BTC identity binding, Bitcoin attestation (sign Merkle root), cross-chain withdrawal intents

## End-to-End Verified on Sepolia

The full pipeline has been verified end-to-end on Starknet Sepolia:

```
npm run e2e

Shield (deposit_private)
  ├── Pedersen commitment + BN254 Poseidon ZK commitment    [on-chain]
  ├── Bitcoin wallet signature                               [attestation]
  └── tx confirmed on Sepolia

Batch (execute_batch)
  ├── USDC → WBTC swap via Avnu DEX
  ├── 100 USDC → 0.00141809 WBTC
  └── tx confirmed on Sepolia

Privacy Cooldown
  └── 60-second minimum delay enforced

ZK Proof Generation
  ├── nargo execute    → witness
  ├── bb prove         → UltraKeccakZKHonk (7KB binary)
  ├── garaga calldata  → 2835 felt252 values
  └── Generated in 5.5 seconds

Withdraw (withdraw_private)
  ├── ZK proof submitted on-chain (2835 calldata elements)
  ├── Garaga verifier validated proof
  ├── Nullifier marked spent (no replay possible)
  ├── WBTC transferred to recipient
  └── tx confirmed on Sepolia
```

## License

MIT
