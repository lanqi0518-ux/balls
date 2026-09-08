import { ethers } from 'ethers';
import { HolderTracker } from './holder-tracker.js';
import { config } from './config.js';
import { createCommitment, computeWinningNumber } from './draw-random.js';

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
  // Published before the draw, revealed with it: verifyDraw() rechecks that
  // keccak(serverSeed) equals the commitment and reproduces winningNumber.
  commitment: string;
  serverSeed: string;
  autoTransfer: boolean;
  transferStatus: 'pending' | 'success' | 'partial' | 'failed' | 'skipped';
  rollover: boolean; // True if no winners, prize rolls over
}

/**
 * Automated Lottery Service
 * - Prize wallet (3% tax): 100% to winners, keep 0.05 ETH for gas
 * - Publisher auto 1%: forwarded to team wallet in the same draw batch
 */
export class AutoLottery {
  private provider: ethers.JsonRpcProvider | null = null;
  private taxReceiverWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;
  private holderTracker: HolderTracker;
  
  // Wallets
  private taxReceiverAddress: string;
  private devWalletAddress: string;
  private publisherAddress: string;
  private publisherSigner: ethers.Wallet | null = null;
  
  // Balances (all in ETH now, since tax is collected in ETH)
  private ethBalance = 0n; // Total ETH in prize pool wallet (3% tax)
  private currentPrizePool = 0n; // 100% of prize wallet minus gas
  private publisherBalance = 0n; // Publisher auto 1% wallet
  private publisherFee = 0n; // Amount to forward to team wallet
  private ethPriceUsd = 0; // ETH price in USD
  
  // Lottery state
  private currentDrawId = 0;
  
  // Current snapshot
  private currentSnapshot: {
    drawId: number;
    timestamp: number;
    holders: Array<{address: string; number: number; balance: bigint}>;
    hash: string;
    // Secret until the draw is published; only the commitment is broadcast
    serverSeed: string;
    commitment: string;
  } | null = null;
  
  // History
  private drawHistory: DrawResult[] = [];
  
  // Timers
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private balanceTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isProcessingDraw = false;
  
  // Auto transfer
  private autoTransferEnabled = false;
  
  // Schedule state (absolute epoch ms, aligned to the draw interval)
  private nextDrawAt = 0;
  private snapshotTakenForDrawAt = 0;
  private statusCache: { at: number; value: ReturnType<AutoLottery['buildStatus']> } | null = null;
  
  // Stats
  private totalDevPaid = 0n;
  private totalPrizePaid = 0n;
  private totalDraws = 0;
  private failedTransfers = 0;
  
  // Constants
  private readonly MAX_WINNERS_PER_DRAW = 20; // Limit to prevent timeout
  private readonly MIN_GAS_BALANCE = ethers.parseEther('0.05'); // Minimum 0.05 ETH reserved for gas
  private readonly drawIntervalMs = config.drawInterval;
  private readonly snapshotLeadMs = config.snapshotLeadTime;
  // Share of the tax wallet paid to winners (75% by default for a 3+1 tax).
  private readonly prizePoolBps = BigInt(config.prizePoolBps);
  // ETH parked in the tax wallet that isn't part of the pool (seed funds).
  private readonly excludedBaselineWei = ethers.parseEther(
    config.excludedBaselineEth.toString()
  );

  // Demo mode: fabricate holders, prize-pool growth and draws so the site
  // can be shown off without a deployed token contract.
  // Mutable — flipped off the instant the real token address is hot-swapped in.
  private demoMode = config.demoMode;
  private demoHolders: Array<{ address: string; number: number; balance: bigint }> = [];
  // Seed with ~0.5 ETH so the first jackpot the site loads isn't zero
  private demoPoolWei = ethers.parseEther('0.5');
  private demoPoolLastGrownAt = Date.now();
  
  // Event callbacks
  public onDraw: ((result: DrawResult) => void) | null = null;
  public onSnapshot: ((snapshot: any) => void) | null = null;

