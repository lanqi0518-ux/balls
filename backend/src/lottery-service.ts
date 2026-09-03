import { ethers } from 'ethers';
import { config } from './config.js';
import { LotteryTokenABI, PowerballLotteryABI } from './abi.js';

export interface DrawInfo {
  drawId: bigint;
  timestamp: bigint;
  winningNumber: number;
  prizePool: bigint;
  winnersCount: bigint;
  prizePerWinner: bigint;
  distributed: boolean;
}

export interface WinnerInfo {
  winner: string;
  prize: bigint;
  claimed: boolean;
}

export interface Stats {
  totalDraws: bigint;
  totalDistributed: bigint;
  currentPrizePool: bigint;
  holdersCount: bigint;
}

export class LotteryService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract;
  private lotteryContract: ethers.Contract;
  private lotteryContractWithSigner: ethers.Contract | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // 初始化只读合约
    this.tokenContract = new ethers.Contract(
      config.tokenAddress,
      LotteryTokenABI,
      this.provider
    );
    
    this.lotteryContract = new ethers.Contract(
      config.lotteryAddress,
      PowerballLotteryABI,
      this.provider
    );
    
    // 如果有私钥，初始化钱包
    if (config.drawerPrivateKey) {
      this.wallet = new ethers.Wallet(config.drawerPrivateKey, this.provider);
      this.lotteryContractWithSigner = new ethers.Contract(
        config.lotteryAddress,
        PowerballLotteryABI,
        this.wallet
      );
    }
  }

  // ============ 代币相关 ============

  async getTokenInfo() {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      this.tokenContract.name(),
      this.tokenContract.symbol(),
      this.tokenContract.decimals(),
      this.tokenContract.totalSupply(),
    ]);
    
    return { name, symbol, decimals, totalSupply };
  }

  async getBalance(address: string): Promise<bigint> {
    return this.tokenContract.balanceOf(address);
  }

  async getHoldersCount(): Promise<bigint> {
    return this.tokenContract.getHoldersCount();
  }

  async getHolderNumber(address: string): Promise<number> {
    return this.tokenContract.getNumber(address);
  }

  async getHoldersByNumber(number: number): Promise<string[]> {
    return this.tokenContract.getHoldersByNumber(number);
  }

  // ============ 抽奖相关 ============

  async canDraw(): Promise<boolean> {
    return this.lotteryContract.canDraw();
  }

  async getCurrentPrizePool(): Promise<bigint> {
    return this.lotteryContract.getCurrentPrizePool();
  }

  async getTimeUntilNextDraw(): Promise<bigint> {
    return this.lotteryContract.getTimeUntilNextDraw();
  }

  async getCurrentDrawId(): Promise<bigint> {
    return this.lotteryContract.currentDrawId();
  }

  async getDrawInfo(drawId: number): Promise<DrawInfo> {
    const result = await this.lotteryContract.getDrawInfo(drawId);
    return {
      drawId: result.drawId,
      timestamp: result.timestamp,
      winningNumber: Number(result.winningNumber),
      prizePool: result.prizePool,
      winnersCount: result.winnersCount,
      prizePerWinner: result.prizePerWinner,
      distributed: result.distributed,
    };
  }

  async getDrawWinners(drawId: number): Promise<WinnerInfo[]> {
    const results = await this.lotteryContract.getDrawWinners(drawId);
    return results.map((r: any) => ({
      winner: r.winner,
      prize: r.prize,
      claimed: r.claimed,
    }));
  }

  async getRecentDraws(count: number): Promise<DrawInfo[]> {
    const results = await this.lotteryContract.getRecentDraws(count);
    return results.map((r: any) => ({
      drawId: r.drawId,
      timestamp: r.timestamp,
      winningNumber: Number(r.winningNumber),
      prizePool: r.prizePool,
      winnersCount: r.winnersCount,
      prizePerWinner: r.prizePerWinner,
      distributed: r.distributed,
    }));
  }

  async getUserNumber(address: string): Promise<number> {
    return Number(await this.lotteryContract.getUserNumber(address));
  }

  async getPendingPrize(address: string): Promise<bigint> {
    return this.lotteryContract.getPendingPrize(address);
  }

  async getStats(): Promise<Stats> {
    const [totalDraws, totalDistributed, currentPrizePool, holdersCount] = 
      await this.lotteryContract.getStats();
    return { totalDraws, totalDistributed, currentPrizePool, holdersCount };
  }

  // ============ 开奖操作 ============

  async executeDraw(): Promise<{ success: boolean; txHash?: string; drawId?: bigint; error?: string }> {
    if (!this.lotteryContractWithSigner || !this.wallet) {
      return { success: false, error: '钱包未配置' };
    }

    try {
      // 检查是否可以开奖
      const canDrawNow = await this.canDraw();
      if (!canDrawNow) {
        return { success: false, error: '当前不满足开奖条件' };
      }

      // 估算Gas
      const gasEstimate = await this.lotteryContractWithSigner.draw.estimateGas();
      const gasLimit = gasEstimate * 120n / 100n; // 增加20%余量

      // 执行开奖
      console.log('正在执行开奖...');
      const tx = await this.lotteryContractWithSigner.draw({ gasLimit });
      console.log('交易已提交:', tx.hash);

      // 等待确认
      const receipt = await tx.wait();
      console.log('交易已确认:', receipt.hash);

      // 获取新的开奖ID
      const drawId = await this.getCurrentDrawId();

      return { 
        success: true, 
        txHash: receipt.hash,
        drawId 
      };
    } catch (error: any) {
      console.error('开奖失败:', error);
      return { 
        success: false, 
        error: error.message || '开奖失败' 
      };
    }
  }

  // ============ 工具方法 ============

  formatTokenAmount(amount: bigint, decimals: number = 18): string {
    return ethers.formatUnits(amount, decimals);
  }

  parseTokenAmount(amount: string, decimals: number = 18): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }
}
