import { ethers } from 'ethers';
import { config } from './config.js';

/**
 * Holder Tracker
 * Monitors Transfer events, automatically tracks all holding addresses
 */
export class HolderTracker {
  private provider: ethers.JsonRpcProvider;
  private tokenContract: ethers.Contract;
  
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

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Initialize number mapping
    for (let i = 1; i <= 50; i++) {
      this.numberToHolders.set(i, new Set());
    }
    
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
    
    // Ignore zero address and contract addresses
    if (addr === '0x0000000000000000000000000000000000000000') return;
    
    const existing = this.holders.get(addr);
    const number = this.getNumber(addr);
    
    if (balance > 0n) {
      // Add or update
      if (!existing) {
        // New holder
        this.holders.set(addr, {
          balance,
          firstSeen: Math.floor(Date.now() / 1000),
          number,
        });
        this.numberToHolders.get(number)?.add(addr);
        console.log(`New holder: ${addr.slice(0, 10)}... Number: ${number}`);
      } else {
        // Update balance
        existing.balance = balance;
      }
    } else {
      // Remove
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
    
    console.log('Starting holder tracker...');
    console.log(`Token: ${config.tokenAddress}`);
    
    // Load historical data
    await this.loadHistoricalHolders();
    
    // Listen for new Transfer events
    this.tokenContract.on('Transfer', async (from, to, value) => {
      console.log(`Transfer: ${from.slice(0, 10)}... → ${to.slice(0, 10)}... (${ethers.formatUnits(value, 18)})`);
      
      // Update sender
      if (from !== '0x0000000000000000000000000000000000000000') {
        const fromBalance = await this.tokenContract.balanceOf(from);
        this.updateHolder(from, fromBalance);
      }
      
      // Update receiver
      if (to !== '0x0000000000000000000000000000000000000000') {
        const toBalance = await this.tokenContract.balanceOf(to);
        this.updateHolder(to, toBalance);
      }
    });
    
    console.log('Transfer event listener started');
  }

  /**
   * Load historical holders from chain events
   */
  private async loadHistoricalHolders() {
    console.log('Loading historical holders...');
    
    try {
      // Get recent blocks
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      
      // Query Transfer events
      const filter = this.tokenContract.filters.Transfer();
      const events = await this.tokenContract.queryFilter(filter, fromBlock, currentBlock);
      
      console.log(`Found ${events.length} Transfer events`);
      
      // Collect all involved addresses
      const addresses = new Set<string>();
      for (const event of events) {
        const log = event as ethers.EventLog;
        if (log.args) {
          addresses.add(log.args[0]); // from
          addresses.add(log.args[1]); // to
        }
      }
      
      // Query balance for each address
      console.log(`Checking balances for ${addresses.size} addresses...`);
      
      for (const addr of addresses) {
        if (addr === '0x0000000000000000000000000000000000000000') continue;
        
        try {
          const balance = await this.tokenContract.balanceOf(addr);
          if (balance > 0n) {
            this.updateHolder(addr, balance);
          }
        } catch (e) {
          // Ignore errors
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
    
    this.tokenContract.removeAllListeners('Transfer');
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
    
    // Calculate hash
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
