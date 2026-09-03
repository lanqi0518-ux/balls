import { ethers } from 'ethers';
import { config } from './config.js';

/**
 * Holder Tracker
 * Monitors Transfer events, automatically tracks all holding addresses
 */
export class HolderTracker {
  private provider: ethers.JsonRpcProvider | null = null;
  private tokenContract: ethers.Contract | null = null;
  
  // Holder data
  private holders: Map<string, {
    balance: bigint;
    firstSeen: number;
    number: number;
  }> = new Map();
  
  // Number to addresses mapping
  private numberToHolders: Map<number, Set<string>> = new Map();
  
  // Minimum holding duration (seconds)
  private minHoldingDuration = 60;
  
  // Running state
  private isRunning = false;
  
  // Demo mode (no token address)
  private demoMode = false;

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
    ];
    
    for (const addr of demoAddresses) {
      const number = this.getNumber(addr);
      const balance = BigInt(Math.floor(Math.random() * 10000)) * 10n ** 18n;
      
      this.holders.set(addr.toLowerCase(), {
        balance,
        firstSeen: Math.floor(Date.now() / 1000) - 120,
        number,
      });
      this.numberToHolders.get(number)?.add(addr.toLowerCase());
    }
    
    console.log(`Created ${demoAddresses.length} demo holders`);
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
  private updateHolder(address: string, balance: bigint) {
    const addr = address.toLowerCase();
    
    if (addr === '0x0000000000000000000000000000000000000000') return;
    
    const existing = this.holders.get(addr);
    const number = this.getNumber(addr);
    
    if (balance > 0n) {
      if (!existing) {
        this.holders.set(addr, {
          balance,
          firstSeen: Math.floor(Date.now() / 1000),
          number,
        });
        this.numberToHolders.get(number)?.add(addr);
        console.log(`New holder: ${addr.slice(0, 10)}... Number: ${number}`);
      } else {
        existing.balance = balance;
      }
    } else {
      if (existing) {
        this.holders.delete(addr);
        this.numberToHolders.get(existing.number)?.delete(addr);
        console.log(`Removed holder: ${addr.slice(0, 10)}...`);
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
      console.log('Holder tracker running in demo mode');
      return;
    }
    
    console.log('Starting holder tracker...');
    console.log(`Token: ${config.tokenAddress}`);
    
    try {
      // Load historical data
      await this.loadHistoricalHolders();
      
      // Listen for new Transfer events
      this.tokenContract?.on('Transfer', async (from, to, value) => {
        console.log(`Transfer: ${from.slice(0, 10)}... → ${to.slice(0, 10)}... (${ethers.formatUnits(value, 18)})`);
        
        if (from !== '0x0000000000000000000000000000000000000000') {
          const fromBalance = await this.tokenContract!.balanceOf(from);
          this.updateHolder(from, fromBalance);
        }
        
        if (to !== '0x0000000000000000000000000000000000000000') {
          const toBalance = await this.tokenContract!.balanceOf(to);
          this.updateHolder(to, toBalance);
        }
      });
      
      console.log('Transfer event listener started');
    } catch (error) {
      console.error('Failed to start holder tracker:', error);
      console.log('Falling back to demo mode');
      this.demoMode = true;
      this.createDemoHolders();
    }
  }

  /**
   * Load historical holders from chain events
   */
  private async loadHistoricalHolders() {
    if (!this.tokenContract || !this.provider) return;
    
    console.log('Loading historical holders...');
    
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      
      const filter = this.tokenContract.filters.Transfer();
      const events = await this.tokenContract.queryFilter(filter, fromBlock, currentBlock);
      
      console.log(`Found ${events.length} Transfer events`);
      
      const addresses = new Set<string>();
      for (const event of events) {
        const log = event as ethers.EventLog;
        if (log.args) {
          addresses.add(log.args[0]);
          addresses.add(log.args[1]);
        }
      }
      
      console.log(`Checking balances for ${addresses.size} addresses...`);
      
      for (const addr of addresses) {
        if (addr === '0x0000000000000000000000000000000000000000') continue;
        
        try {
          const balance = await this.tokenContract.balanceOf(addr);
          if (balance > 0n) {
            this.updateHolder(addr, balance);
          }
        } catch (e) {
          // Ignore
        }
      }
      
      console.log(`Load complete, current holders: ${this.holders.size}`);
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    this.tokenContract?.removeAllListeners('Transfer');
    this.isRunning = false;
    console.log('Holder tracker stopped');
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
   * Get stats
   */
  getStats(): {
    totalHolders: number;
    eligibleHolders: number;
    minHoldingDuration: number;
  } {
    return {
      totalHolders: this.holders.size,
      eligibleHolders: this.getEligibleHolders().length,
      minHoldingDuration: this.minHoldingDuration,
    };
  }
}
