import { ethers } from 'ethers';
import { HolderTracker } from './holder-tracker.js';
import { config } from './config.js';

// ERC20 ABI (for token holder tracking only)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ETH price cache
let ethPriceUsd = 0;
let lastPriceUpdate = 0;

/**
 * Fetch ETH price in USD
 */
async function fetchEthPrice(): Promise<number> {
  const now = Date.now();
  // Cache for 60 seconds
  if (ethPriceUsd > 0 && now - lastPriceUpdate < 60000) {
    return ethPriceUsd;
  }
  
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json() as { ethereum?: { usd?: number } };
    ethPriceUsd = data.ethereum?.usd || 0;
    lastPriceUpdate = now;
    console.log(`💵 ETH Price: $${ethPriceUsd}`);
    return ethPriceUsd;
  } catch (error: any) {
    console.error('Failed to fetch ETH price:', error.message);
    return ethPriceUsd || 2500; // Fallback
  }
}

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
  transferStatus: 'pending' | 'success' | 'partial' | 'failed' | 'skipped';
  rollover: boolean; // True if no winners, prize rolls over
}

/**
 * Automated Lottery Service
 * - Tax split: 1% to dev, 3% to prize pool
 * - Sequential transfers with balance checks
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider | null = null;
  private taxReceiverWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Wallets
  private taxReceiverAddress: string;
  private devWalletAddress: string;
  
  // Balances (all in ETH now, since tax is collected in ETH)
  private ethBalance = 0n; // Total ETH in tax receiver wallet
  private currentPrizePool = 0n; // 75% for prizes
  private ethPriceUsd = 0; // ETH price in USD
  
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
  private isProcessingDraw = false;
  
  // Auto transfer
  private autoTransferEnabled = false;
  
  // Track state
  private lastDrawMinute = -1;
  private snapshotTakenForMinute = -1;
  
  // Stats
  private totalDevPaid = 0n;
  private totalPrizePaid = 0n;
  private totalDraws = 0;
  private failedTransfers = 0;
  
  // Constants
  private readonly MAX_WINNERS_PER_DRAW = 20; // Limit to prevent timeout
  private readonly MIN_GAS_BALANCE = ethers.parseEther('0.05'); // Minimum 0.05 ETH reserved for gas
  
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
        console.log(`📤 Tax Receiver: ${this.taxReceiverAddress}`);
        console.log(`📤 Dev wallet: ${this.devWalletAddress}`);
        console.log(`💰 Tax split: ${config.devSharePercent}% dev / ${100 - config.devSharePercent}% prize`);
      } else {
        console.log('⚠️ No private key - auto transfer DISABLED');
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
    console.log(`Auto Transfer: ${this.autoTransferEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Max Winners/Draw: ${this.MAX_WINNERS_PER_DRAW}`);
    
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
   * Update ETH balance and price
   */
  private async updateBalances() {
    if (!this.provider || this.demoMode) return;
    
    try {
      // Get ETH balance (tax is collected in ETH)
      this.ethBalance = await this.provider.getBalance(this.taxReceiverAddress);
      this.currentPrizePool = (this.ethBalance * 75n) / 100n; // 75% for prizes
      
      // Update ETH price
      this.ethPriceUsd = await fetchEthPrice();
    } catch (error: any) {
      console.error('❌ Failed to update balance:', error.message);
    }
  }

  /**
   * Check if we have enough ETH for transfers (need some reserve for gas)
   */
  private hasEnoughForTransfers(): boolean {
    if (this.demoMode) return true;
    // Need at least 0.01 ETH reserve for gas after transfers
    return this.ethBalance > this.MIN_GAS_BALANCE;
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
    
    const prizePoolEth = ethers.formatEther(prizePool);
    const prizeUsd = (parseFloat(prizePoolEth) * this.ethPriceUsd).toFixed(2);
    
    console.log('\n📸 Snapshot Locked (Top 200 Holders)');
    console.log(`Draw: #${nextDrawId} | Eligible: ${holders.length} | Prize Pool: ${prizePoolEth} ETH ($${prizeUsd})`);
    
    if (this.onSnapshot) {
      this.onSnapshot({ drawId: nextDrawId, eligibleCount: holders.length, hash, timestamp });
    }
  }

  /**
   * Execute a single ETH transfer with retry
   */
  private async executeTransfer(
    to: string, 
    amount: bigint,
    retries = 3
  ): Promise<TransferResult> {
    if (!this.taxReceiverWallet) {
      return {
        to,
        amount: ethers.formatEther(amount),
        success: false,
        error: 'Wallet not configured'
      };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const amountInEth = ethers.formatEther(amount);
        const amountUsd = (parseFloat(amountInEth) * this.ethPriceUsd).toFixed(2);
        console.log(`  📤 Sending ${amountInEth} ETH ($${amountUsd}) → ${to.slice(0, 10)}... (attempt ${attempt})`);
        
        // Get fresh nonce
        const nonce = await this.taxReceiverWallet.getNonce();
        
        // Send ETH transaction
        const tx = await this.taxReceiverWallet.sendTransaction({
          to,
          value: amount,
          nonce,
          gasLimit: 21000n, // Standard ETH transfer
        });
        
        console.log(`  ⏳ Tx: ${tx.hash.slice(0, 20)}...`);
        
        // Wait for confirmation with timeout
        const receipt = await Promise.race([
          tx.wait(1),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout 60s')), 60000)
          )
        ]) as ethers.TransactionReceipt;
        
        if (receipt?.status === 1) {
          console.log(`  ✅ Confirmed!`);
          return {
            to,
            amount: amountInEth,
            success: true,
            txHash: tx.hash,
          };
        } else {
          throw new Error('Transaction reverted');
        }
        
      } catch (error: any) {
        console.error(`  ❌ Attempt ${attempt} failed:`, error.message?.slice(0, 50));
        
        if (attempt < retries) {
          await this.delay(2000 * attempt);
        } else {
          this.failedTransfers++;
          return {
            to,
            amount: ethers.formatEther(amount),
            success: false,
            error: error.message?.slice(0, 100),
          };
        }
      }
    }
    
    return {
      to,
      amount: ethers.formatEther(amount),
      success: false,
      error: 'Max retries exceeded',
    };
  }

  /**
   * Execute batch ETH transfer sequentially
   */
  private async executeBatchTransfer(
    transfers: Array<{to: string; amount: bigint}>
  ): Promise<TransferResult[]> {
    const results: TransferResult[] = [];
    
    // Filter out zero amounts
    const validTransfers = transfers.filter(t => t.amount > 0n);
    
    if (validTransfers.length === 0) {
      console.log('  ℹ️ No transfers to process');
      return results;
    }
    
    console.log(`\n📦 Processing ${validTransfers.length} ETH transfers...`);
    
    // Check total amount needed (including gas reserve)
    const totalNeeded = validTransfers.reduce((sum, t) => sum + t.amount, 0n);
    const gasReserve = this.MIN_GAS_BALANCE;
    const totalWithGas = totalNeeded + gasReserve;
    
    const totalEth = ethers.formatEther(totalNeeded);
    const totalUsd = (parseFloat(totalEth) * this.ethPriceUsd).toFixed(2);
    console.log(`  💰 Total needed: ${totalEth} ETH ($${totalUsd})`);
    console.log(`  💳 Available: ${ethers.formatEther(this.ethBalance)} ETH`);
    
    if (totalWithGas > this.ethBalance) {
      console.log(`  ❌ Insufficient ETH balance!`);
      return validTransfers.map(t => ({
        to: t.to,
        amount: ethers.formatEther(t.amount),
        success: false,
        error: 'Insufficient ETH balance'
      }));
    }
    
    // Process transfers
    for (let i = 0; i < validTransfers.length; i++) {
      const transfer = validTransfers[i];
      
      console.log(`\n[${i + 1}/${validTransfers.length}]`);
      const result = await this.executeTransfer(transfer.to, transfer.amount);
      results.push(result);
      
      // Delay between transfers
      if (i < validTransfers.length - 1) {
        await this.delay(500);
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`\n📊 Summary: ${successful}✅ ${failed}❌`);
    
    return results;
  }

  private async executeDraw() {
    if (this.isProcessingDraw) {
      console.log('⚠️ Draw already in progress, skipping...');
      return;
    }
    
    this.isProcessingDraw = true;
    this.totalDraws++;
    
    try {
      if (!this.currentSnapshot) {
        this.takeSnapshot();
      }
      
      const snapshot = this.currentSnapshot!;
      this.currentDrawId++;
      const drawId = this.currentDrawId;
      
      console.log('\n' + '='.repeat(50));
      console.log('🎱 DRAW #' + drawId);
      console.log('='.repeat(50));
      
      // Get winning number
      const winningNumber = this.generateWinningNumber(drawId);
      console.log(`🎯 Winning Number: ${winningNumber}`);
      
      // Find winners from snapshot
      const snapshotWinners = snapshot.holders.filter(h => h.number === winningNumber);
      
      // ⚠️ IMPORTANT: Get REAL-TIME balances for winners (not snapshot balances)
      // This prevents issues where someone sold between snapshot and draw
      let winnersData: Array<{address: string; number: number; balance: bigint}> = [];
      
      if (!this.demoMode && this.tokenContract) {
        console.log(`🔄 Fetching real-time balances for ${snapshotWinners.length} potential winners...`);
        
        for (const winner of snapshotWinners) {
          try {
            const realBalance = await this.tokenContract.balanceOf(winner.address);
            if (realBalance > 0n) {
              winnersData.push({
                address: winner.address,
                number: winner.number,
                balance: realBalance, // Use REAL balance, not snapshot
              });
            } else {
              console.log(`  ⏭️ ${winner.address.slice(0, 10)}... sold all tokens, skipping`);
            }
          } catch {
            // If balance check fails, use snapshot balance
            winnersData.push(winner);
          }
        }
      } else {
        winnersData = snapshotWinners;
      }
      
      // Sort by balance (highest first) and limit
      winnersData = winnersData
        .sort((a, b) => (b.balance > a.balance ? 1 : -1))
        .slice(0, this.MAX_WINNERS_PER_DRAW);
      
      const totalWinnerBalance = winnersData.reduce((sum, h) => sum + h.balance, 0n);
      
      console.log(`👥 Winners: ${winnersData.length}` + 
        (winnersData.length === this.MAX_WINNERS_PER_DRAW ? ' (limited)' : ''));
      
      // Calculate amounts (all in ETH now)
      let devFee = 0n;
      let prizePool: bigint;
      
      if (this.demoMode) {
        prizePool = this.demoPrizePool;
        devFee = (prizePool * 25n) / 75n;
      } else {
        await this.updateBalances();
        devFee = (this.ethBalance * BigInt(config.devSharePercent)) / 100n;
        prizePool = this.currentPrizePool;
      }
      
      const ethBalanceStr = ethers.formatEther(this.ethBalance);
      const prizePoolStr = ethers.formatEther(prizePool);
      const devFeeStr = ethers.formatEther(devFee);
      const prizeUsd = (parseFloat(prizePoolStr) * this.ethPriceUsd).toFixed(2);
      
      console.log(`💵 Total ETH: ${ethBalanceStr} ETH`);
      console.log(`💰 Dev Fee: ${devFeeStr} ETH`);
      console.log(`🏆 Prize Pool: ${prizePoolStr} ETH ($${prizeUsd})`);
      console.log(`📈 ETH Price: $${this.ethPriceUsd}`)
      
      // Prepare transfers
      const transfers: Array<{to: string; amount: bigint; type: 'dev' | 'winner'}> = [];
      const winners: WinnerShare[] = [];
      
      // ⚠️ JACKPOT ROLLOVER: If no winners, ENTIRE balance rolls over to next draw
      // Dev fee is ONLY sent when there ARE winners
      const hasWinners = totalWinnerBalance > 0n && winnersData.length > 0;
      
      if (hasWinners) {
        // Dev fee (only when there are winners)
        if (devFee > 0n) {
          transfers.push({ to: this.devWalletAddress, amount: devFee, type: 'dev' });
        }
        
        // Winner transfers (ETH prizes)
        for (const winner of winnersData) {
          const prize = (winner.balance * prizePool) / totalWinnerBalance;
          const sharePercent = Number((winner.balance * 10000n) / totalWinnerBalance) / 100;
          
          winners.push({
            address: winner.address,
            balance: ethers.formatUnits(winner.balance, 18), // BALLS tokens
            sharePercent,
            prize: ethers.formatEther(prize), // ETH prize
          });
          
          if (prize > 0n) {
            transfers.push({ to: winner.address, amount: prize, type: 'winner' });
          }
        }
      } else {
        // NO WINNERS - Prize pool ROLLS OVER to next draw!
        console.log('🎰 NO WINNERS! Prize pool rolls over to next draw!');
        console.log(`💰 Accumulated: ${ethers.formatEther(this.ethBalance)} ETH`);
      }
      
      // Execute transfers
      let transferStatus: 'pending' | 'success' | 'partial' | 'failed' | 'skipped' = 'pending';
      
      if (this.autoTransferEnabled && !this.demoMode) {
        if (transfers.length === 0) {
          transferStatus = 'skipped';
          console.log('ℹ️ No transfers needed');
        } else if (this.ethBalance === 0n) {
          transferStatus = 'skipped';
          console.log('ℹ️ No funds to distribute');
        } else {
          console.log(`\n💸 Processing ${transfers.length} transfers...`);
          
          const results = await this.executeBatchTransfer(
            transfers.map(t => ({ to: t.to, amount: t.amount }))
          );
          
          // Update stats
          for (const result of results) {
            if (result.to.toLowerCase() === this.devWalletAddress.toLowerCase()) {
              if (result.success) {
                this.totalDevPaid += devFee;
              }
              continue;
            }
            
            const winner = winners.find(w => w.address.toLowerCase() === result.to.toLowerCase());
            if (winner && result.success) {
              winner.txHash = result.txHash;
              this.totalPrizePaid += ethers.parseUnits(winner.prize, 18);
            }
          }
          
          const successful = results.filter(r => r.success).length;
          if (successful === results.length && results.length > 0) {
            transferStatus = 'success';
          } else if (successful > 0) {
            transferStatus = 'partial';
          } else {
            transferStatus = 'failed';
          }
        }
      } else if (this.demoMode) {
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
        prizePool: ethers.formatEther(prizePool), // ETH
        devFee: hasWinners ? ethers.formatEther(devFee) : '0', // ETH
        winnersCount: winners.length,
        totalWinnerBalance: ethers.formatUnits(totalWinnerBalance, 18), // BALLS tokens
        winners,
        snapshotHash: snapshot.hash,
        autoTransfer: this.autoTransferEnabled && !this.demoMode,
        transferStatus,
        rollover: !hasWinners, // No winners = rollover
      };
      
      // Save history
      this.drawHistory.unshift(result);
      if (this.drawHistory.length > 100) {
        this.drawHistory.pop();
      }
      
      // Clear snapshot
      this.currentSnapshot = null;
      
      // Summary
      console.log('\n' + '='.repeat(50));
      console.log(`🎉 DRAW #${drawId} COMPLETE`);
      if (hasWinners) {
        console.log(`   Number: ${winningNumber} | Winners: ${winners.length} | Status: ${transferStatus}`);
      } else {
        console.log(`   Number: ${winningNumber} | 🎰 ROLLOVER! No winners - prize accumulates`);
      }
      console.log('='.repeat(50));
      
      // ⚠️ IMPORTANT: Reset all firstSeen timestamps after each draw
      // This ensures only addresses holding for 60+ seconds in THIS round are eligible
      this.holderTracker.resetAllFirstSeen();
      
      // Refresh balance
      if (!this.demoMode) {
        await this.updateBalances();
      }
      
      // Broadcast
      if (this.onDraw) {
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const timeUntilDraw = this.getTimeUntilDraw();
    const prizePool = this.demoMode ? this.demoPrizePool : this.currentPrizePool;
    const trackerStats = this.holderTracker.getStats();
    
    // Calculate USD values
    const prizePoolEth = parseFloat(ethers.formatEther(prizePool));
    const prizePoolUsd = prizePoolEth * this.ethPriceUsd;
    const ethBalanceUsd = parseFloat(ethers.formatEther(this.ethBalance)) * this.ethPriceUsd;
    
    return {
      isRunning: this.isRunning,
      isProcessingDraw: this.isProcessingDraw,
      currentDrawId: this.currentDrawId,
      timeUntilNextDraw: timeUntilDraw,
      hasSnapshot: !!this.currentSnapshot,
      // ETH values
      prizePool: ethers.formatEther(prizePool),
      prizePoolUsd: prizePoolUsd.toFixed(2),
      ethBalance: ethers.formatEther(this.ethBalance),
      ethBalanceUsd: ethBalanceUsd.toFixed(2),
      ethPriceUsd: this.ethPriceUsd,
      // Status
      hasEnoughForTransfers: this.hasEnoughForTransfers(),
      taxReceiverWallet: this.taxReceiverAddress,
      devWallet: this.devWalletAddress,
      autoTransferEnabled: this.autoTransferEnabled,
      demoMode: this.demoMode,
      prizeInEth: true,
      // Stats
      totalDevPaid: ethers.formatEther(this.totalDevPaid),
      totalPrizePaid: ethers.formatEther(this.totalPrizePaid),
      totalDraws: this.totalDraws,
      failedTransfers: this.failedTransfers,
      snapshot: this.currentSnapshot ? {
        drawId: this.currentSnapshot.drawId,
        eligibleCount: this.currentSnapshot.holders.length,
        hash: this.currentSnapshot.hash,
      } : null,
      stats: trackerStats,
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
        isInTop200: false,
        shareInNumber: 0,
      };
    }
    
    // Get top 200 eligible holders
    const top200 = this.holderTracker.getEligibleHolders();
    const isInTop200 = top200.some(h => h.address === addr);
    
    const sameNumberHolders = top200.filter(h => h.number === holder.number);
    const totalInNumber = sameNumberHolders.reduce((sum, h) => sum + h.balance, 0n);
    const shareInNumber = totalInNumber > 0n 
      ? Number((holder.balance * 10000n) / totalInNumber) / 100 
      : 0;
    
    // Find user's rank by balance
    const allHoldersSorted = holders.sort((a, b) => 
      b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0
    );
    const rank = allHoldersSorted.findIndex(h => h.address === addr) + 1;
    
    return {
      address: addr,
      isHolder: true,
      number: holder.number,
      balance: ethers.formatUnits(holder.balance, 18),
      holdingSince: holder.firstSeen,
      isEligible: isInTop200, // Only eligible if in top 200
      isInTop200,
      rank, // User's rank by balance
      shareInNumber: isInTop200 ? shareInNumber : 0,
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
