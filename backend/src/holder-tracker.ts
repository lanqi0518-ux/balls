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
    const currentBlock = await this.provider.getBlockNumber();
    
    console.log(`\n📡 Scanning Transfer events...`);
    console.log(`Current block: ${currentBlock}`);
    
    // Collect all unique addresses from events
    const allAddresses = new Set<string>();
    let totalEvents = 0;
    
    // Scan in chunks from recent to older
    const maxBlocksBack = 500000; // Scan up to 500k blocks back
    const startBlock = Math.max(0, currentBlock - maxBlocksBack);
    
    for (let toBlock = currentBlock; toBlock > startBlock; toBlock -= this.BLOCKS_PER_QUERY) {
      const fromBlock = Math.max(startBlock, toBlock - this.BLOCKS_PER_QUERY + 1);
      
      try {
        const filter = this.tokenContract.filters.Transfer();
        const events = await this.tokenContract.queryFilter(filter, fromBlock, toBlock);
        
        for (const event of events) {
          const log = event as ethers.EventLog;
          if (log.args) {
            const from = (log.args[0] as string).toLowerCase();
            const to = (log.args[1] as string).toLowerCase();
            
            // Only add non-excluded addresses
            if (!this.isExcluded(from)) allAddresses.add(from);
            if (!this.isExcluded(to)) allAddresses.add(to);
          }
        }
        
        totalEvents += events.length;
        this.lastScannedBlock = fromBlock;
        this.scanProgress = Math.floor(((currentBlock - fromBlock) / (currentBlock - startBlock)) * 100);
        
        // Stop if no events found in last 50k blocks
        if (events.length === 0 && (currentBlock - fromBlock) > 50000) {
          console.log(`  📍 No more events found, stopping scan at block ${fromBlock}`);
          break;
        }
        
        // Progress update
        if (this.scanProgress % 20 === 0 || events.length > 0) {
          console.log(`  📊 Block ${fromBlock} | Events: ${totalEvents} | Addresses: ${allAddresses.size}`);
        }
        
        await this.delay(50);
        
      } catch (error: any) {
        console.error(`  ⚠️ Error at block ${fromBlock}:`, error.message);
        await this.delay(200);
      }
    }
    
    this.isScanning = false;
    this.scanProgress = 100;
    
    console.log(`\n📊 Scan complete: ${totalEvents} events, ${allAddresses.size} addresses`);
    
    // Check balances for all addresses
    await this.checkBalances(allAddresses);
  }

  /**
   * Check balances for a set of addresses
   */
  private async checkBalances(addresses: Set<string>): Promise<void> {
    if (!this.tokenContract || addresses.size === 0) return;
    
    console.log(`\n💰 Checking balances for ${addresses.size} addresses...`);
    
    const now = Math.floor(Date.now() / 1000);
    let checked = 0;
    let withBalance = 0;
    
    const addressArray = Array.from(addresses);
    const batchSize = 20;
    
    for (let i = 0; i < addressArray.length; i += batchSize) {
      const batch = addressArray.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (addr) => {
          try {
            const balance = await this.tokenContract!.balanceOf(addr);
            return { address: addr, balance };
          } catch {
            return { address: addr, balance: 0n };
          }
        })
      );
      
      for (const { address, balance } of results) {
        if (balance > 0n) {
          this.updateHolder(address, balance, now - 120);
          withBalance++;
        }
        checked++;
      }
      
      if (checked % 50 === 0 || checked === addresses.size) {
        console.log(`  ✓ ${checked}/${addresses.size} checked | ${withBalance} with balance`);
      }
      
      await this.delay(30);
    }
    
    console.log(`\n✅ Found ${withBalance} active holders`);
  }

  /**
   * Start listening for new Transfer events
   */
  private startEventListener(): void {
    if (!this.tokenContract) return;
    
    console.log('\n👂 Listening for new transfers...');
    
    this.tokenContract.on('Transfer', async (from, to, value) => {
      // Skip excluded addresses
      const fromAddr = from.toLowerCase();
      const toAddr = to.toLowerCase();
      
      if (!this.isExcluded(fromAddr) && !this.isExcluded(toAddr)) {
        console.log(`📨 Transfer: ${fromAddr.slice(0, 8)}... → ${toAddr.slice(0, 8)}... (${ethers.formatUnits(value, 18)})`);
      }
      
      // Update sender balance
      if (!this.isExcluded(fromAddr)) {
        try {
          const balance = await this.tokenContract!.balanceOf(from);
          this.updateHolder(from, balance);
        } catch { /* ignore */ }
      }
      
      // Update receiver balance  
      if (!this.isExcluded(toAddr)) {
        try {
          const balance = await this.tokenContract!.balanceOf(to);
          const existing = this.holders.get(toAddr);
          this.updateHolder(to, balance, existing?.firstSeen);
        } catch { /* ignore */ }
      }
    });
    
    console.log('✅ Event listener active');
  }

  /**
   * Start periodic balance refresh
   */
  private startPeriodicRefresh(): void {
    console.log(`🔄 Balance refresh every ${this.REFRESH_INTERVAL_MS / 1000}s`);
    
    this.refreshInterval = setInterval(async () => {
      if (!this.tokenContract || this.holders.size === 0) return;
      
      let updated = 0;
      let removed = 0;
      const holders = Array.from(this.holders.entries());
      
      for (const [address, data] of holders) {
        try {
          const balance = await this.tokenContract.balanceOf(address);
          
          if (balance !== data.balance) {
            if (balance === 0n) {
              this.holders.delete(address);
              this.numberToHolders.get(data.number)?.delete(address);
              removed++;
            } else {
              data.balance = balance;
              data.lastUpdated = Math.floor(Date.now() / 1000);
              updated++;
            }
          }
        } catch { /* ignore */ }
        
        await this.delay(10);
      }
      
      if (updated > 0 || removed > 0) {
        console.log(`🔄 Refresh: +${updated} -${removed} = ${this.holders.size} holders`);
      }
      
    }, this.REFRESH_INTERVAL_MS);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  /**
   * Get eligible holders
   */
  getEligibleHolders(): Array<{address: string; balance: bigint; number: number}> {
    const result: Array<{address: string; balance: bigint; number: number}> = [];
    
    for (const [address, data] of this.holders) {
      if (this.isEligible(address)) {
        result.push({
          address,
          balance: data.balance,
          number: data.number,
        });
      }
    }
    
    return result;
  }

  /**
   * Get eligible holders by number
   */
  getEligibleHoldersByNumber(number: number): string[] {
    const holders = this.numberToHolders.get(number);
    if (!holders) return [];
    
    return Array.from(holders).filter(addr => this.isEligible(addr));
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
   * Get stats
   */
  getStats(): {
    totalHolders: number;
    eligibleHolders: number;
    minHoldingDuration: number;
    isScanning: boolean;
    scanProgress: number;
    lastScannedBlock: number;
    excludedCount: number;
  } {
    return {
      totalHolders: this.holders.size,
      eligibleHolders: this.getEligibleHolders().length,
      minHoldingDuration: this.minHoldingDuration,
      isScanning: this.isScanning,
      scanProgress: this.scanProgress,
      lastScannedBlock: this.lastScannedBlock,
      excludedCount: this.EXCLUDED_ADDRESSES.size,
    };
  }
}