  constructor(holderTracker: HolderTracker) {
    this.holderTracker = holderTracker;
    this.taxReceiverAddress = config.taxReceiverWallet;
    this.devWalletAddress = config.devWallet;
    this.publisherAddress = (config.publisherWallet || '').trim() || this.taxReceiverAddress;
    
    // Always connect to RPC so the jackpot shows the REAL tax-wallet ETH balance
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    if (config.taxReceiverPrivateKey) {
      const wallet = new ethers.Wallet(config.taxReceiverPrivateKey, this.provider);
      if (wallet.address.toLowerCase() !== this.taxReceiverAddress.toLowerCase()) {
        // Fail loudly instead of signing prize/fee transfers from the wrong
        // account. Without this, transfers would silently come from the
        // signer address (which is probably empty) instead of the tax wallet.
        throw new Error(
          `TAX_RECEIVER_PRIVATE_KEY derives ${wallet.address} but ` +
          `TAX_RECEIVER_WALLET is ${this.taxReceiverAddress}. ` +
          `Refusing to start — fix the key/address pair or clear both.`
        );
      }
      this.taxReceiverWallet = wallet;
      this.autoTransferEnabled = true;
      console.log('✅ Auto transfer enabled — key matches TAX_RECEIVER_WALLET');
      console.log(`📤 Tax wallet (holds 3%+1%): ${this.taxReceiverAddress}`);
      console.log(`🏆 Winners take: ${Number(this.prizePoolBps) / 100}% of the tax wallet each draw`);
      if (this.hasSeparateDevWallet()) {
        console.log(`📤 Team fee forwarded to: ${this.devWalletAddress}`);
      } else {
        console.log('📥 Team fee stays in the tax wallet (no separate DEV wallet set)');
      }
    } else {
      console.log('⚠️ No private key - auto transfer DISABLED');
    }

    // Legacy separate-publisher-wallet path — only kept for backwards compat.
    // Ignored when the publisher wallet is empty or equal to the tax wallet
    // (the current single-wallet model handles the 1% share via the split).
    if (config.publisherPrivateKey) {
      this.publisherSigner = new ethers.Wallet(config.publisherPrivateKey, this.provider);
    }

    if (this.hasSeparatePublisherWallet()) {
      console.log(`📤 Legacy publisher 1% wallet: ${this.publisherAddress}`);
      console.log(`🔑 Publisher signer: ${this.publisherSigner ? 'READY' : 'MISSING KEY — 1% forward disabled'}`);
    }

    if (this.demoMode) {
      console.log('🎭 DEMO_MODE — server will fabricate holders, prize growth and draws');
      this.buildDemoHolders();
    } else if (config.tokenAddress) {
      this.tokenContract = new ethers.Contract(
        config.tokenAddress,
        ERC20_ABI,
        this.taxReceiverWallet || this.provider
      );
    } else {
      console.log('⚠️ No TOKEN_ADDRESS - draws paused until contract is set');
      console.log('💡 Prize pool still reads the real tax-wallet ETH balance');
    }
  }

  /**
   * Populate a stable pool of ~120 fake holders spread across all 50 numbers.
   * Addresses are derived deterministically so they persist across reboots,
   * which keeps things like "your number" for a demo wallet stable.
   */
  private buildDemoHolders() {
    this.demoHolders = [];
    for (let i = 0; i < 120; i++) {
      const seed = ethers.keccak256(ethers.toUtf8Bytes(`balls-demo-holder-${i}`));
      // 40 hex chars off the hash → address-shaped string for the UI
      const address = '0x' + seed.slice(2, 42);
      // Uniform-ish spread across numbers 1..50 with some clumping for realism
      const number = ((i * 17 + 3) % 50) + 1;
      // Balance range 500..5500 BALLS so shares vary in the winners split
      const balls = 500 + ((i * 47) % 5000);
      const balance = ethers.parseUnits(String(balls), 18);
      this.demoHolders.push({ address, number, balance });
    }
  }

  /**
   * Draws run on a wall-clock aligned grid so every instance and every client
   * agrees on when the next one happens.
   */
  private alignedDrawAfter(timestampMs: number): number {
    return (Math.floor(timestampMs / this.drawIntervalMs) + 1) * this.drawIntervalMs;
  }

