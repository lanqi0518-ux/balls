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
  private minHoldingDuration = 60;
  
  // Running state
  private isRunning = false;
  
  // Demo mode (no token address)
  private demoMode = false;
  
  // Scan state
  private isScanning = false;
  private scanProgress = 0;
  private lastScannedBlock = 0;
  
  // Refresh interval
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  
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
    
    // Check if token address is set
    if (!config.tokenAddress) {
      console.log('📋 Demo mode: No token address configured');
      this.demoMode = true;
      this.createDemoHolders();
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
   * Create demo holders for testing
   */
  private createDemoHolders() {
    const demoAddresses = [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
      '0x4567890123456789012345678901234567890123',
      '0x5678901234567890123456789012345678901234',
      '0x6789012345678901234567890123456789012345',
      '0x7890123456789012345678901234567890123456',
      '0x8901234567890123456789012345678901234567',
      '0x9012345678901234567890123456789012345678',
      '0x0123456789012345678901234567890123456789',
    ];
    
    const now = Math.floor(Date.now() / 1000);
    
    for (const addr of demoAddresses) {
      const number = this.getNumber(addr);
      const balance = BigInt(Math.floor(Math.random() * 10000) + 100) * 10n ** 18n;
      
      this.holders.set(addr.toLowerCase(), {
        balance,
        firstSeen: now - 120, // 2 minutes ago
        number,
        lastUpdated: now,
      });
      this.numberToHolders.get(number)?.add(addr.toLowerCase());
    }
    
    console.log(`✅ Created ${demoAddresses.length} demo holders`);
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
    
    if (this.demoMode) {
      console.log('✅ Holder tracker running in demo mode');
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
      console.log('⚠️ Falling back to demo mode');
      this.demoMode = true;
      this.createDemoHolders();
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
    
    // Scan in chunks from recent to older
    const maxBlocksBack = 500000;
    const startBlock = Math.max(0, currentBlock - maxBlocksBack);
    
    for (let toBlock = currentBlock; toBlock > startBlock; toBlock -= this.BLOCKS_PER_QUERY) {
      const fromBlock = Math.max(startBlock, toBlock - this.BLOCKS_PER_QUERY + 1);
      
      // Retry logic for each chunk
      let success = false;
      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          const filter = this.tokenContract.filters.Transfer();
          const events = await this.tokenContract.queryFilter(filter, fromBlock, toBlock);
          
          if (events.length > 0) {
            consecutiveEmptyChunks = 0;
            
            for (const event of events) {
              const log = event as ethers.EventLog;
              if (log.args) {
                const from = (log.args[0] as string).toLowerCase();
                const to = (log.args[1] as string).toLowerCase();
                
                if (!this.isExcluded(from)) allAddresses.add(from);
                if (!this.isExcluded(to)) allAddresses.add(to);
              }
            }
            
            totalEvents += events.length;
            console.log(`  📊 Block ${fromBlock}-${toBlock} | +${events.length} events | Total: ${allAddresses.size} addresses`);
          } else {
            consecutiveEmptyChunks++;
          }
          
          this.lastScannedBlock = fromBlock;
          this.scanProgress = Math.floor(((currentBlock - fromBlock) / (currentBlock - startBlock)) * 100);
          
          success = true;
          
          // Stop if 10 consecutive empty chunks (50k blocks)
          if (consecutiveEmptyChunks >= 10) {
            console.log(`  📍 No events in last ${consecutiveEmptyChunks * this.BLOCKS_PER_QUERY} blocks, stopping scan`);
            toBlock = startBlock; // Exit loop
          }
          
        } catch (error: any) {
          console.error(`  ⚠️ Attempt ${attempt} failed for blocks ${fromBlock}-${toBlock}:`, error.message);
          await this.delay(1000 * attempt);
        }
      }
      
      await this.delay(100);
    }
    
    this.isScanning = false;
    this.scanProgress = 100;
    
    console.log(`\n📊 Scan complete: ${totalEvents} events, ${allAddresses.size} addresses`);
    
    // Check balances for all addresses
    await this.checkBalances(allAddresses);
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
          this.updateHolder(address, balance, now - 120);
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
      this.tokenContract!.on('Transfer', async (from, to, value) => {
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
        
        // Update receiver - ALWAYS use current time for new purchases
        // This ensures the 60-second countdown starts fresh for each buy
        if (!this.isExcluded(toAddr)) {
          try {
            const balance = await this.tokenContract!.balanceOf(to);
            const existing = this.holders.get(toAddr);
            
            // If holder exists and already has balance, keep their firstSeen
            // If new holder or was removed (balance was 0), use current time
            const useExistingTime = existing && existing.balance > 0n;
            this.updateHolder(to, balance, useExistingTime ? existing.firstSeen : undefined);
          } catch (err: any) {
            console.error(`⚠️ Failed to get balance for receiver ${toAddr.slice(0,10)}...:`, err.message?.slice(0, 50));
          }
        }
      });
    };
    
    setupListener();
    
    // Monitor connection and reconnect if needed
    this.provider.on('error', (error) => {
      console.error('⚠️ Provider error:', error.message);
    });
    
    // Periodic connection check
    setInterval(async () => {
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
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.isRunning = false;
    console.log('🛑 Holder tracker stopped');
  }

  /**
   * Force rescan all holders
   */
  async rescan(): Promise<void> {
    if (this.demoMode || this.isScanning) return;
    
    console.log('\n🔄 Force rescan initiated...');
    this.holders.clear();
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
  private readonly TOP_HOLDERS_LIMIT = 200; // Only top 200 holders can participate

  /**
   * Get eligible holders (top 200 by balance)
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
   * Get eligible holders by number (only from top 200)
   */
  getEligibleHoldersByNumber(number: number): string[] {
    // Get top 200 eligible holders first
    const top200 = this.getEligibleHolders();
    const top200Set = new Set(top200.map(h => h.address));
    
    // Filter by number and ensure they're in top 200
    const holders = this.numberToHolders.get(number);
    if (!holders) return [];
    
    return Array.from(holders).filter(addr => top200Set.has(addr));
  }

  /**
   * Get number distribution
   */
  getNumberDistribution(): Map<number, number> {
    const distribution = new Map<number, number>();
    
    for (let i = 1; i <= 50; i++) {
      const eligibleCount = this.getEligibleHoldersByNumber(i).length;
      distribution.set(i, eligibleCount);
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
   * Reset all firstSeen timestamps to now
   * Called after each draw to start fresh eligibility countdown
   */
  resetAllFirstSeen(): void {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    
    for (const [address, data] of this.holders) {
      data.firstSeen = now;
      count++;
    }
    
    console.log(`🔄 Reset firstSeen for ${count} holders`);
  }

  /**
   * Get stats
   */
  getStats(): {
    totalHolders: number;
    holdersWithTime: number; // Holders meeting 60s requirement
    eligibleHolders: number; // Top 200 only
    topHoldersLimit: number;
    minHoldingDuration: number;
    isScanning: boolean;
    scanProgress: number;
    lastScannedBlock: number;
    excludedCount: number;
  } {
    // Count all holders meeting time requirement
    let holdersWithTime = 0;
    for (const [address] of this.holders) {
      if (this.isEligible(address)) {
        holdersWithTime++;
      }
    }
    
    return {
      totalHolders: this.holders.size,
      holdersWithTime, // All holders with 60s+ holding time
      eligibleHolders: this.getEligibleHolders().length, // Top 200 only
      topHoldersLimit: this.TOP_HOLDERS_LIMIT,
      minHoldingDuration: this.minHoldingDuration,
      isScanning: this.isScanning,
      scanProgress: this.scanProgress,
      lastScannedBlock: this.lastScannedBlock,
      excludedCount: this.EXCLUDED_ADDRESSES.size,
    };
  }
}
