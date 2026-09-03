import { ethers } from 'ethers';
import { HolderTracker } from './holder-tracker.js';
import { config } from './config.js';

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
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
 * Reads prize pool balance in real-time, distributes by holding ratio
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider;
  private prizePoolWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Prize pool
  private prizePoolAddress: string;
  private currentPrizePool = 0n;
  
  // Lottery state
  private currentDrawId = 0;
  private lastDrawTime = 0;
  private drawInterval = 60;
  private snapshotLeadTime = 10;
  
  // Current snapshot
  private currentSnapshot: {
    drawId: number;
    timestamp: number;
    holders: Array<{address: string; number: number; balance: bigint}>;
    hash: string;
  } | null = null;
  
  // History
  private drawHistory: DrawResult[] = [];
  
  // Stats
  private totalDistributed = 0n;
  
  // Timers
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  // Auto transfer
  private autoTransferEnabled = false;
  
  // Event callbacks
  public onDraw: ((result: DrawResult) => void) | null = null;
  public onSnapshot: ((snapshot: any) => void) | null = null;
  public onTransfer: ((winner: string, amount: string, txHash: string) => void) | null = null;

  constructor(holderTracker: HolderTracker) {
    this.holderTracker = holderTracker;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.prizePoolAddress = config.prizePoolWallet;
    
    // Setup prize pool wallet (for auto transfer)
    if (config.prizePoolPrivateKey) {
      this.prizePoolWallet = new ethers.Wallet(config.prizePoolPrivateKey, this.provider);
      this.autoTransferEnabled = true;
      console.log('✅ Prize pool wallet configured, auto transfer enabled');
    } else {
      console.log('⚠️ Prize pool private key not set, auto transfer disabled');
    }
    
    // Setup token contract
    if (config.tokenAddress) {
      if (this.prizePoolWallet) {
        this.tokenContract = new ethers.Contract(
          config.tokenAddress,
          ERC20_ABI,
          this.prizePoolWallet
        );
      } else {
        this.tokenContract = new ethers.Contract(
          config.tokenAddress,
          ERC20_ABI,
          this.provider
        );
      }
    }
    
    this.lastDrawTime = Math.floor(Date.now() / 1000);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('\n🎱 Starting Balls Lottery');
    console.log(`Prize Pool: ${this.prizePoolAddress}`);
    console.log(`Draw Interval: ${this.drawInterval}s`);
    console.log(`Distribution: By holding ratio`);
    console.log(`Auto Transfer: ${this.autoTransferEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    
    // Get initial prize pool balance
    this.updatePrizePool();
    
    // Check every second
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1000);
    
    // Update prize pool every 5 seconds
    setInterval(() => {
      this.updatePrizePool();
    }, 5000);
  }

  stop() {
    if (!this.isRunning) return;
    
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    
    this.isRunning = false;
    console.log('Lottery service stopped');
  }

  /**
   * Read prize pool wallet token balance
   */
  private async updatePrizePool() {
    if (!this.tokenContract) return;
    
    try {
      const balance = await this.tokenContract.balanceOf(this.prizePoolAddress);
      this.currentPrizePool = balance;
    } catch (error) {
      // Silent
    }
  }

  private tick() {
    const now = Math.floor(Date.now() / 1000);
    const nextDrawTime = this.lastDrawTime + this.drawInterval;
    const snapshotTime = nextDrawTime - this.snapshotLeadTime;
    
    if (!this.currentSnapshot && now >= snapshotTime && now < nextDrawTime) {
      this.takeSnapshot();
    }
    
    if (now >= nextDrawTime && this.currentSnapshot) {
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
    
    console.log('\n📸 Snapshot Locked');
    console.log(`Draw: #${nextDrawId}`);
    console.log(`Eligible: ${holders.length} participants`);
    console.log(`Prize Pool: ${ethers.formatUnits(this.currentPrizePool, 18)} tokens`);
    
    this.onSnapshot?.(this.currentSnapshot);
  }

  private async executeDraw() {
    if (!this.currentSnapshot) return;
    
    this.currentDrawId++;
    const drawId = this.currentDrawId;
    this.lastDrawTime = Math.floor(Date.now() / 1000);
    
    console.log('\n🎱 Drawing...');
    
    // Generate winning number
    const winningNumber = this.generateWinningNumber(drawId);
    
    // Find winners
    const winnersData = this.currentSnapshot.holders
      .filter(h => h.number === winningNumber);
    
    // Total winner balance
    const totalWinnerBalance = winnersData.reduce((sum, h) => sum + h.balance, 0n);
    
    // Current prize pool
    const prizePool = this.currentPrizePool;
    
    // Distribute by ratio
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
        
        // Auto transfer
        if (this.autoTransferEnabled && prize > 0n) {
          try {
            const txHash = await this.transferPrize(winner.address, prize);
            winnerShare.txHash = txHash;
            console.log(`  ✅ Sent to ${winner.address.slice(0, 10)}... | ${ethers.formatUnits(prize, 18)} tokens`);
            this.onTransfer?.(winner.address, ethers.formatUnits(prize, 18), txHash);
          } catch (error: any) {
            console.error(`  ❌ Transfer failed: ${error.message}`);
          }
        }
        
        winners.push(winnerShare);
      }
      
      this.totalDistributed += prizePool;
    }
    
    const result: DrawResult = {
      drawId,
      timestamp: this.lastDrawTime,
      winningNumber,
      prizePool: ethers.formatUnits(prizePool, 18),
      winnersCount: winners.length,
      totalWinnerBalance: ethers.formatUnits(totalWinnerBalance, 18),
      winners,
      snapshotHash: this.currentSnapshot.hash,
      autoTransfer: this.autoTransferEnabled,
    };
    
    this.drawHistory.unshift(result);
    if (this.drawHistory.length > 100) {
      this.drawHistory.pop();
    }
    
    this.currentSnapshot = null;
    
    // Print result
    console.log('\n🎉 Draw Complete!');
    console.log(`Draw: #${drawId}`);
    console.log(`Winning Number: ${winningNumber}`);
    console.log(`Prize Pool: ${result.prizePool} tokens`);
    console.log(`Winners: ${winners.length}`);
    
    if (winners.length > 0) {
      console.log(`Total Winner Balance: ${result.totalWinnerBalance}`);
      console.log('Distribution:');
      for (const w of winners) {
        const status = w.txHash ? `✅ ${w.txHash.slice(0, 10)}...` : '⏳ Pending';
        console.log(`  ${w.address.slice(0, 10)}... | ${w.sharePercent.toFixed(2)}% | ${Number(w.prize).toFixed(2)} | ${status}`);
      }
    } else {
      console.log('No winners this round, prize rolls over');
    }
    
    // Update prize pool balance
    await this.updatePrizePool();
    
    this.onDraw?.(result);
  }

  /**
   * Transfer prize to winner
   */
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
    const now = Math.floor(Date.now() / 1000);
    const nextDrawTime = this.lastDrawTime + this.drawInterval;
    const timeUntilDraw = Math.max(0, nextDrawTime - now);
    const timeUntilSnapshot = Math.max(0, nextDrawTime - this.snapshotLeadTime - now);
    
    return {
      isRunning: this.isRunning,
      currentDrawId: this.currentDrawId,
      lastDrawTime: this.lastDrawTime,
      timeUntilNextDraw: timeUntilDraw,
      timeUntilSnapshot: timeUntilSnapshot,
      hasSnapshot: !!this.currentSnapshot,
      prizePool: ethers.formatUnits(this.currentPrizePool, 18),
      prizePoolWallet: this.prizePoolAddress,
      autoTransferEnabled: this.autoTransferEnabled,
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
    
    // Calculate share in same number group
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
