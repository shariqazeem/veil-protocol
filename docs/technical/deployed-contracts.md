# Deployed Contracts

All contracts are deployed on **Starknet Mainnet** with real assets.

## Contract Addresses

| Contract | Address | Explorer |
|----------|---------|----------|
| **ShieldedPool** | `0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38` | [Voyager](https://voyager.online/contract/0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38) |
| **GaragaVerifier** | `0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c` | [Voyager](https://voyager.online/contract/0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c) |
| **USDC** | `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` | [Voyager](https://voyager.online/contract/0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb) |
| **WBTC** | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` | [Voyager](https://voyager.online/contract/0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac) |
| **AVNU Router** | `0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f` | [Voyager](https://voyager.online/contract/0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f) |

## Deployer Account

| Field | Value |
|-------|-------|
| Address | `0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5` |
| Account Name | `veil-deployer` |
| Type | OpenZeppelin |
| Network | Starknet Mainnet |

## Constructor Parameters

The ShieldedPool was deployed with:

```
constructor(
    usdc_address:   0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb
    wbtc_address:   0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac
    owner:          0x501262076fe5cf1748147b92761d2ef2d3a804c929718cfe02bdcda7071b1e5
    avnu_router:    0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f
    zk_verifier:    0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c
)
```

## Interacting with Contracts

### Using sncast

```bash
# Read pending USDC
sncast call \
  --url https://starknet-mainnet.public.blastapi.io/rpc/v0_7 \
  --contract-address 0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38 \
  --function get_pending_usdc

# Read Merkle root
sncast call \
  --url https://starknet-mainnet.public.blastapi.io/rpc/v0_7 \
  --contract-address 0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38 \
  --function get_merkle_root

# Read anonymity set for $10 tier
sncast call \
  --url https://starknet-mainnet.public.blastapi.io/rpc/v0_7 \
  --contract-address 0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38 \
  --function get_anonymity_set \
  --calldata 1
```

### Using starknet.js

```typescript
import { Contract, RpcProvider } from "starknet";
import { SHIELDED_POOL_ABI } from "./contracts/abi";

const provider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
});

const pool = new Contract({
  abi: SHIELDED_POOL_ABI,
  address: "0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38",
  providerOrAccount: provider,
});

const pendingUsdc = await pool.get_pending_usdc();
const merkleRoot = await pool.get_merkle_root();
const anonSet = await pool.get_anonymity_set(1); // $10 tier
```

## Frontend Configuration

Contract addresses are stored in `frontend/src/contracts/addresses.json`:

```json
{
  "network": "mainnet",
  "contracts": {
    "usdc": "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
    "wbtc": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    "avnuRouter": "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f",
    "shieldedPool": "0x318cb7bc9953b6157367a9d5175ee797f3f2b52741cf5e51743a9f5beafdd38",
    "garagaVerifier": "0x5176db82a5995bbdc3390b4f189540b0119c8d4ac8114ca7e0d5185f6f0444c"
  }
}
```
