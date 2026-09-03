import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Blockchain config
  rpcUrl: process.env.RPC_URL || 'https://rpc.robinhoodchain.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // Contract addresses
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // Prize pool wallet (tax recipient = prize pool balance)
  prizePoolWallet: process.env.PRIZE_POOL_WALLET || '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  
  // Prize pool wallet private key (for auto transfer)
  prizePoolPrivateKey: process.env.PRIZE_POOL_PRIVATE_KEY || '',
  
  // Server config
  port: parseInt(process.env.PORT || '3001'),
  
  // Draw interval (ms)
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '60000'),
  
  // Enable auto draw
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED === 'true',
};

// Validate config
export function validateConfig(): void {
  console.log(`Prize Pool Wallet: ${config.prizePoolWallet}`);
  
  if (config.tokenAddress) {
    console.log(`Token Contract: ${config.tokenAddress}`);
  } else {
    console.log('⚠️ Token address not set - running in demo mode');
  }
}
