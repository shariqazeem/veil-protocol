# Deployed Contracts

All contracts are deployed on **Starknet Sepolia** testnet.

## Contract Addresses

| Contract | Address | Explorer |
|----------|---------|----------|
| **ShieldedPool** | `0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af` | [Voyager](https://sepolia.voyager.online/contract/0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af) |
| **GaragaVerifier** | `0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07` | [Voyager](https://sepolia.voyager.online/contract/0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07) |
| **USDC (Mock)** | `0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e` | [Voyager](https://sepolia.voyager.online/contract/0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e) |
| **WBTC (Mock)** | `0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769` | [Voyager](https://sepolia.voyager.online/contract/0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769) |
| **MockAvnuRouter** | `0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647` | [Voyager](https://sepolia.voyager.online/contract/0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647) |

## Deployer Account

| Field | Value |
|-------|-------|
| Address | `0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5` |
| Account Name | `veil-deployer` |
| Type | OpenZeppelin |
| Network | Starknet Sepolia |

## Constructor Parameters

The ShieldedPool was deployed with:

```
constructor(
    usdc_address:   0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e
    wbtc_address:   0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769
    owner:          0x0501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
    avnu_router:    0x0518f15d0762cd2aba314affad0ac83f0a4971d603c10e81b81fd47ceff38647
    zk_verifier:    0x00e8f49d3077663a517c203afb857e6d7a95c9d9b620aa2054f1400f62a32f07
)
```

## Interacting with Contracts

### Using sncast

```bash
# Read pending USDC
sncast --account veil-deployer \
  call --url https://api.cartridge.gg/x/starknet/sepolia \
  --contract-address 0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af \
  --function get_pending_usdc

# Read Merkle root
sncast --account veil-deployer \
  call --url https://api.cartridge.gg/x/starknet/sepolia \
  --contract-address 0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af \
  --function get_merkle_root
```

### Using starknet.js

```typescript
import { Contract, RpcProvider } from "starknet";
import { SHIELDED_POOL_ABI } from "./contracts/abi";

const provider = new RpcProvider({
  nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia",
});

const pool = new Contract(
  SHIELDED_POOL_ABI,
  "0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af",
  provider,
);

const pendingUsdc = await pool.get_pending_usdc();
const merkleRoot = await pool.get_merkle_root();
```

## Frontend Configuration

Contract addresses are stored in `frontend/src/contracts/addresses.json`:

```json
{
  "contracts": {
    "shieldedPool": "0x04918722607f83d2624e44362fab2b4fb1e1802c0760114f84a37650d1d812af",
    "usdc": "0x009ab543859047dd6043e45471d085e61957618366e153b5f83e2ed6967d7e0e",
    "wbtc": "0x0250cafe9030d5da593cc842a9a3db991a2df50c175239d4ab516c8abba68769"
  }
}
```
