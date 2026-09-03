import { ethers } from 'ethers';
import { HolderTracker } from './holder-tracker.js';
import { config } from './config.js';

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

interface WinnerShare {
  address: string;
  balance: string;
  sharePercent: number;
  prize: string;
  txHash?: string;
}

interface DrawResult {
  drawId: number;
  timestamp: number;
  winningNumber: number;
  prizePool: string;
  winnersCount: number;
  totalWinnerBalance: string;
  winners: WinnerShare[];
  snapshotHash: string;
  autoTransfer: boolean;
}

/**
 * Automated Lottery Service
 * Draws at second :01 of every minute (e.g., 3:00:01, 3:01:01, 3:02:01)
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider | null = null;
  private prizePoolWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Prize pool
  private prizePoolAddress: string;
  private currentPrizePool = 0n;
  
  // Demo mode
  private demoMode = false;
  private demoPrizePool = 100000n * 10n ** 18n;
  
  // Lottery state
  private currentDrawId = 0;
  private snapshotLeadTime = 10; // Snapshot 10 seconds before draw
  
  // Current snapshot
  private currentSnapshot: {
    drawId: number;
    timestamp: number;
    holders: Array<{address: string; number: number; balance: bigint}>;
    hash: string;
  } | null = null;
  
  // History
  private drawHistory: DrawResult[] = [];
  
  // Timers
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  
  // Auto transfer
  private autoTransferEnabled = false;
  
  // Event callbacks
  public onDraw: ((result: DrawResult) => void) | null = null;
  public onSnapshot: ((snapshot: any) => void) | null = null;

  constructor(holderTracker: HolderTracker) {
    this.holderTracker = holderTracker;
    this.prizePoolAddress = config.prizePoolWallet;
    
    // Check demo mode
    if (!config.tokenAddress) {
      console.log('🎮 Lottery running in demo mode');
      this.demoMode = true;
    } else {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      if (config.prizePoolPrivateKey) {
        this.prizePoolWallet = new ethers.Wallet(config.prizePoolPrivateKey, this.provider);
        this.autoTransferEnabled = true;
        console.log('✅ Auto transfer enabled');
      }
      
      this.tokenContract = new ethers.Contract(
        config.tokenAddress,
        ERC20_ABI,
        this.prizePoolWallet || this.provider
      );
    }
  }

  /**
   * Get next draw time (second :01 of next minute)
   */
  private getNextDrawTime(): number {
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(1, 0); // Set to :01
    
    // If we're past :01 this minute, go to next minute
    if (now.getSeconds() >= 1) {
      next.setMinutes(next.getMinutes() + 1);
    }
    
    return Math.floor(next.getTime() / 1000);
  }

  /**
   * Get time until next draw in seconds
   */
  private getTimeUntilDraw(): number {
    const now = Math.floor(Date.now() / 1000);
    const nextDraw = this.getNextDrawTime();
    return Math.max(0, nextDraw - now);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('\n🎱 Starting Balls Lottery');
    console.log(`Prize Pool: ${this.prizePoolAddress}`);
    console.log(`Draw Time: Every minute at :01`);
    console.log(`Mode: ${this.demoMode ? 'Demo' : 'Live'}`);
    
    // Check every second
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1000);
    
    // Update prize pool every 5 seconds (if not demo)
    if (!this.demoMode) {
      this.updatePrizePool();
      setInterval(() => this.updatePrizePool(), 5000);
    }
  }

  stop() {
    if (!this.isRunning) return;
    
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    
    this.isRunning = false;
    console.log('Lottery stopped');
  }

  private async updatePrizePool() {
    if (!this.tokenContract || this.demoMode) return;
    
    try {
      const balance = await this.tokenContract.balanceOf(this.prizePoolAddress);
      this.currentPrizePool = balance;
    } catch (error) {
      // Silent
    }
  }

  private tick() {
    const timeUntil = this.getTimeUntilDraw();
    const snapshotTime = this.snapshotLeadTime;
    
    // Take snapshot 10 seconds before draw
    if (!this.currentSnapshot && timeUntil <= snapshotTime && timeUntil > 0) {
      this.takeSnapshot();
    }
    
    // Execute draw at :01
    if (timeUntil === 0 && this.currentSnapshot) {
      this.executeDraw();
    }
  }

  private takeSnapshot() {
    const nextDrawId = this.currentDrawId + 1;
    const eligible = this.holderTracker.getEligibleHolders();
    const timestamp = Math.floor(Date.now() / 1000);
    
    const holders = eligible.map(h => ({
      address: h.address,
      number: h.number,
      balance: h.balance,
    }));
    
    const hash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
      timestamp,
      holders: holders.map(h => ({
        address: h.address,
        number: h.number,
        balance: h.balance.toString(),
      })).sort((a, b) => a.address.localeCompare(b.address)),
    })));
    
    this.currentSnapshot = {
      drawId: nextDrawId,
      timestamp,
      holders,
      hash,
    };
    
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    
    console.log('\n📸 Snapshot Locked');
    console.log(`Draw: #${nextDrawId}`);
    console.log(`Eligible: ${holders.length}`);
    console.log(`Prize Pool: ${ethers.formatUnits(prizePool, 18)}`);
    
    this.onSnapshot?.(this.currentSnapshot);
  }

  private async executeDraw() {
    if (!this.currentSnapshot) return;
    
    this.currentDrawId++;
    const drawId = this.currentDrawId;
    
    console.log('\n🎱 Drawing...');
    
    const winningNumber = this.generateWinningNumber(drawId);
    
    const winnersData = this.currentSnapshot.holders
      .filter(h => h.number === winningNumber);
    
    const totalWinnerBalance = winnersData.reduce((sum, h) => sum + h.balance, 0n);
    
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    
    const winners: WinnerShare[] = [];
    
    if (totalWinnerBalance > 0n && prizePool > 0n) {
      for (const winner of winnersData) {
        const prize = (winner.balance * prizePool) / totalWinnerBalance;
        const sharePercent = Number((winner.balance * 10000n) / totalWinnerBalance) / 100;
        
        const winnerShare: WinnerShare = {
          address: winner.address,
          balance: ethers.formatUnits(winner.balance, 18),
          sharePercent,
          prize: ethers.formatUnits(prize, 18),
        };
        
        // Auto transfer (only in live mode)
        if (this.autoTransferEnabled && !this.demoMode && prize > 0n) {
          try {
            const txHash = await this.transferPrize(winner.address, prize);
            winnerShare.txHash = txHash;
            console.log(`  ✅ Sent to ${winner.address.slice(0, 10)}...`);
          } catch (error: any) {
            console.error(`  ❌ Transfer failed: ${error.message}`);
          }
        }
        
        winners.push(winnerShare);
      }
    }
    
    const result: DrawResult = {
      drawId,
      timestamp: Math.floor(Date.now() / 1000),
      winningNumber,
      prizePool: ethers.formatUnits(prizePool, 18),
      winnersCount: winners.length,
      totalWinnerBalance: ethers.formatUnits(totalWinnerBalance, 18),
      winners,
      snapshotHash: this.currentSnapshot.hash,
      autoTransfer: this.autoTransferEnabled && !this.demoMode,
    };
    
    this.drawHistory.unshift(result);
    if (this.drawHistory.length > 100) {
      this.drawHistory.pop();
    }
    
    this.currentSnapshot = null;
    
    console.log('\n🎉 Draw Complete!');
    console.log(`Winning Number: ${winningNumber}`);
    console.log(`Winners: ${winners.length}`);
    
    if (!this.demoMode) {
      await this.updatePrizePool();
    }
    
    this.onDraw?.(result);
  }

  private async transferPrize(to: string, amount: bigint): Promise<string> {
    if (!this.tokenContract || !this.prizePoolWallet) {
      throw new Error('Transfer not configured');
    }
    
    const tx = await this.tokenContract.transfer(to, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  private generateWinningNumber(drawId: number): number {
    const seed = ethers.keccak256(ethers.solidityPacked(
      ['uint256', 'uint256', 'bytes32', 'uint256'],
      [
        drawId,
        Math.floor(Date.now() / 1000),
        this.currentSnapshot?.hash || ethers.ZeroHash,
        this.holderTracker.getStats().eligibleHolders,
      ]
    ));
    
    return (Number(BigInt(seed) % 50n) + 1);
  }

  getStatus() {
    const timeUntilDraw = this.getTimeUntilDraw();
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    
    return {
      isRunning: this.isRunning,
      currentDrawId: this.currentDrawId,
      timeUntilNextDraw: timeUntilDraw,
      nextDrawTime: this.getNextDrawTime(),
      hasSnapshot: !!this.currentSnapshot,
      prizePool: ethers.formatUnits(prizePool, 18),
      prizePoolWallet: this.prizePoolAddress,
      demoMode: this.demoMode,
      snapshot: this.currentSnapshot ? {
        drawId: this.currentSnapshot.drawId,
        eligibleCount: this.currentSnapshot.holders.length,
        hash: this.currentSnapshot.hash,
      } : null,
      stats: this.holderTracker.getStats(),
    };
  }

  getRecentDraws(count: number = 10): DrawResult[] {
    return this.drawHistory.slice(0, count);
  }

  getUserInfo(address: string) {
    const addr = address.toLowerCase();
    const holders = this.holderTracker.getAllHolders();
    const holder = holders.find(h => h.address === addr);
    
    if (!holder) {
      return {
        address: addr,
        isHolder: false,
        number: this.holderTracker.getNumber(addr),
        balance: '0',
        isEligible: false,
        shareInNumber: 0,
      };
    }
    
    const sameNumberHolders = this.holderTracker.getEligibleHolders()
      .filter(h => h.number === holder.number);
    const totalInNumber = sameNumberHolders.reduce((sum, h) => sum + h.balance, 0n);
    const shareInNumber = totalInNumber > 0n 
      ? Number((holder.balance * 10000n) / totalInNumber) / 100 
      : 0;
    
    return {
      address: addr,
      isHolder: true,
      number: holder.number,
      balance: ethers.formatUnits(holder.balance, 18),
      holdingSince: holder.firstSeen,
      isEligible: this.holderTracker.isEligible(addr),
      shareInNumber,
      sameNumberHolders: sameNumberHolders.length,
    };
  }

  getNumberDistribution() {
    const holders = this.holderTracker.getEligibleHolders();
    const result: Record<number, {count: number; totalBalance: string}> = {};
    
    for (let i = 1; i <= 50; i++) {
      const matching = holders.filter(h => h.number === i);
      const totalBalance = matching.reduce((sum, h) => sum + h.balance, 0n);
      result[i] = {
        count: matching.length,
        totalBalance: ethers.formatUnits(totalBalance, 18),
      };
    }
    
    return result;
  }
}
