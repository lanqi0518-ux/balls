import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Token contract address
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Tax receiver wallet (receives 4% tax from Pons)
  taxReceiverWallet: process.env.TAX_RECEIVER_WALLET || '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  
  // Tax receiver wallet private key (for sending to dev + winners)
  taxReceiverPrivateKey: process.env.TAX_RECEIVER_PRIVATE_KEY || '',
  
  // Developer wallet (receives 1% of 4% = 25% of total tax)
  devWallet: '0x9bae8aDF73F0dd6d27acB12E41eb9B800f93785F',
  
  // Tax split: 25% to dev (1% of 4%), 75% to prize (3% of 4%)
  devSharePercent: 25,
  
  // Server config
  port: parseInt(process.env.PORT || '3001'),
  
  // Draw interval (ms)
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '60000'),
  
  // Enable auto draw
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED === 'true',
};

// Validate config
export function validateConfig(): void {
  console.log(`Tax Receiver: ${config.taxReceiverWallet}`);
  console.log(`Dev Wallet: ${config.devWallet}`);
  console.log(`Tax Split: ${config.devSharePercent}% dev / ${100 - config.devSharePercent}% prize`);
  
  if (config.tokenAddress) {
    console.log(`Token Contract: ${config.tokenAddress}`);
  } else {
    console.log('⚠️ Token address not set - running in demo mode');
  }
}
