import { ethers } from 'ethers';
import { config } from './config.js';

/**
 * Holder Tracker - Simple & Direct
 * Monitors Transfer events and tracks all holders
 * Excludes LP pools and system addresses
 */
export class HolderTracker {
  private provider: ethers.JsonRpcProvider | null = null;
  private tokenContract: ethers.Contract | null = null;
  
  // Holder data
  private holders: Map<string, {
    balance: bigint;
    firstSeen: number;
    number: number;
    lastUpdated: number;
  }> = new Map();
  
  // Number to addresses mapping
  private numberToHolders: Map<number, Set<string>> = new Map();
  
  // Minimum holding duration (seconds)
  private minHoldingDuration = config.minHoldingDuration;
  
  // Running state
  private isRunning = false;
  
  // Scan state
  private isScanning = false;
  private scanProgress = 0;
  private lastScannedBlock = 0;
  private missedBlockRanges: Array<{ fromBlock: number; toBlock: number }> = [];
  
  // Refresh interval
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Transfer events are handled one at a time. Each one triggers balanceOf
  // lookups, and running them concurrently lets a slow reply for an earlier
  // event overwrite the balance written by a later one.
  private eventQueue: Promise<void> = Promise.resolve();
  
  // ============ EXCLUDED ADDRESSES ============
  // These addresses are NOT real holders (LP pools, contracts, etc.)
  private readonly EXCLUDED_ADDRESSES: Set<string> = new Set([
    '0x0000000000000000000000000000000000000000', // Zero address
    config.taxReceiverWallet?.toLowerCase() || '',  // Tax receiver
    config.devWallet?.toLowerCase() || '',          // Dev wallet
    ...config.excludedAddresses.map(a => a.toLowerCase()), // From config
  ].filter(a => a.length > 0));
  
  // Constants
  private readonly BLOCKS_PER_QUERY = 5000;
  private readonly REFRESH_INTERVAL_MS = 15000; // Refresh every 15 seconds
  
  constructor() {
    // Initialize number mapping
    for (let i = 1; i <= 50; i++) {
      this.numberToHolders.set(i, new Set());
    }
    
    if (!config.tokenAddress) {
      console.log('⚠️ No TOKEN_ADDRESS - holder tracking paused until contract is set');
      return;
    }
    
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // ERC20 minimal ABI
    const erc20Abi = [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'function balanceOf(address) view returns (uint256)',
    ];
    
    this.tokenContract = new ethers.Contract(
      config.tokenAddress,
      erc20Abi,
      this.provider
    );
    
    console.log('🚫 Excluded addresses:');
    this.EXCLUDED_ADDRESSES.forEach(addr => {
      if (addr) console.log(`   - ${addr}`);
    });
  }
  
  /**
   * Check if address should be excluded
   */
  private isExcluded(address: string): boolean {
    return this.EXCLUDED_ADDRESSES.has(address.toLowerCase());
  }
  
  /**
   * Calculate address number (1-50)
   */
  getNumber(address: string): number {
    const hash = ethers.keccak256(ethers.solidityPacked(['address'], [address]));
    return (Number(BigInt(hash) % 50n) + 1);
  }

  /**
   * Check if address is eligible for draw
   */
  isEligible(address: string): boolean {
    const holder = this.holders.get(address.toLowerCase());
    if (!holder) return false;
    if (holder.balance === 0n) return false;
    
    const holdingDuration = Math.floor(Date.now() / 1000) - holder.firstSeen;
    return holdingDuration >= this.minHoldingDuration;
  }

