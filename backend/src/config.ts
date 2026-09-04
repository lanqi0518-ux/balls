import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Token contract address (BALLS token for holder tracking)
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Prize pool wallet — receives the 3% lottery tax.
  // 100% of this wallet (minus 0.05 ETH gas) goes to winners.
  taxReceiverWallet: process.env.TAX_RECEIVER_WALLET || '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  taxReceiverPrivateKey: process.env.TAX_RECEIVER_PRIVATE_KEY || '',
  
  // Publisher automatically receives 1%. At draw time this is forwarded
  // to teamWallet together with prize payouts.
  // If empty or the same as the prize wallet, only the 3% prize pool is paid.
  publisherWallet: process.env.PUBLISHER_WALLET || '',
  publisherPrivateKey: process.env.PUBLISHER_PRIVATE_KEY || '',
  
  // Team wallet that receives the forwarded publisher 1%
  devWallet: process.env.TEAM_WALLET || '0x9bae8aDF73F0dd6d27acB12E41eb9B800f93785F',
  
  prizeInEth: true,
  
  // Excluded addresses (LP pools, contracts, etc.)
  excludedAddresses: [
    '0x267444d099b10fb5ed7c3cc7b7c767adca574952', // LP Pool
    '0x8366a39cc670b4001a1121b8f6a443a643e40951', // Router/Contract
  ],
  
  port: parseInt(process.env.PORT || '3001'),
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '60000'),
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED !== 'false',
};

export function validateConfig(): void {
  console.log('\n📋 Configuration:');
  console.log(`  Token: ${config.tokenAddress || '(not set - waiting)'}`);
  console.log(`  Prize Pool Wallet (3%): ${config.taxReceiverWallet}`);
  console.log(`  Publisher Wallet (1%): ${config.publisherWallet || '(same as prize pool — 1% forward skipped)'}`);
  console.log(`  Team Wallet (receives 1%): ${config.devWallet}`);
  console.log('  Payout: 3% ALL to winners | 1% forwarded to team at draw');
  
  console.log('\n🚫 Excluded Addresses (not counted as holders):');
  config.excludedAddresses.forEach(addr => {
    console.log(`  - ${addr}`);
  });
  
  if (!config.tokenAddress) {
    console.log('\n⚠️ TOKEN_ADDRESS not set - draws paused, prize pool uses real tax-wallet ETH');
  }
}
