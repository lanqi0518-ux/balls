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
  devFee: string;
  winnersCount: number;
  totalWinnerBalance: string;
  winners: WinnerShare[];
  snapshotHash: string;
  autoTransfer: boolean;
}

/**
 * Automated Lottery Service
 * - Tax split: 1% to dev, 3% to prize pool
 * - Draws at second :01 of every minute
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider | null = null;
  private taxReceiverWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Wallets
  private taxReceiverAddress: string;
  private devWalletAddress: string;
  
  // Prize pool (3% portion only)
  private currentPrizePool = 0n;
  private totalTaxBalance = 0n;
  
  // Demo mode
  private demoMode = false;
  private demoPrizePool = 75000n * 10n ** 18n; // 75k (3/4 of 100k)
  
  // Lottery state
  private currentDrawId = 0;
  
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
  
  // Track state
  private lastDrawMinute = -1;
  private snapshotTakenForMinute = -1;
  
  // Stats
  private totalDevPaid = 0n;
  private totalPrizePaid = 0n;
  
  // Event callbacks
  public onDraw: ((result: DrawResult) => void) | null = null;
  public onSnapshot: ((snapshot: any) => void) | null = null;

  constructor(holderTracker: HolderTracker) {
    this.holderTracker = holderTracker;
    this.taxReceiverAddress = config.taxReceiverWallet;
    this.devWalletAddress = config.devWallet;
    
    if (!config.tokenAddress) {
      console.log('🎮 Lottery running in demo mode');
      this.demoMode = true;
    } else {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      if (config.taxReceiverPrivateKey) {
        this.taxReceiverWallet = new ethers.Wallet(config.taxReceiverPrivateKey, this.provider);
        this.autoTransferEnabled = true;
        console.log('✅ Auto transfer enabled');
        console.log(`📤 Dev wallet: ${this.devWalletAddress}`);
        console.log(`💰 Tax split: ${config.devSharePercent}% dev / ${100 - config.devSharePercent}% prize`);
      }
      
      this.tokenContract = new ethers.Contract(
        config.tokenAddress,
        ERC20_ABI,
        this.taxReceiverWallet || this.provider
      );
    }
  }

  /**
   * Get time until next :01
   */
  private getTimeUntilDraw(): number {
    const now = new Date();
    const seconds = now.getSeconds();
    if (seconds === 0) return 1;
    if (seconds >= 1) return 61 - seconds;
    return 1;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('\n🎱 Starting Balls Lottery');
    console.log(`Tax Receiver: ${this.taxReceiverAddress}`);
    console.log(`Dev Wallet: ${this.devWalletAddress}`);
    console.log(`Draw Time: Every minute at :01`);
    console.log(`Mode: ${this.demoMode ? 'Demo' : 'Live'}`);
    
    // Check every 500ms
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 500);
    
    if (!this.demoMode) {
      this.updateBalances();
      setInterval(() => this.updateBalances(), 5000);
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

  /**
   * Update tax receiver balance and calculate prize pool (75%)
   */
  private async updateBalances() {
    if (!this.tokenContract || this.demoMode) return;
    
    try {
      const balance = await this.tokenContract.balanceOf(this.taxReceiverAddress);
      this.totalTaxBalance = balance;
      // Prize pool is 75% of total (3% out of 4%)
      this.currentPrizePool = (balance * 75n) / 100n;
    } catch (error) {
      // Silent
    }
  }

  private tick() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    const nextDrawMinute = (currentSecond >= 1) ? (currentMinute + 1) % 60 : currentMinute;
    
    // Take snapshot at :50-:59
    if (currentSecond >= 50 && currentSecond <= 59) {
      if (this.snapshotTakenForMinute !== nextDrawMinute) {
        this.snapshotTakenForMinute = nextDrawMinute;
        this.takeSnapshot();
      }
    }
    
    // Execute draw at :01 or :02
    if ((currentSecond === 1 || currentSecond === 2) && currentMinute !== this.lastDrawMinute) {
      this.lastDrawMinute = currentMinute;
      
      if (!this.currentSnapshot) {
        this.takeSnapshot();
      }
      
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
    console.log(`Prize Pool (3%): ${ethers.formatUnits(prizePool, 18)}`);
    
    if (this.onSnapshot) {
      this.onSnapshot({
        drawId: nextDrawId,
        eligibleCount: holders.length,
        hash,
        timestamp
      });
    }
  }

  private async executeDraw() {
    if (!this.currentSnapshot) {
      this.takeSnapshot();
    }
    
    const snapshot = this.currentSnapshot!;
    this.currentDrawId++;
    const drawId = this.currentDrawId;
    
    console.log('\n🎱 DRAWING NOW!');
    
    // Step 1: Send 1% (25% of tax) to dev wallet FIRST
    let devFee = 0n;
    if (this.autoTransferEnabled && !this.demoMode && this.totalTaxBalance > 0n) {
      devFee = (this.totalTaxBalance * BigInt(config.devSharePercent)) / 100n;
      if (devFee > 0n) {
        try {
          console.log(`\n📤 Sending dev fee: ${ethers.formatUnits(devFee, 18)} tokens`);
          const tx = await this.tokenContract!.transfer(this.devWalletAddress, devFee);
          await tx.wait();
          this.totalDevPaid += devFee;
          console.log(`✅ Dev fee sent to ${this.devWalletAddress}`);
        } catch (error: any) {
          console.error(`❌ Dev fee transfer failed: ${error.message}`);
          devFee = 0n;
        }
      }
    }
    
    // Step 2: Get remaining prize pool (75% of tax = 3%)
    const winningNumber = this.generateWinningNumber(drawId);
    const winnersData = snapshot.holders.filter(h => h.number === winningNumber);
    const totalWinnerBalance = winnersData.reduce((sum, h) => sum + h.balance, 0n);
    
    // Recalculate prize pool after dev fee
    let prizePool: bigint;
    if (this.demoMode) {
      prizePool = this.demoPrizePool;
    } else {
      await this.updateBalances();
      prizePool = this.currentPrizePool;
    }
    
    const winners: WinnerShare[] = [];
    
    // Step 3: Distribute prizes to winners
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
        
        if (this.autoTransferEnabled && !this.demoMode && prize > 0n) {
          try {
            const tx = await this.tokenContract!.transfer(winner.address, prize);
            const receipt = await tx.wait();
            winnerShare.txHash = receipt.hash;
            this.totalPrizePaid += prize;
            console.log(`  ✅ Sent ${ethers.formatUnits(prize, 18)} to ${winner.address.slice(0, 10)}...`);
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
      devFee: ethers.formatUnits(devFee, 18),
      winnersCount: winners.length,
      totalWinnerBalance: ethers.formatUnits(totalWinnerBalance, 18),
      winners,
      snapshotHash: snapshot.hash,
      autoTransfer: this.autoTransferEnabled && !this.demoMode,
    };
    
    this.drawHistory.unshift(result);
    if (this.drawHistory.length > 100) {
      this.drawHistory.pop();
    }
    
    this.currentSnapshot = null;
    
    console.log('\n🎉 DRAW COMPLETE!');
    console.log(`Draw #${drawId}`);
    console.log(`Winning Number: ${winningNumber}`);
    console.log(`Dev Fee (1%): ${result.devFee}`);
    console.log(`Prize Pool (3%): ${result.prizePool}`);
    console.log(`Winners: ${winners.length}`);
    
    if (!this.demoMode) {
      await this.updateBalances();
    }
    
    if (this.onDraw) {
      console.log('📢 Broadcasting draw event...');
      this.onDraw(result);
    }
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
    // Show only prize pool (3%), not total tax (4%)
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    
    return {
      isRunning: this.isRunning,
      currentDrawId: this.currentDrawId,
      timeUntilNextDraw: timeUntilDraw,
      hasSnapshot: !!this.currentSnapshot,
      prizePool: ethers.formatUnits(prizePool, 18),
      taxReceiverWallet: this.taxReceiverAddress,
      devWallet: this.devWalletAddress,
      demoMode: this.demoMode,
      totalDevPaid: ethers.formatUnits(this.totalDevPaid, 18),
      totalPrizePaid: ethers.formatUnits(this.totalPrizePaid, 18),
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
