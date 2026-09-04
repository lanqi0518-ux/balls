import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import { HolderTracker } from './holder-tracker.js';
import { AutoLottery } from './auto-lottery.js';

async function main() {
  console.log('🎱 Balls Lottery - Automated Backend');
  console.log('====================================');
  
  validateConfig();
  
  // Initialize services
  const holderTracker = new HolderTracker();
  const autoLottery = new AutoLottery(holderTracker);
  
  // SSE clients management
  const sseClients: Set<express.Response> = new Set();
  
  // Broadcast to all SSE clients
  const broadcast = (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (e) {
        sseClients.delete(client);
      }
    });
  };
  
  // Set up lottery event handlers
  autoLottery.onDraw = (result) => broadcast('draw', result);
  autoLottery.onSnapshot = (snapshot) => broadcast('snapshot', snapshot);
  
  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // ============ API Routes ============
  
  // Root
  app.get('/', (_req, res) => {
    res.json({ 
      name: 'Balls Lottery API',
      status: 'running',
      clients: sseClients.size,
      endpoints: ['/health', '/api/status', '/api/draws', '/api/events']
    });
  });

  // Health check
  app.get('/health', (_req, res) => {
    const status = autoLottery.getStatus();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      mode: status.demoMode ? 'demo' : 'live',
      autoTransfer: status.autoTransferEnabled,
      holders: status.stats.totalHolders,
      eligible: status.stats.eligibleHolders,
      draws: status.totalDraws,
      hasEnoughGas: status.hasEnoughGas,
    });
  });
  
  // Deep health check (includes RPC test)
  app.get('/health/deep', async (_req, res) => {
    const status = autoLottery.getStatus();
    const checks: Record<string, boolean | string> = {
      api: true,
      mode: status.demoMode ? 'demo' : 'live',
      autoTransfer: status.autoTransferEnabled,
      hasEnoughGas: status.hasEnoughGas,
      rpc: false,
      tokenContract: false,
    };
    
    // Test RPC connection
    if (!status.demoMode) {
      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const blockNumber = await provider.getBlockNumber();
        checks.rpc = true;
        checks.blockNumber = blockNumber.toString();
        
        // Test token contract
        if (config.tokenAddress) {
          const contract = new ethers.Contract(
            config.tokenAddress,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          );
          const balance = await contract.balanceOf(config.taxReceiverWallet);
          checks.tokenContract = true;
          checks.taxReceiverBalance = ethers.formatUnits(balance, 18);
        }
      } catch (error: any) {
        checks.rpcError = error.message?.slice(0, 100);
      }
    } else {
      checks.rpc = 'skipped (demo mode)';
      checks.tokenContract = 'skipped (demo mode)';
    }
    
    const allPassed = checks.rpc === true || checks.rpc === 'skipped (demo mode)';
    
    res.status(allPassed ? 200 : 503).json({
      status: allPassed ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      stats: {
        holders: status.stats.totalHolders,
        eligible: status.stats.eligibleHolders,
        totalDraws: status.totalDraws,
        failedTransfers: status.failedTransfers,
      },
    });
  });
  
  // Get lottery status
  app.get('/api/status', (_req, res) => {
    res.json({
      success: true,
      data: autoLottery.getStatus(),
    });
  });
  
  // Get recent draws
  app.get('/api/draws', (req, res) => {
    const count = Math.min(parseInt(req.query.count as string) || 10, 50);
    res.json({
      success: true,
      data: autoLottery.getRecentDraws(count),
    });
  });
  
  // Get user info
  app.get('/api/user/:address', (req, res) => {
    const { address } = req.params;
    res.json({
      success: true,
      data: autoLottery.getUserInfo(address),
    });
  });
  
  // Get number distribution
  app.get('/api/distribution', (_req, res) => {
    res.json({
      success: true,
      data: autoLottery.getNumberDistribution(),
    });
  });
  
  // Get all holders
  app.get('/api/holders', (_req, res) => {
    const holders = holderTracker.getEligibleHolders();
    res.json({
      success: true,
      data: {
        count: holders.length,
        holders: holders.map(h => ({
          address: h.address,
          number: h.number,
        })),
      },
    });
  });
  
  // Lookup number by address
  app.get('/api/number/:address', (req, res) => {
    const { address } = req.params;
    const number = holderTracker.getNumber(address);
    res.json({
      success: true,
      data: { address, number },
    });
  });
  
  // Get holder tracker stats
  app.get('/api/tracker/stats', (_req, res) => {
    res.json({
      success: true,
      data: holderTracker.getStats(),
    });
  });
  
  // Force rescan all holders
  app.post('/api/tracker/rescan', async (_req, res) => {
    try {
      console.log('📡 Manual rescan requested via API');
      await holderTracker.rescan();
      res.json({
        success: true,
        message: 'Rescan complete',
        data: holderTracker.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
  
  // Verify transfer configuration (admin only)
  app.get('/api/admin/verify-config', async (_req, res) => {
    const status = autoLottery.getStatus();
    
    const verification = {
      timestamp: new Date().toISOString(),
      mode: status.demoMode ? 'DEMO' : 'LIVE',
      config: {
        tokenAddress: config.tokenAddress || '(not set)',
        taxReceiverWallet: config.taxReceiverWallet,
        devWallet: config.devWallet,
        devSharePercent: config.devSharePercent,
        excludedAddresses: config.excludedAddresses,
        hasPrivateKey: !!config.taxReceiverPrivateKey,
      },
      status: {
        autoTransferEnabled: status.autoTransferEnabled,
        totalTaxBalance: status.totalTaxBalance,
        prizePool: status.prizePool,
        nativeBalance: status.nativeBalance,
        hasEnoughGas: status.hasEnoughGas,
        totalDraws: status.totalDraws,
        failedTransfers: status.failedTransfers,
        totalDevPaid: status.totalDevPaid,
        totalPrizePaid: status.totalPrizePaid,
      },
      holders: {
        total: status.stats.totalHolders,
        eligible: status.stats.eligibleHolders,
        excluded: status.stats.excludedCount,
      },
      checks: {
        canExecuteTransfers: status.autoTransferEnabled && status.hasEnoughGas,
        hasFunds: parseFloat(status.totalTaxBalance) > 0,
        hasHolders: status.stats.eligibleHolders > 0,
      },
    };
    
    // Overall readiness
    const isReady = verification.checks.canExecuteTransfers && 
                    verification.checks.hasFunds && 
                    verification.checks.hasHolders;
    
    res.json({
      success: true,
      ready: isReady,
      readyMessage: isReady 
        ? '✅ System is ready to process draws and transfers'
        : '⚠️ System is not fully ready - check the verification details',
      data: verification,
    });
  });

  // Add address to exclusion list
  app.post('/api/tracker/exclude', (req, res) => {
    const { address } = req.body;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Address is required',
      });
    }
    
    try {
      holderTracker.addExcludedAddress(address);
      console.log(`🚫 Address excluded via API: ${address}`);
      res.json({
        success: true,
        message: `Address ${address} has been excluded`,
        data: holderTracker.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
  
  // SSE real-time events
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Add to clients
    sseClients.add(res);
    console.log(`SSE client connected. Total: ${sseClients.size}`);
    
    // Send initial status
    const status = autoLottery.getStatus();
    res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
    
    // Cleanup on disconnect
    req.on('close', () => {
      sseClients.delete(res);
      console.log(`SSE client disconnected. Total: ${sseClients.size}`);
    });
  });
  
  // Broadcast status every 3 seconds
  setInterval(() => {
    if (sseClients.size > 0) {
      broadcast('status', autoLottery.getStatus());
    }
  }, 3000);
  
  // Start server
  const port = config.port || 10000;
  app.listen(port, () => {
    console.log(`\n🚀 API running at http://localhost:${port}`);
    console.log('\nEndpoints:');
    console.log('  GET  /api/status          - Lottery status');
    console.log('  GET  /api/draws           - Recent draws');
    console.log('  GET  /api/events          - SSE real-time');
  });
  
  // Start holder tracker
  await holderTracker.start();
  
  // Start auto lottery
  autoLottery.start();
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    autoLottery.stop();
    holderTracker.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