  private getTimeUntilDraw(): number {
    if (!this.nextDrawAt) return Math.ceil(this.drawIntervalMs / 1000);
    return Math.max(0, Math.ceil((this.nextDrawAt - Date.now()) / 1000));
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.nextDrawAt = this.alignedDrawAfter(Date.now());

    console.log('\n🎱 Starting Balls Lottery');
    console.log(`Prize Pool Wallet: ${this.taxReceiverAddress}`);
    console.log(`Team Wallet: ${this.devWalletAddress}`);
    console.log(`Draw Time: every ${this.drawIntervalMs / 1000}s, snapshot ${this.snapshotLeadMs / 1000}s earlier`);
    console.log(
      `Mode: ${
        this.demoMode
          ? 'DEMO (fake holders + fake prize growth)'
          : this.tokenContract
            ? 'Live'
            : 'Waiting for TOKEN_ADDRESS (real wallet balance)'
      }`
    );
    console.log(`Auto Transfer: ${this.autoTransferEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Max Winners/Draw: ${this.MAX_WINNERS_PER_DRAW}`);

    if (config.autoDrawEnabled) {
      this.intervalTimer = setInterval(() => {
        this.tick();
      }, 500);
    } else {
      console.log('⏸️ AUTO_DRAW_ENABLED=false - scheduler not started');
    }

    // Poll the tax wallet balance every 3 s so the UI's jackpot number
    // catches new tax within ~1 block on Robinhood Chain (~2 s blocks). Each
    // successful update triggers a `status` SSE broadcast, so subscribed
    // clients see the change without needing to poll themselves.
    this.updateBalances().then(() => this.emitStatusIfChanged());
    this.balanceTimer = setInterval(async () => {
      await this.updateBalances();
      this.emitStatusIfChanged();
    }, 3000);
  }

  // Broadcast a `status` SSE event whenever the derived jackpot number
  // actually changes. Skipping unchanged frames keeps this cheap even at 3 s.
  private lastBroadcastPrizePool: bigint | null = null;
  private emitStatusIfChanged() {
    if (!this.onStatusChange) return;
    if (this.lastBroadcastPrizePool === this.currentPrizePool) return;
    this.lastBroadcastPrizePool = this.currentPrizePool;
    this.onStatusChange();
  }
  public onStatusChange: (() => void) | null = null;

  stop() {
    if (!this.isRunning) return;
    
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.balanceTimer) {
      clearInterval(this.balanceTimer);
      this.balanceTimer = null;
    }
    
