import { ethers } from 'ethers';
import { HolderTracker } from './holder-tracker.js';
import { config } from './config.js';

// ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

interface TransferResult {
  to: string;
  amount: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

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
  transferStatus: 'pending' | 'success' | 'partial' | 'failed';
}

/**
 * Automated Lottery Service
 * - Tax split: 1% to dev, 3% to prize pool
 * - Batch transfers for reliability
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider | null = null;
  private taxReceiverWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Wallets
  private taxReceiverAddress: string;
  private devWalletAddress: string;
  
  // Balances
  private currentPrizePool = 0n;
  private totalTaxBalance = 0n;
  
  // Demo mode
  private demoMode = false;
  private demoPrizePool = 75000n * 10n ** 18n;
  
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
  private isProcessingDraw = false; // Prevent concurrent draws
  
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

  private async updateBalances() {
    if (!this.tokenContract || this.demoMode) return;
    
    try {
      const balance = await this.tokenContract.balanceOf(this.taxReceiverAddress);
      this.totalTaxBalance = balance;
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
    
    // Execute draw at :01 or :02 (only if not already processing)
    if ((currentSecond === 1 || currentSecond === 2) && 
        currentMinute !== this.lastDrawMinute && 
        !this.isProcessingDraw) {
      this.lastDrawMinute = currentMinute;
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
    
    this.currentSnapshot = { drawId: nextDrawId, timestamp, holders, hash };
    
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    
    console.log('\n📸 Snapshot Locked');
    console.log(`Draw: #${nextDrawId} | Eligible: ${holders.length} | Prize Pool: ${ethers.formatUnits(prizePool, 18)}`);
    
    if (this.onSnapshot) {
      this.onSnapshot({ drawId: nextDrawId, eligibleCount: holders.length, hash, timestamp });
    }
  }

  /**
   * Execute batch transfer - send to multiple addresses
   */
  private async executeBatchTransfer(
    transfers: Array<{to: string; amount: bigint}>
  ): Promise<TransferResult[]> {
    if (!this.tokenContract || !this.taxReceiverWallet) {
      return transfers.map(t => ({
        to: t.to,
        amount: ethers.formatUnits(t.amount, 18),
        success: false,
        error: 'Wallet not configured'
      }));
    }

    const results: TransferResult[] = [];
    
    // Get current nonce
    let nonce = await this.taxReceiverWallet.getNonce();
    
    // Prepare all transactions
    const txPromises: Array<{
      transfer: {to: string; amount: bigint};
      txPromise: Promise<ethers.TransactionResponse>;
    }> = [];

    console.log(`\n📦 Preparing ${transfers.length} transfers...`);

    for (const transfer of transfers) {
      if (transfer.amount <= 0n) continue;
      
      try {
        // Create transaction with specific nonce
        const txPromise = this.tokenContract.transfer(transfer.to, transfer.amount, {
          nonce: nonce,
          // Add some gas buffer
          gasLimit: 100000n,
        });
        
        txPromises.push({ transfer, txPromise });
        nonce++; // Increment nonce for next tx
        
        console.log(`  📤 Queued: ${ethers.formatUnits(transfer.amount, 18)} → ${transfer.to.slice(0, 10)}...`);
      } catch (error: any) {
        results.push({
          to: transfer.to,
          amount: ethers.formatUnits(transfer.amount, 18),
          success: false,
          error: error.message
        });
      }
    }

    // Send all transactions
    console.log(`\n🚀 Sending ${txPromises.length} transactions...`);
    
    const sentTxs: Array<{
      transfer: {to: string; amount: bigint};
      tx: ethers.TransactionResponse;
    }> = [];

    for (const { transfer, txPromise } of txPromises) {
      try {
        const tx = await txPromise;
        sentTxs.push({ transfer, tx });
        console.log(`  ✓ Sent tx: ${tx.hash.slice(0, 16)}...`);
      } catch (error: any) {
        console.log(`  ✗ Failed to send: ${error.message}`);
        results.push({
          to: transfer.to,
          amount: ethers.formatUnits(transfer.amount, 18),
          success: false,
          error: error.message
        });
      }
    }

    // Wait for all confirmations
    console.log(`\n⏳ Waiting for ${sentTxs.length} confirmations...`);
    
    const confirmPromises = sentTxs.map(async ({ transfer, tx }) => {
      try {
        const receipt = await tx.wait(1); // Wait for 1 confirmation
        return {
          to: transfer.to,
          amount: ethers.formatUnits(transfer.amount, 18),
          success: receipt?.status === 1,
          txHash: tx.hash,
        };
      } catch (error: any) {
        return {
          to: transfer.to,
          amount: ethers.formatUnits(transfer.amount, 18),
          success: false,
          txHash: tx.hash,
          error: error.message
        };
      }
    });

    const confirmResults = await Promise.all(confirmPromises);
    results.push(...confirmResults);

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`\n📊 Transfer Summary: ${successful} success, ${failed} failed`);

    return results;
  }

  private async executeDraw() {
    if (this.isProcessingDraw) {
      console.log('⚠️ Draw already in progress, skipping...');
      return;
    }
    
    this.isProcessingDraw = true;
    
    try {
      if (!this.currentSnapshot) {
        this.takeSnapshot();
      }
      
      const snapshot = this.currentSnapshot!;
      this.currentDrawId++;
      const drawId = this.currentDrawId;
      
      console.log('\n' + '='.repeat(50));
      console.log('🎱 DRAW #' + drawId + ' STARTING');
      console.log('='.repeat(50));
      
      // Get winning number
      const winningNumber = this.generateWinningNumber(drawId);
      console.log(`🎯 Winning Number: ${winningNumber}`);
      
      // Find winners
      const winnersData = snapshot.holders.filter(h => h.number === winningNumber);
      const totalWinnerBalance = winnersData.reduce((sum, h) => sum + h.balance, 0n);
      
      console.log(`👥 Winners found: ${winnersData.length}`);
      
      // Calculate amounts
      let devFee = 0n;
      let prizePool: bigint;
      
      if (this.demoMode) {
        prizePool = this.demoPrizePool;
        devFee = (prizePool * 25n) / 75n; // Calculate what 1% would be
      } else {
        await this.updateBalances();
        devFee = (this.totalTaxBalance * BigInt(config.devSharePercent)) / 100n;
        prizePool = this.currentPrizePool;
      }
      
      console.log(`💰 Dev Fee (1%): ${ethers.formatUnits(devFee, 18)}`);
      console.log(`🏆 Prize Pool (3%): ${ethers.formatUnits(prizePool, 18)}`);
      
      // Prepare all transfers
      const transfers: Array<{to: string; amount: bigint; type: 'dev' | 'winner'}> = [];
      const winners: WinnerShare[] = [];
      
      // Add dev fee transfer
      if (devFee > 0n) {
        transfers.push({ to: this.devWalletAddress, amount: devFee, type: 'dev' });
      }
      
      // Calculate and add winner transfers
      if (totalWinnerBalance > 0n && prizePool > 0n) {
        for (const winner of winnersData) {
          const prize = (winner.balance * prizePool) / totalWinnerBalance;
          const sharePercent = Number((winner.balance * 10000n) / totalWinnerBalance) / 100;
          
          winners.push({
            address: winner.address,
            balance: ethers.formatUnits(winner.balance, 18),
            sharePercent,
            prize: ethers.formatUnits(prize, 18),
          });
          
          if (prize > 0n) {
            transfers.push({ to: winner.address, amount: prize, type: 'winner' });
          }
        }
      }
      
      // Execute transfers
      let transferStatus: 'pending' | 'success' | 'partial' | 'failed' = 'pending';
      
      if (this.autoTransferEnabled && !this.demoMode && transfers.length > 0) {
        console.log(`\n💸 Processing ${transfers.length} transfers...`);
        
        const results = await this.executeBatchTransfer(
          transfers.map(t => ({ to: t.to, amount: t.amount }))
        );
        
        // Update winner txHashes
        for (const result of results) {
          // Check if it's dev fee
          if (result.to.toLowerCase() === this.devWalletAddress.toLowerCase()) {
            if (result.success) {
              this.totalDevPaid += devFee;
              console.log(`✅ Dev fee confirmed: ${result.txHash}`);
            }
            continue;
          }
          
          // Find matching winner
          const winner = winners.find(w => w.address.toLowerCase() === result.to.toLowerCase());
          if (winner && result.success) {
            winner.txHash = result.txHash;
            this.totalPrizePaid += ethers.parseUnits(winner.prize, 18);
          }
        }
        
        // Determine overall status
        const successful = results.filter(r => r.success).length;
        if (successful === results.length) {
          transferStatus = 'success';
        } else if (successful > 0) {
          transferStatus = 'partial';
        } else {
          transferStatus = 'failed';
        }
      } else if (this.demoMode) {
        // Demo mode - simulate successful transfers
        for (const winner of winners) {
          winner.txHash = '0x' + 'demo'.repeat(16);
        }
        transferStatus = 'success';
      }
      
      // Build result
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
        transferStatus,
      };
      
      // Save to history
      this.drawHistory.unshift(result);
      if (this.drawHistory.length > 100) {
        this.drawHistory.pop();
      }
      
      // Clear snapshot
      this.currentSnapshot = null;
      
      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('🎉 DRAW #' + drawId + ' COMPLETE');
      console.log('='.repeat(50));
      console.log(`Winning Number: ${winningNumber}`);
      console.log(`Winners: ${winners.length}`);
      console.log(`Transfer Status: ${transferStatus}`);
      
      // Update balances
      if (!this.demoMode) {
        await this.updateBalances();
      }
      
      // Broadcast event
      if (this.onDraw) {
        console.log('📢 Broadcasting draw result...');
        this.onDraw(result);
      }
      
    } catch (error: any) {
      console.error('❌ Draw error:', error.message);
    } finally {
      this.isProcessingDraw = false;
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
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    const trackerStats = this.holderTracker.getStats();
    
    return {
      isRunning: this.isRunning,
      isProcessingDraw: this.isProcessingDraw,
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
      stats: trackerStats,
      // Add scanning status
      scanning: {
        isScanning: trackerStats.isScanning,
        progress: trackerStats.scanProgress,
        lastBlock: trackerStats.lastScannedBlock,
      },
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
