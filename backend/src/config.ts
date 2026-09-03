import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // 区块链配置
  rpcUrl: process.env.RPC_URL || 'https://rpc.robinhoodchain.com',
  chainId: parseInt(process.env.CHAIN_ID || '4663'),
  
  // 合约地址
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  lotteryAddress: process.env.LOTTERY_ADDRESS || '',
  
  // 奖池钱包（税费收款地址 = 奖池余额）
  prizePoolWallet: '0xfaF2deaF29C4A0bb086195c675eA37d4820E0598',
  
  // 奖池钱包私钥（用于自动转账给中奖者）
  prizePoolPrivateKey: process.env.PRIZE_POOL_PRIVATE_KEY || '',
  
  // 服务配置
  port: parseInt(process.env.PORT || '3001'),
  
  // 开奖间隔（毫秒）
  drawInterval: parseInt(process.env.DRAW_INTERVAL || '60000'), // 默认1分钟
  
  // 是否启用自动开奖
  autoDrawEnabled: process.env.AUTO_DRAW_ENABLED === 'true',
};

// 验证必需的配置
export function validateConfig(): void {
  console.log(`奖池钱包: ${config.prizePoolWallet}`);
  
  if (config.tokenAddress) {
    console.log(`代币合约: ${config.tokenAddress}`);
  } else {
    console.warn('警告: 代币合约地址未设置');
  }
}