    this.isRunning = false;
    console.log('Lottery stopped');
  }

  private hasSeparatePublisherWallet(): boolean {
    return (
      this.publisherAddress !== '' &&
      this.publisherAddress.toLowerCase() !== this.taxReceiverAddress.toLowerCase()
    );
  }

  private hasSeparateDevWallet(): boolean {
    return (
      !!this.devWalletAddress &&
      this.devWalletAddress.toLowerCase() !== this.taxReceiverAddress.toLowerCase()
    );
  }

  private getSpendable(balance: bigint): bigint {
    // Leave gas AND the operator's excluded baseline in the wallet.
    const floor = this.MIN_GAS_BALANCE + this.excludedBaselineWei;
    return balance > floor ? balance - floor : 0n;
  }

  /**
   * Split a spendable balance into (prizePool, teamFee) using prizePoolBps.
   * With the default 7500 bps, a 4 ETH balance splits into 3 ETH for winners
   * and 1 ETH for the team — matching the 3%+1% on-chain tax split.
   */
  private splitTax(spendable: bigint): { prize: bigint; team: bigint } {
    const prize = (spendable * this.prizePoolBps) / 10000n;
    return { prize, team: spendable - prize };
  }

  /**
   * Update ETH balance and price.
   * Prize pool = 100% of the 3% tax wallet, minus 0.05 ETH gas.
   * Publisher 1% is tracked separately and forwarded at draw time.
   */
  private async updateBalances() {
    if (this.demoMode) {
      this.growDemoPool();
      this.ethBalance = this.demoPoolWei;
      // Only apply the gas floor — the excluded operator baseline is a real-
      // wallet concept and would nonsensically shrink the fake demo jackpot.
      const spendable = this.ethBalance > this.MIN_GAS_BALANCE
        ? this.ethBalance - this.MIN_GAS_BALANCE
        : 0n;
      const { prize, team } = this.splitTax(spendable);
      this.currentPrizePool = prize;
      this.publisherFee = team;
      this.publisherBalance = 0n;
      this.ethPriceUsd = await fetchEthPrice();
      return;
    }

    if (!this.provider) return;

    try {
      // Single-wallet model: this balance contains BOTH the 3% and the 1%,
      // and the split lives entirely in software. Winners get prizePoolBps of
      // it; the rest is the team fee.
      this.ethBalance = await this.provider.getBalance(this.taxReceiverAddress);
      const spendable = this.getSpendable(this.ethBalance);
      const { prize, team } = this.splitTax(spendable);
      this.currentPrizePool = prize;
      this.publisherFee = team;

      if (this.hasSeparatePublisherWallet()) {
        // Legacy path: a real separate on-chain publisher wallet. Its balance
        // adds to the team fee (which then gets forwarded together at draw).
        this.publisherBalance = await this.provider.getBalance(this.publisherAddress);
        this.publisherFee = team + this.getSpendable(this.publisherBalance);
      } else {
        this.publisherBalance = 0n;
      }

      this.ethPriceUsd = await fetchEthPrice();
    } catch (error: any) {
      console.error('❌ Failed to update balance:', error.message);
    }
  }

  /**
   * Grow the demo prize pool linearly with wall-clock time so the UI's
   * live-ticking jackpot keeps climbing. About 0.02 ETH added per second,
   * or ~1.4 ETH per 70-second draw cycle at $2500 ETH ≈ $3.5k jackpot.
   */
  private growDemoPool() {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - this.demoPoolLastGrownAt);
    if (elapsedMs === 0) return;
    // 0.00002 ETH per ms → 0.02 ETH per second → ~1.4 ETH over 70s
    const growthWei = ethers.parseEther('0.00002') * BigInt(elapsedMs);
    this.demoPoolWei += growthWei;
    this.demoPoolLastGrownAt = now;
  }

  /**
   * Stats surface expected by the API — mimics HolderTracker.getStats() so
   * the UI shows meaningful numbers in demo mode.
   */
  private buildDemoStats() {
    const total = this.demoHolders.length;
    const eligible = this.currentSnapshot?.holders.length ?? Math.min(total, 25);
    return {
      totalHolders: total,
      holdersWithTime: total,
      eligibleHolders: eligible,
      topHoldersLimit: config.topHoldersLimit,
      minHoldingDuration: config.minHoldingDuration,
      isScanning: false,
      scanProgress: 100,
      lastScannedBlock: 0,
      excludedCount: 0,
      scanComplete: true,
      missedBlockRanges: 0,
    };
  }

  /**
   * Return a randomised subset of the demo holder pool to simulate the
   * "who was eligible at snapshot" list. Sized so ~1 in 3 draws has a winner.
   */
  private getDemoEligible() {
    // Pick ~18-30 holders each snapshot; that gives ~40-60% chance the winning
    // number lands on someone (with 50 numbers), so rollovers still happen
    // often enough to look real.
    const size = 18 + Math.floor(Math.random() * 13);
    const pool = [...this.demoHolders];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, size);
  }

  /**
   * Check if we have enough ETH for transfers (need some reserve for gas)
   */
  private hasEnoughForTransfers(): boolean {
    // Need gas reserve + operator baseline to remain after transfers
    return this.ethBalance > this.MIN_GAS_BALANCE + this.excludedBaselineWei;
  }

  private tick() {
    if (!this.tokenContract && !this.demoMode) return;

    const now = Date.now();

    // Freeze the participant list snapshotLeadMs before the draw.
    if (now >= this.nextDrawAt - this.snapshotLeadMs && this.snapshotTakenForDrawAt !== this.nextDrawAt) {
      this.snapshotTakenForDrawAt = this.nextDrawAt;
      this.takeSnapshot();
    }

    if (now >= this.nextDrawAt && !this.isProcessingDraw) {
      // Advance the schedule before awaiting so a slow draw cannot fire twice,
      // and so a draw that overruns skips to the next grid slot instead of
      // firing back-to-back.
      this.nextDrawAt = this.alignedDrawAfter(now);
      this.executeDraw();
    }
  }

  private takeSnapshot() {
    const nextDrawId = this.currentDrawId + 1;
    const eligible = this.demoMode
      ? this.getDemoEligible()
      : this.holderTracker.getEligibleHolders();
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
    
    // Commit to a secret seed now, reveal it with the result. Publishing the
    // commitment before the draw is what makes the outcome checkable.
    const { serverSeed, commitment } = createCommitment();

    this.currentSnapshot = { drawId: nextDrawId, timestamp, holders, hash, serverSeed, commitment };
    
    const prizePool = this.currentPrizePool;
    
    const prizePoolEth = ethers.formatEther(prizePool);
    const prizeUsd = (parseFloat(prizePoolEth) * this.ethPriceUsd).toFixed(2);
    
    console.log(`\n📸 Snapshot Locked (Top ${config.topHoldersLimit} Holders)`);
    console.log(`Draw: #${nextDrawId} | Eligible: ${holders.length} | Prize Pool: ${prizePoolEth} ETH ($${prizeUsd})`);
    console.log(`🔒 Commitment: ${commitment}`);
    
    if (this.onSnapshot) {
      this.onSnapshot({ drawId: nextDrawId, eligibleCount: holders.length, hash, timestamp, commitment });
    }
  }

  /**
   * Execute a single ETH transfer with retry
   */
  private async executeTransfer(
    to: string, 
    amount: bigint,
    retries = 3,
    signer?: ethers.Wallet | null
  ): Promise<TransferResult> {
    const wallet = signer || this.taxReceiverWallet;
    if (!wallet) {
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

        const nonce = await wallet.getNonce();

        // Robinhood Chain charges 21001 gas for a plain ETH transfer, not the
        // Ethereum-standard 21000. Ask the chain each time and add a small
        // safety margin so we're future-proof against any chain re-pricings.
        let gasLimit: bigint;
        try {
          const est = await wallet.estimateGas({ to, value: amount });
          gasLimit = (est * 12n) / 10n; // +20% headroom
        } catch {
          gasLimit = 30000n; // Fallback covers 21001 + margin for any chain
        }

        const tx = await wallet.sendTransaction({
          to,
          value: amount,
          nonce,
          gasLimit,
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
    
    // Check total amount needed (gas reserve + operator baseline must stay put)
    const totalNeeded = validTransfers.reduce((sum, t) => sum + t.amount, 0n);
    const reserveFloor = this.MIN_GAS_BALANCE + this.excludedBaselineWei;
    const totalWithGas = totalNeeded + reserveFloor;

    const totalEth = ethers.formatEther(totalNeeded);
    const totalUsd = (parseFloat(totalEth) * this.ethPriceUsd).toFixed(2);
    console.log(`  💰 Total needed: ${totalEth} ETH ($${totalUsd})`);
    console.log(`  💳 Available: ${ethers.formatEther(this.ethBalance)} ETH`);
    if (this.excludedBaselineWei > 0n) {
      console.log(`  🔒 Excluded baseline: ${ethers.formatEther(this.excludedBaselineWei)} ETH (stays put)`);
    }

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
      
      if (this.tokenContract) {
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
      
      // Single-wallet model: the tax wallet holds 3% + 1% of trading volume.
      // Winners share the 3% (75%) portion; the 1% (25%) is either forwarded
      // to a separate team wallet in this same batch, or left in place.
      await this.updateBalances();
      const prizePool = this.currentPrizePool;
      const publisherFee = this.publisherFee;

      const ethBalanceStr = ethers.formatEther(this.ethBalance);
      const prizePoolStr = ethers.formatEther(prizePool);
      const publisherFeeStr = ethers.formatEther(publisherFee);
      const prizeUsd = (parseFloat(prizePoolStr) * this.ethPriceUsd).toFixed(2);

      console.log(`💵 Tax wallet balance: ${ethBalanceStr} ETH`);
      console.log(`🏆 Prize Pool to winners: ${prizePoolStr} ETH ($${prizeUsd})`);
      if (this.hasSeparateDevWallet()) {
        console.log(`📤 Team fee to forward: ${publisherFeeStr} ETH → ${this.devWalletAddress}`);
      } else {
        console.log(`📥 Team fee stays in tax wallet: ${publisherFeeStr} ETH`);
      }
      console.log(`📈 ETH Price: $${this.ethPriceUsd}`)
      
      // Prepare transfers
      const transfers: Array<{to: string; amount: bigint; type: 'dev' | 'winner'}> = [];
      const winners: WinnerShare[] = [];
      
      // ⚠️ JACKPOT ROLLOVER: If no winners, ENTIRE prize pool rolls over to next draw
      // Publisher 1% is only forwarded when there ARE winners (same batch as prizes)
      const hasWinners = totalWinnerBalance > 0n && winnersData.length > 0;
      
      if (hasWinners) {
        // Winner transfers (ETH prizes) — 3% tax wallet, 100% of spendable
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
      
      // Execute transfers: publisher 1% forward + winner prizes in the same draw
      let transferStatus: 'pending' | 'success' | 'partial' | 'failed' | 'skipped' = 'pending';
      // Only counts what actually landed, so the UI cannot claim the team was
      // paid when the signer was missing or the transfer failed.
      let devFeeForwarded = 0n;
      
      if (this.autoTransferEnabled) {
        if (!hasWinners) {
          transferStatus = 'skipped';
          console.log('ℹ️ No winners — prize pool and publisher 1% roll over');
        } else if (transfers.length === 0 && publisherFee === 0n) {
          transferStatus = 'skipped';
          console.log('ℹ️ No transfers needed');
        } else {
          const results: TransferResult[] = [];
          console.log(`\n💸 Processing draw payouts...`);

          // Team fee forward. Two scenarios:
          //   * Single-wallet model (default): the 25% share lives in the tax
          //     wallet. Forward it out of taxReceiverWallet to devWallet.
          //   * Legacy separate-publisher-wallet: 25% may live in a different
          //     on-chain address that has its own signer.
          if (publisherFee > 0n && this.hasSeparateDevWallet()) {
            const feeSigner = this.publisherSigner ?? this.taxReceiverWallet;
            if (feeSigner) {
              console.log('\n📤 Forwarding team fee to team wallet (same batch as prizes)...');
              const feeResult = await this.executeTransfer(
                this.devWalletAddress,
                publisherFee,
                3,
                feeSigner
              );
              results.push(feeResult);
              if (feeResult.success) {
                this.totalDevPaid += publisherFee;
                devFeeForwarded = publisherFee;
              }
              await this.delay(500);
            } else {
              console.log('⚠️ Team fee not forwarded — no signer for the tax wallet');
            }
          } else if (publisherFee > 0n) {
            console.log('📥 Team fee stays in tax wallet (DEV_WALLET == tax wallet)');
          }

          if (transfers.length > 0) {
            const prizeResults = await this.executeBatchTransfer(
              transfers.map(t => ({ to: t.to, amount: t.amount }))
            );
            results.push(...prizeResults);

            for (const prizeResult of prizeResults) {
              const winner = winners.find(w => w.address.toLowerCase() === prizeResult.to.toLowerCase());
              if (winner && prizeResult.success) {
                winner.txHash = prizeResult.txHash;
                this.totalPrizePaid += ethers.parseUnits(winner.prize, 18);
              }
            }
          }
          
          const successful = results.filter(r => r.success).length;
          if (results.length === 0) {
            transferStatus = 'skipped';
          } else if (successful === results.length) {
            transferStatus = 'success';
          } else if (successful > 0) {
            transferStatus = 'partial';
          } else {
            transferStatus = 'failed';
          }
        }
      }

      if (this.demoMode) {
        // No real transfers happen in demo mode, but the UI still wants to see
        // a completed draw. Winners "sweep" the pool; rollovers keep growing.
        transferStatus = hasWinners ? 'success' : 'skipped';
        if (hasWinners) {
          this.demoPoolWei = ethers.parseEther('0.1'); // small residual so the next cycle starts non-zero
          this.demoPoolLastGrownAt = Date.now();
        }
      }

      // Build result
      const result: DrawResult = {
        drawId,
        timestamp: Math.floor(Date.now() / 1000),
        winningNumber,
        prizePool: ethers.formatEther(prizePool), // ETH
        devFee: ethers.formatEther(devFeeForwarded), // 1% actually forwarded
        winnersCount: winners.length,
        totalWinnerBalance: ethers.formatUnits(totalWinnerBalance, 18), // BALLS tokens
        winners,
        snapshotHash: snapshot.hash,
        commitment: snapshot.commitment,
        serverSeed: snapshot.serverSeed,
        autoTransfer: this.autoTransferEnabled,
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
      
      await this.updateBalances();
      
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
    const snapshot = this.currentSnapshot;
    if (!snapshot) {
      throw new Error('Cannot draw a number without a snapshot');
    }

    return computeWinningNumber(snapshot.serverSeed, drawId, snapshot.hash);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Live switch from demo mode to a real, freshly-deployed token. No process
   * restart required — the next tick uses the real snapshot.
   *
   * Returns immediately; the tracker keeps scanning in the background.
   */
  async switchToLiveToken(newAddress: string): Promise<void> {
    const addr = newAddress.trim();
    console.log(`\n🚀 Switching auto-lottery to LIVE token → ${addr}`);

    this.demoMode = false;
    this.demoHolders = [];
    this.demoPoolWei = 0n;

    (config as { tokenAddress: string }).tokenAddress = addr;
    this.tokenContract = new ethers.Contract(
      addr,
      ERC20_ABI,
      this.taxReceiverWallet || this.provider
    );

    await this.holderTracker.setTokenAddress(addr);

    // Force a fresh balance read so the SSE broadcast has the real ETH figure.
    try {
      await this.updateBalances();
      this.statusCache = null;
    } catch (e: any) {
      console.warn('⚠️ Post-swap balance refresh failed:', e.message);
    }
    console.log('✅ Live mode active — next draw uses real holders.\n');
  }

  getStatus() {
    const now = Date.now();
    if (this.statusCache && now - this.statusCache.at < 1500) {
      return {
        ...this.statusCache.value,
        timeUntilNextDraw: this.getTimeUntilDraw(),
      };
    }

    const value = this.buildStatus();
    this.statusCache = { at: now, value };
    return value;
  }

  private buildStatus() {
    const prizePool = this.currentPrizePool;
    const trackerStats = this.demoMode
      ? this.buildDemoStats()
      : this.holderTracker.getStats();

    const prizePoolEth = parseFloat(ethers.formatEther(prizePool));
    const prizePoolUsd = prizePoolEth * this.ethPriceUsd;
    const ethBalanceUsd = parseFloat(ethers.formatEther(this.ethBalance)) * this.ethPriceUsd;
    
    return {
      isRunning: this.isRunning,
      isProcessingDraw: this.isProcessingDraw,
      currentDrawId: this.currentDrawId,
      timeUntilNextDraw: this.getTimeUntilDraw(),
      nextDrawAt: this.nextDrawAt,
      drawIntervalMs: this.drawIntervalMs,
      snapshotLeadMs: this.snapshotLeadMs,
      hasSnapshot: !!this.currentSnapshot,
      prizePool: ethers.formatEther(prizePool),
      prizePoolUsd: prizePoolUsd.toFixed(2),
      ethBalance: ethers.formatEther(this.ethBalance),
      ethBalanceUsd: ethBalanceUsd.toFixed(2),
      ethPriceUsd: this.ethPriceUsd,
      hasEnoughForTransfers: this.hasEnoughForTransfers(),
      taxReceiverWallet: this.taxReceiverAddress,
      publisherWallet: this.hasSeparatePublisherWallet() ? this.publisherAddress : '',
      publisherFee: ethers.formatEther(this.publisherFee),
      devWallet: this.devWalletAddress,
      autoTransferEnabled: this.autoTransferEnabled,
      demoMode: this.demoMode,
      tokenConfigured: this.demoMode ? true : !!this.tokenContract,
      excludedBaselineEth: ethers.formatEther(this.excludedBaselineWei),
      prizeInEth: true,
      totalDevPaid: ethers.formatEther(this.totalDevPaid),
      totalPrizePaid: ethers.formatEther(this.totalPrizePaid),
      totalDraws: this.totalDraws,
      failedTransfers: this.failedTransfers,
      snapshot: this.currentSnapshot ? {
        drawId: this.currentSnapshot.drawId,
        eligibleCount: this.currentSnapshot.holders.length,
        hash: this.currentSnapshot.hash,
        // Commitment only; the seed stays secret until the draw is published
        commitment: this.currentSnapshot.commitment,
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
        isInTopHolders: false,
        shareInNumber: 0,
      };
    }
    
    const participants = this.holderTracker.getEligibleHolders();
    const isInTopHolders = participants.some(h => h.address === addr);
    
    const sameNumberHolders = participants.filter(h => h.number === holder.number);
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
      isEligible: isInTopHolders, // Only the top-N participants can win
      isInTopHolders,
      topHoldersLimit: config.topHoldersLimit,
      rank, // User's rank by balance
      shareInNumber: isInTopHolders ? shareInNumber : 0,
      sameNumberHolders: sameNumberHolders.length,
    };
  }

  getNumberDistribution() {
    // In demo mode reuse the current snapshot when we have one so the strip on
    // the UI matches the eligibility list; otherwise fall back to the full
    // fake holder pool for a stable pre-first-draw view.
    const holders = this.demoMode
      ? (this.currentSnapshot?.holders ?? this.demoHolders)
      : this.holderTracker.getEligibleHolders();
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