  /**
   * Add or update holder
   */
  private updateHolder(address: string, balance: bigint, firstSeenTimestamp?: number) {
    const addr = address.toLowerCase();
    
    // Skip excluded addresses (LP pools, contracts, etc.)
    if (this.isExcluded(addr)) {
      return;
    }
    
    const existing = this.holders.get(addr);
    const number = this.getNumber(addr);
    const now = Math.floor(Date.now() / 1000);
    
    if (balance > 0n) {
      if (!existing) {
        // New holder
        this.holders.set(addr, {
          balance,
          firstSeen: firstSeenTimestamp || now,
          number,
          lastUpdated: now,
        });
        this.numberToHolders.get(number)?.add(addr);
        console.log(`📥 New holder: ${addr.slice(0, 10)}... | #${number} | ${ethers.formatUnits(balance, 18)} tokens`);
      } else {
        // Update existing holder
        existing.balance = balance;
        existing.lastUpdated = now;
      }
    } else {
      // Zero balance - remove holder
      if (existing) {
        this.holders.delete(addr);
        this.numberToHolders.get(existing.number)?.delete(addr);
        console.log(`📤 Removed: ${addr.slice(0, 10)}... (zero balance)`);
      }
    }
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    if (!this.tokenContract) {
      console.log('⚠️ Holder tracker waiting for TOKEN_ADDRESS');
      return;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🔍 STARTING HOLDER TRACKER');
    console.log('='.repeat(50));
    console.log(`Token: ${config.tokenAddress}`);
    
    try {
      // Step 1: Scan all historical Transfer events
      await this.scanAllTransfers();
      
      // Step 2: Start listening for new events
      this.startEventListener();
      
      // Step 3: Start periodic balance refresh
      this.startPeriodicRefresh();
      
      console.log('\n' + '='.repeat(50));
      console.log('✅ HOLDER TRACKER READY');
      console.log('='.repeat(50));
      console.log(`Total holders: ${this.holders.size}`);
      console.log(`Eligible holders: ${this.getEligibleHolders().length}`);
      
    } catch (error: any) {
      console.error('❌ Failed to start holder tracker:', error.message);
      console.log('⚠️ Not using fake holders. Set TOKEN_ADDRESS and restart, or call /api/tracker/rescan');
    }
  }

  /**
   * Scan all Transfer events and build holder list
   */
  private async scanAllTransfers(): Promise<void> {
    if (!this.provider || !this.tokenContract) return;
    
    this.isScanning = true;
    
    let currentBlock: number;
    try {
      currentBlock = await this.provider.getBlockNumber();
    } catch (error: any) {
      console.error('❌ Failed to get current block:', error.message);
      this.isScanning = false;
      return;
    }
    
    console.log(`\n📡 Scanning Transfer events...`);
    console.log(`Current block: ${currentBlock}`);
    
    // Collect all unique addresses from events
    const allAddresses = new Set<string>();
    let totalEvents = 0;
    let consecutiveEmptyChunks = 0;
    let failedRanges: Array<{ fromBlock: number; toBlock: number }> = [];
    
    // Scan in chunks from recent to older
    const maxBlocksBack = 500000;
    const startBlock = Math.max(0, currentBlock - maxBlocksBack);
    
    for (let toBlock = currentBlock; toBlock > startBlock; toBlock -= this.BLOCKS_PER_QUERY) {
      const fromBlock = Math.max(startBlock, toBlock - this.BLOCKS_PER_QUERY + 1);
      
      const events = await this.queryTransfers(fromBlock, toBlock);

      if (events === null) {
        // Every retry failed. Remember the gap instead of silently moving on
        // and reporting a holder list that is missing whoever traded here.
        failedRanges.push({ fromBlock, toBlock });
        await this.delay(100);
        continue;
      }

      if (events.length > 0) {
        consecutiveEmptyChunks = 0;
        this.collectAddresses(events, allAddresses);
        totalEvents += events.length;
        console.log(`  📊 Block ${fromBlock}-${toBlock} | +${events.length} events | Total: ${allAddresses.size} addresses`);
      } else {
        consecutiveEmptyChunks++;
      }

      this.lastScannedBlock = fromBlock;
      this.scanProgress = Math.floor(((currentBlock - fromBlock) / (currentBlock - startBlock)) * 100);

      // Stop if 10 consecutive empty chunks (50k blocks)
      if (consecutiveEmptyChunks >= 10) {
        console.log(`  📍 No events in last ${consecutiveEmptyChunks * this.BLOCKS_PER_QUERY} blocks, stopping scan`);
        break;
      }
      
      await this.delay(100);
    }

    // Give the gaps one more pass before giving up on them
    if (failedRanges.length > 0) {
      console.log(`\n🔁 Retrying ${failedRanges.length} block ranges that failed...`);
      const stillFailing: Array<{ fromBlock: number; toBlock: number }> = [];

      for (const range of failedRanges) {
        const events = await this.queryTransfers(range.fromBlock, range.toBlock);
        if (events === null) {
          stillFailing.push(range);
        } else {
          this.collectAddresses(events, allAddresses);
          totalEvents += events.length;
        }
        await this.delay(100);
      }

      failedRanges = stillFailing;
    }

    this.missedBlockRanges = failedRanges;
    this.isScanning = false;
    this.scanProgress = 100;
    
    console.log(`\n📊 Scan complete: ${totalEvents} events, ${allAddresses.size} addresses`);

    if (failedRanges.length > 0) {
      const missedBlocks = failedRanges.reduce(
        (sum, r) => sum + (r.toBlock - r.fromBlock + 1),
        0
      );
      console.error(
        `⚠️ Scan is INCOMPLETE: ${failedRanges.length} ranges (${missedBlocks} blocks) could not be read. ` +
        `Holders that only traded in those blocks are missing. Call /api/tracker/rescan once the RPC recovers.`
      );
    }
    
    // Check balances for all addresses
    await this.checkBalances(allAddresses);
  }

  /**
   * Read Transfer events for one block range. Returns null when every retry
   * failed, so the caller can record the gap rather than treat it as empty.
   */
  private async queryTransfers(
    fromBlock: number,
    toBlock: number
  ): Promise<ethers.Log[] | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const filter = this.tokenContract!.filters.Transfer();
        return await this.tokenContract!.queryFilter(filter, fromBlock, toBlock);
      } catch (error: any) {
        console.error(
          `  ⚠️ Attempt ${attempt} failed for blocks ${fromBlock}-${toBlock}:`,
          error.message
        );
        await this.delay(1000 * attempt);
      }
    }

    return null;
  }

  private collectAddresses(events: ethers.Log[], into: Set<string>): void {
    for (const event of events) {
      const log = event as ethers.EventLog;
      if (!log.args) continue;

      const from = (log.args[0] as string).toLowerCase();
      const to = (log.args[1] as string).toLowerCase();

      if (!this.isExcluded(from)) into.add(from);
      if (!this.isExcluded(to)) into.add(to);
    }
  }

  /**
   * Check balances for a set of addresses with retry
   */
  private async checkBalances(addresses: Set<string>): Promise<void> {
    if (!this.tokenContract || addresses.size === 0) return;
    
    console.log(`\n💰 Checking balances for ${addresses.size} addresses...`);
    
    const now = Math.floor(Date.now() / 1000);
    let checked = 0;
    let withBalance = 0;
    let errors = 0;
    
    const addressArray = Array.from(addresses);
    const batchSize = 10; // Smaller batches for reliability
    
    for (let i = 0; i < addressArray.length; i += batchSize) {
      const batch = addressArray.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (addr) => {
          // Retry up to 3 times
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const balance = await this.tokenContract!.balanceOf(addr);
              return { address: addr, balance, success: true };
            } catch (error: any) {
              if (attempt === 3) {
                return { address: addr, balance: 0n, success: false };
              }
              await this.delay(100 * attempt);
            }
          }
          return { address: addr, balance: 0n, success: false };
        })
      );
      
      for (const { address, balance, success } of results) {
        if (!success) {
          errors++;
          continue;
        }
        
        if (balance > 0n) {
          // Addresses found by the historical scan already held before this
          // process started, so credit them the full holding requirement.
          this.updateHolder(address, balance, now - this.minHoldingDuration);
          withBalance++;
        }
        checked++;
      }
      
      // Progress update
      if (checked % 50 === 0 || i + batchSize >= addressArray.length) {
        console.log(`  ✓ ${checked}/${addresses.size} | Holders: ${withBalance} | Errors: ${errors}`);
      }
      
      await this.delay(50);
    }
    
    console.log(`\n✅ Balance check complete:`);
    console.log(`   - Checked: ${checked}`);
    console.log(`   - With balance: ${withBalance}`);
    console.log(`   - Errors: ${errors}`);
  }

  /**
   * Start listening for new Transfer events with auto-reconnect
   */
  private startEventListener(): void {
    if (!this.tokenContract || !this.provider) return;
    
    console.log('\n👂 Listening for new transfers...');
    
    const setupListener = () => {
      this.tokenContract!.on('Transfer', (from, to, value) => {
        this.enqueueTransfer(from, to, value);
      });
    };
    
    setupListener();
    
    // Monitor connection and reconnect if needed
    this.provider.on('error', (error) => {
      console.error('⚠️ Provider error:', error.message);
    });
    
    // Periodic connection check
    this.connectionCheckInterval = setInterval(async () => {
      try {
        await this.provider!.getBlockNumber();
      } catch (error: any) {
        console.log('🔄 Reconnecting event listener...');
        
        try {
          this.tokenContract!.removeAllListeners('Transfer');
          this.provider!.removeAllListeners();
        } catch { /* ignore */ }
        
        // Recreate provider and contract
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.tokenContract = new ethers.Contract(
          config.tokenAddress,
          ['event Transfer(address indexed from, address indexed to, uint256 value)', 'function balanceOf(address) view returns (uint256)'],
          this.provider
        );
        
        // Re-setup error listener
        this.provider.on('error', (err) => {
          console.error('⚠️ Provider error:', err.message);
        });
        
        setupListener();
        console.log('✅ Reconnected');
        
        // Refresh all balances after reconnect to catch any missed events
        console.log('🔄 Refreshing all balances after reconnect...');
        this.refreshAllBalancesAfterReconnect();
      }
    }, 30000); // Check every 30 seconds
    
    console.log('✅ Event listener active with auto-reconnect');
  }

  /**
   * Queue a Transfer for processing. Handling has to be serialised: each event
   * triggers balanceOf lookups, and if two run concurrently a slow reply for
   * an earlier transfer can overwrite the balance written by a later one.
   */
  private enqueueTransfer(from: string, to: string, value: bigint): Promise<void> {
    this.eventQueue = this.eventQueue
      .then(() => this.handleTransfer(from, to, value))
      .catch(err => console.error('⚠️ Transfer handler failed:', err?.message));

    return this.eventQueue;
  }

  private async handleTransfer(from: string, to: string, value: bigint): Promise<void> {
    const fromAddr = from.toLowerCase();
    const toAddr = to.toLowerCase();

    if (!this.isExcluded(fromAddr) && !this.isExcluded(toAddr)) {
      console.log(`📨 Transfer: ${fromAddr.slice(0, 8)}... → ${toAddr.slice(0, 8)}... (${ethers.formatUnits(value, 18)})`);
    }

    // Update sender - check their new balance
    if (!this.isExcluded(fromAddr)) {
      try {
        const balance = await this.tokenContract!.balanceOf(from);
        this.updateHolder(from, balance);
      } catch (err: any) {
        console.error(`⚠️ Failed to get balance for sender ${fromAddr.slice(0,10)}...:`, err.message?.slice(0, 50));
      }
    }

    // Update receiver. A holder that already had a balance keeps their
    // original firstSeen; someone buying in fresh starts the clock now.
    if (!this.isExcluded(toAddr)) {
      try {
        const balance = await this.tokenContract!.balanceOf(to);
        const existing = this.holders.get(toAddr);

        const useExistingTime = existing && existing.balance > 0n;
        this.updateHolder(to, balance, useExistingTime ? existing.firstSeen : undefined);
      } catch (err: any) {
        console.error(`⚠️ Failed to get balance for receiver ${toAddr.slice(0,10)}...:`, err.message?.slice(0, 50));
      }
    }
  }

  /**
   * Start periodic balance refresh
   */
  private startPeriodicRefresh(): void {
    console.log(`🔄 Balance refresh every ${this.REFRESH_INTERVAL_MS / 1000}s`);
    
    let isRefreshing = false;
    
    this.refreshInterval = setInterval(async () => {
      if (!this.tokenContract || this.holders.size === 0 || isRefreshing) return;
      
      isRefreshing = true;
      
      let updated = 0;
      let removed = 0;
      let errors = 0;
      const holders = Array.from(this.holders.entries());
      
      for (const [address, data] of holders) {
        try {
          const balance = await this.tokenContract.balanceOf(address);
          
          if (balance !== data.balance) {
            if (balance === 0n) {
              this.holders.delete(address);
              this.numberToHolders.get(data.number)?.delete(address);
              removed++;
              console.log(`📤 Removed: ${address.slice(0, 10)}... (sold all)`);
            } else {
              const diff = balance - data.balance;
              data.balance = balance;
              data.lastUpdated = Math.floor(Date.now() / 1000);
              updated++;
              
              if (diff > 0n) {
                console.log(`📈 ${address.slice(0, 10)}... +${ethers.formatUnits(diff, 18)}`);
              } else {
                console.log(`📉 ${address.slice(0, 10)}... ${ethers.formatUnits(diff, 18)}`);
              }
            }
          }
        } catch (error: any) {
          errors++;
        }
        
        await this.delay(20);
      }
      
      if (updated > 0 || removed > 0 || errors > 0) {
        console.log(`🔄 Refresh complete: +${updated} -${removed} errors:${errors} = ${this.holders.size} holders`);
      }
      
      isRefreshing = false;
      
    }, this.REFRESH_INTERVAL_MS);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Refresh all balances after RPC reconnect
   * This ensures we don't miss any transfers during disconnect
   */
  private async refreshAllBalancesAfterReconnect(): Promise<void> {
    if (!this.tokenContract || this.holders.size === 0) return;
    
    let updated = 0;
    let removed = 0;
    
    const holders = Array.from(this.holders.entries());
    
    for (const [address, data] of holders) {
      try {
        const balance = await this.tokenContract.balanceOf(address);
        
        if (balance === 0n) {
          this.holders.delete(address);
          this.numberToHolders.get(data.number)?.delete(address);
          removed++;
        } else if (balance !== data.balance) {
          data.balance = balance;
          data.lastUpdated = Math.floor(Date.now() / 1000);
          updated++;
        }
      } catch {
        // Ignore errors, will be caught in next refresh
      }
      
      await this.delay(20);
    }
    
    console.log(`🔄 Post-reconnect refresh: updated ${updated}, removed ${removed}`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    this.tokenContract?.removeAllListeners('Transfer');
    this.provider?.removeAllListeners();
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    this.isRunning = false;
    console.log('🛑 Holder tracker stopped');
  }

  /**
   * Force rescan all holders
   */
  async rescan(): Promise<void> {
    if (!this.tokenContract || this.isScanning) return;
    
    console.log('\n🔄 Force rescan initiated...');
    this.holders.clear();
    this.missedBlockRanges = [];
    for (let i = 1; i <= 50; i++) {
      this.numberToHolders.set(i, new Set());
    }
    await this.scanAllTransfers();
    console.log('✅ Rescan complete');
  }

  /**
   * Get all holders
   */
  getAllHolders(): Array<{address: string; balance: bigint; number: number; firstSeen: number}> {
    const result: Array<{address: string; balance: bigint; number: number; firstSeen: number}> = [];
    
    for (const [address, data] of this.holders) {
      result.push({
        address,
        balance: data.balance,
        number: data.number,
        firstSeen: data.firstSeen,
      });
    }
    
    return result;
  }

  // Constants
  private readonly TOP_HOLDERS_LIMIT = config.topHoldersLimit;

  /**
   * Get eligible holders: those past the holding requirement, capped to the
   * top TOP_HOLDERS_LIMIT by balance.
   */
  getEligibleHolders(): Array<{address: string; balance: bigint; number: number}> {
    const eligible: Array<{address: string; balance: bigint; number: number}> = [];
    
    // First, get all holders that meet the time requirement
    for (const [address, data] of this.holders) {
      if (this.isEligible(address)) {
        eligible.push({
          address,
          balance: data.balance,
          number: data.number,
        });
      }
    }
    
    // Sort by balance (highest first) and take top 200
    eligible.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
    
    return eligible.slice(0, this.TOP_HOLDERS_LIMIT);
  }

  /**
   * Count holders that satisfy the holding requirement, before the top-N cap.
   */
  countHoldersPastHoldingTime(): number {
    let count = 0;
    for (const address of this.holders.keys()) {
      if (this.isEligible(address)) count++;
    }
    return count;
  }

  /**
   * Get eligible holders by number (only from the top-N participants)
   */
  getEligibleHoldersByNumber(number: number): string[] {
    return this.getEligibleHolders()
      .filter(h => h.number === number)
      .map(h => h.address);
  }

  /**
   * Get number distribution
   */
  getNumberDistribution(): Map<number, number> {
    const distribution = new Map<number, number>();
    for (let i = 1; i <= 50; i++) {
      distribution.set(i, 0);
    }

    const eligible = this.getEligibleHolders();
    for (const holder of eligible) {
      distribution.set(holder.number, (distribution.get(holder.number) || 0) + 1);
    }

    return distribution;
  }

  /**
   * Take snapshot
   */
  takeSnapshot(): {
    timestamp: number;
    eligibleCount: number;
    holders: Array<{address: string; number: number}>;
    distribution: Map<number, number>;
    hash: string;
  } {
    const eligible = this.getEligibleHolders();
    const timestamp = Math.floor(Date.now() / 1000);
    
    const holders = eligible.map(h => ({
      address: h.address,
      number: h.number,
    }));
    
    const dataToHash = JSON.stringify({
      timestamp,
      holders: holders.sort((a, b) => a.address.localeCompare(b.address)),
    });
    const hash = ethers.keccak256(ethers.toUtf8Bytes(dataToHash));
    
    return {
      timestamp,
      eligibleCount: holders.length,
      holders,
      distribution: this.getNumberDistribution(),
      hash,
    };
  }

  /**
   * Add address to exclusion list
   */
  addExcludedAddress(address: string): void {
    const addr = address.toLowerCase();
    this.EXCLUDED_ADDRESSES.add(addr);
    
    // Remove from holders if exists
    const holder = this.holders.get(addr);
    if (holder) {
      this.holders.delete(addr);
      this.numberToHolders.get(holder.number)?.delete(addr);
      console.log(`🚫 Excluded and removed: ${addr}`);
    }
  }

  /**
   * Get stats
   */
  getStats(): {
    totalHolders: number;
    holdersWithTime: number; // Holders meeting the holding requirement
    eligibleHolders: number; // After the top-N cap
    topHoldersLimit: number;
    minHoldingDuration: number;
    isScanning: boolean;
    scanProgress: number;
    lastScannedBlock: number;
    excludedCount: number;
    scanComplete: boolean;
    missedBlockRanges: number;
  } {
    const eligible = this.getEligibleHolders();

    return {
      totalHolders: this.holders.size,
      holdersWithTime: this.countHoldersPastHoldingTime(),
      eligibleHolders: eligible.length,
      topHoldersLimit: this.TOP_HOLDERS_LIMIT,
      minHoldingDuration: this.minHoldingDuration,
      isScanning: this.isScanning,
      scanProgress: this.scanProgress,
      lastScannedBlock: this.lastScannedBlock,
      excludedCount: this.EXCLUDED_ADDRESSES.size,
      scanComplete: this.missedBlockRanges.length === 0,
      missedBlockRanges: this.missedBlockRanges.length,
    };
  }
}
