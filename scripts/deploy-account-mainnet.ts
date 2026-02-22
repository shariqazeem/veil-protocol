/**
 * Deploy the OZ account contract on Starknet mainnet.
 * The account was originally created on Sepolia with a custom salt.
 * The class hash already exists on mainnet, so we just need to send a DEPLOY_ACCOUNT tx.
 */
import { Account, RpcProvider, CallData, constants } from 'starknet';
import 'dotenv/config';

const CLASS_HASH = '0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564';
const SALT = '0xe0859f1191d5a411';
const PUBLIC_KEY = '0x6323fefb67e8c2f11c2a82f56368f6db5bede9e7c4ff9c4e0f77603592f10e';

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const accountAddress = process.env.ACCOUNT_ADDRESS!;
  const rpcUrl = 'https://starknet-rpc.publicnode.com';

  console.log('Connecting to Starknet Mainnet...');
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const chainId = await provider.getChainId();
  console.log('Chain ID:', chainId);

  const constructorCalldata = CallData.compile({ public_key: PUBLIC_KEY });
  console.log('Account address:', accountAddress);
  console.log('Class hash:', CLASS_HASH);
  console.log('Salt:', SALT);

  const account = new Account(
    provider, accountAddress, privateKey,
    undefined, constants.TRANSACTION_VERSION.V3,
  );

  console.log('\nDeploying account on mainnet...');
  const { transaction_hash, contract_address } = await account.deployAccount({
    classHash: CLASS_HASH,
    constructorCalldata,
    addressSalt: SALT,
  });

  console.log('Deploy tx:', transaction_hash);
  console.log('Contract address:', contract_address);
  console.log('Waiting for confirmation...');
  await provider.waitForTransaction(transaction_hash);
  console.log('\nAccount deployed successfully on mainnet!');
}

main().catch((err) => {
  console.error('Deploy account failed:', err);
  process.exit(1);
});
