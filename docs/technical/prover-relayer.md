# Prover & Relayer Service

The prover/relayer is a Node.js HTTP service that handles ZK proof generation and gasless transaction submission.

**Location**: `scripts/relayer.ts`

## Endpoints

### POST /prove

Generates a ZK proof from private inputs.

**Request**:
```json
{
  "secret": "12345",
  "blinder": "67890",
  "denomination": 1
}
```

**Pipeline**:

```
1. Compute zk_commitment = Poseidon_BN254(secret, blinder, denomination)
2. Compute nullifier = Poseidon_BN254(secret, 1)
3. Write Prover.toml with all values
4. nargo execute → witness generation
5. bb prove → UltraKeccakZKHonk proof (7KB binary)
6. bb write_vk → verification key
7. garaga calldata → 2835 felt252 values
8. Return hex-encoded array
```

**Response**:
```json
{
  "proof": ["0x1a2b...", "0x3c4d...", ...],
  "zkCommitment": "0xabcd...",
  "zkNullifier": "0xef01..."
}
```

**Timing**: ~10-30 seconds depending on hardware.

### POST /relay

Submits a gasless withdrawal transaction via `sncast`.

**Request**:
```json
{
  "calldata": ["0x01", "0x02", ...],
  "entrypoint": "withdraw_private_via_relayer"
}
```

**Execution**:
```bash
sncast --account veil-deployer --json invoke \
  --url https://api.cartridge.gg/x/starknet/sepolia \
  --contract-address <POOL_ADDRESS> \
  --function withdraw_private_via_relayer \
  --calldata <...all felt252 values...>
```

**Response**:
```json
{
  "txHash": "0x0201cdeba82f..."
}
```

The relayer waits for transaction confirmation before responding.

### GET /health

```json
{
  "status": "ok",
  "fee_bps": 200,
  "pool": "0x041f449d..."
}
```

## Configuration

Environment variables (`.env`):

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer/relayer private key |
| `ACCOUNT_ADDRESS` | Deployer/relayer account address |
| `POOL_ADDRESS` | ShieldedPool contract address |
| `RPC_URL` | Starknet RPC endpoint |

## CLI Tool Paths

The service uses three CLI tools:

| Tool | Default Path | Purpose |
|------|-------------|---------|
| `nargo` | `~/.nargo/bin/nargo` | Witness generation |
| `bb` | `~/.bb/bb` | Proof generation |
| `garaga` | `/opt/homebrew/bin/garaga` | Calldata conversion |

## Privacy Considerations

::: warning Server-Side Prover
In the hackathon version, the prover sees the `secret` and `blinder` temporarily in memory during proof generation. These values are **never persisted** to disk or logs.

In production, proof generation would run **in-browser** using:
- `@noir-lang/noir_js` — Noir WASM runtime
- `@aztec/bb.js` — Barretenberg WASM prover

The critical guarantee holds in both cases: **secrets never appear in on-chain calldata**.
:::

## Gasless Flow

```
User                    Relayer                 Starknet
  │                        │                        │
  ├─ POST /prove ─────────▶│                        │
  │  (secret, blinder)     │                        │
  │                        ├─ nargo/bb/garaga ──────│
  │◀─ proof[2835] ─────────┤                        │
  │                        │                        │
  ├─ POST /relay ─────────▶│                        │
  │  (calldata)            ├─ sncast invoke ───────▶│
  │                        │                        ├─ Garaga verify
  │                        │                        ├─ Nullifier check
  │                        │                        ├─ Merkle check
  │                        │                        ├─ WBTC → recipient
  │                        │◀─ tx confirmed ────────┤
  │◀─ { txHash } ─────────┤                        │
  │                        │                        │
```

The user never signs a transaction. The relayer pays gas. The ZK proof is the only authorization needed.
