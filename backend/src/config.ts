import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Token contract address (BALLS token for holder tracking)
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Tax is collected in ETH (paired asset)
  // Tax receiver wallet receives ETH from Pons creator tax
  taxReceiverWallet: process.env.TAX_RECEIVER_WALLET || '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  
  // Tax receiver wallet private key (for sending ETH to dev + winners)
  taxReceiverPrivateKey: process.env.TAX_RECEIVER_PRIVATE_KEY || '',
  
  // Developer wallet (receives 1% of 4% = 25% of total tax)
  devWallet: '0x9bae8aDF73F0dd6d27acB12E41eb9B800f93785F',
  
  // Tax split: 25% to dev (1% of 4%), 75% to prize (3% of 4%)
  devSharePercent: 25,
  
  // Prize is distributed in ETH (not tokens)
  prizeInEth: true,
  
  // Excluded addresses (LP pools, contracts, etc.)
  // These are NOT counted as real holders
  excludedAddresses: [
    '0x267444d099b10fb5ed7c3cc7b7c767adca574952', // LP Pool
    '0x8366a39cc670b4001a1121b8f6a443a643e40951', // Router/Contract
  ],
  
  // Server config
  port: parseInt(process.env.PORT || '3001'),
  
  // Draw interval (ms)
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '60000'),
  
  // Enable auto draw
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED === 'true',
};

// Validate config
export function validateConfig(): void {
  console.log('\n📋 Configuration:');
  console.log(`  Token: ${config.tokenAddress || '(demo mode)'}`);
  console.log(`  Tax Receiver: ${config.taxReceiverWallet}`);
  console.log(`  Dev Wallet: ${config.devWallet}`);
  console.log(`  Tax Split: ${config.devSharePercent}% dev / ${100 - config.devSharePercent}% prize`);
  
  console.log('\n🚫 Excluded Addresses (not counted as holders):');
  config.excludedAddresses.forEach(addr => {
    console.log(`  - ${addr}`);
  });
  
  if (!config.tokenAddress) {
    console.log('\n⚠️ TOKEN_ADDRESS not set - running in DEMO mode');
  }
}
