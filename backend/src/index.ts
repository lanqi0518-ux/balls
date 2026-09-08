import express from 'express';
import cors from 'cors';
import { isAddress } from 'ethers';
import path from 'node:path';
import fs from 'node:fs';
import { config, validateConfig } from './config.js';
import { requireAdmin } from './auth.js';
import { HolderTracker } from './holder-tracker.js';
import { AutoLottery } from './auto-lottery.js';

// Path to the built frontend bundle. In the shipped Docker image the frontend
// is compiled and copied to <cwd>/public. When developing locally against the
// frontend dev server this directory may not exist yet — that's fine, we skip
// mounting it and rely on Vite's dev server. Resolving off process.cwd() keeps
// this working under both CommonJS and ESM builds.
const FRONTEND_DIR = process.env.FRONTEND_DIR
  ? path.resolve(process.env.FRONTEND_DIR)
  : path.resolve(process.cwd(), 'public');

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
  autoLottery.onDraw = (result) => {
    broadcast('draw', result);
    broadcast('status', autoLottery.getStatus());
  };
  // Whenever the wallet balance polling detects a change (new tax landed,
  // draw drained the pool, operator top-up), push a fresh status frame so
  // subscribed browsers update in near-real time.
  autoLottery.onStatusChange = () => {
    broadcast('status', autoLottery.getStatus());
  };
  autoLottery.onSnapshot = (snapshot) => {
    broadcast('snapshot', snapshot);
    broadcast('status', autoLottery.getStatus());
  };
  
  // Create Express app
  const app = express();

  // Canonical-host redirect: when CANONICAL_HOST is set (e.g. "example.com"),
  // 301 every request whose Host header differs from it to that host, so that
  // www.example.com, bare IP hits, or the .fly.dev backdoor all funnel users
  // to one URL. Fly's internal *.fly.dev hostname and local dev traffic stay
  // exempt so healthchecks and localhost testing keep working.
  const canonicalHost = (process.env.CANONICAL_HOST || '').toLowerCase().trim();
  if (canonicalHost) {
    console.log(`🌐 Canonical host: https://${canonicalHost} (other hosts will 301 here)`);
    app.use((req, res, next) => {
      // Never redirect the health probe — Fly hits it with the machine's
      // private IPv6 as Host, which doesn't match any known-good exemption.
      if (req.path === '/health') return next();

      const rawHost = (req.headers.host || '').toLowerCase();
      const host = rawHost.split(':')[0]; // drop :port
      const isIpLiteral =
        host.length === 0 ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) ||           // IPv4
        host.startsWith('[') ||                          // bracketed IPv6
        host.includes(':') ||                            // raw IPv6
        /^[0-9a-f]{4,}$/i.test(host.replace(/[.:]/g, '')); // hex-only

      if (
        isIpLiteral ||
        host === canonicalHost ||
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.endsWith('.fly.dev') ||
        host.endsWith('.internal')
      ) {
        return next();
      }
      return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
    });
  }

  app.use(cors(
    config.allowedOrigins.length > 0 ? { origin: config.allowedOrigins } : {}
  ));
  app.use(express.json());

  // Attach short-lived edge-cache hints to read-only GETs so a CDN sitting in
  // front of us can absorb bursty traffic. SSE and mutating routes are left
  // alone so they always hit the origin.
  const CACHEABLE_GETS = new Set([
    '/api/status',
    '/api/draws',
    '/api/distribution',
    '/api/holders',
    '/api/tracker/stats',
  ]);
  app.use((req, res, next) => {
    if (req.method === 'GET' && CACHEABLE_GETS.has(req.path)) {
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5');
    }
    next();
  });

  // API landing page — kept behind /api so the SPA can own the root path.
  app.get('/api', (_req, res) => {
    res.json({
      name: 'Balls Lottery API',
      status: 'running',
      clients: sseClients.size,
      endpoints: ['/health', '/api/status', '/api/draws', '/api/events'],
    });
  });

  // Health check
  app.get('/health', (_req, res) => {
    const status = autoLottery.getStatus();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      mode: config.tokenAddress ? 'live' : 'waiting',
      autoTransfer: status.autoTransferEnabled,
      holders: status.stats.totalHolders,
      eligible: status.stats.eligibleHolders,
      draws: status.totalDraws,
      hasEnoughForTransfers: status.hasEnoughForTransfers,
      // False when some block ranges could not be read, meaning the holder
      // list is missing anyone who only traded in those blocks
      scanComplete: status.stats.scanComplete,
    });
  });
  
  // Deep health check (includes RPC test)
  app.get('/health/deep', async (_req, res) => {
    const status = autoLottery.getStatus();
    const checks: Record<string, boolean | string> = {
      api: true,
      mode: config.tokenAddress ? 'live' : 'waiting',
      autoTransfer: status.autoTransferEnabled,
      hasEnoughForTransfers: status.hasEnoughForTransfers,
      rpc: false,
      tokenContract: false,
    };
    
    // Test RPC connection
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      checks.rpc = true;
      checks.blockNumber = blockNumber.toString();
      
      const taxEth = await provider.getBalance(config.taxReceiverWallet);
      checks.taxReceiverEth = ethers.formatEther(taxEth);
      
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
      } else {
        checks.tokenContract = 'waiting for TOKEN_ADDRESS';
      }
    } catch (error: any) {
      checks.rpcError = error.message?.slice(0, 100);
    }
    
    const allPassed = checks.rpc === true;
    
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

    if (!isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

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

    // getNumber() hashes the address and throws on malformed input
    if (!isAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

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
  app.post('/api/tracker/rescan', requireAdmin, async (_req, res) => {
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
  app.get('/api/admin/verify-config', requireAdmin, async (_req, res) => {
    const status = autoLottery.getStatus();
    
    const verification = {
      timestamp: new Date().toISOString(),
      mode: config.tokenAddress ? 'LIVE' : 'WAITING',
      config: {
        tokenAddress: config.tokenAddress || '(not set)',
        prizePoolWallet: config.taxReceiverWallet,
        publisherWallet: config.publisherWallet || '(not set — 1% forward skipped)',
        teamWallet: config.devWallet,
        excludedAddresses: config.excludedAddresses,
        hasPrizeWalletKey: !!config.taxReceiverPrivateKey,
        hasPublisherKey: !!config.publisherPrivateKey,
      },
      status: {
        autoTransferEnabled: status.autoTransferEnabled,
        ethBalance: status.ethBalance,
        ethBalanceUsd: status.ethBalanceUsd,
        prizePool: status.prizePool,
        prizePoolUsd: status.prizePoolUsd,
        hasEnoughForTransfers: status.hasEnoughForTransfers,
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
        canExecuteTransfers: status.autoTransferEnabled && status.hasEnoughForTransfers,
        hasFunds: parseFloat(status.ethBalance) > 0,
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
  app.post('/api/tracker/exclude', requireAdmin, (req, res) => {
    const { address } = req.body;
    
    if (!address || typeof address !== 'string' || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'A valid address is required',
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
  
  // Broadcast status every 10 seconds (draw/snapshot push immediately)
  const statusBroadcast = setInterval(() => {
    if (sseClients.size > 0) {
      broadcast('status', autoLottery.getStatus());
    }
  }, 10000);

  // Comment-only heartbeat. Proxies such as nginx and Cloudflare drop idle
  // connections, and a draw can be a full interval away with nothing sent.
  const heartbeat = setInterval(() => {
    sseClients.forEach(client => {
      try {
        client.write(': ping\n\n');
      } catch {
        sseClients.delete(client);
      }
    });
  }, 15000);

  // Serve the built frontend from the same process, so a single container
  // ships both. Registered LAST so every /api/* and /health route above wins.
  //   - hashed asset filenames get a year of immutable caching
  //   - index.html is served fresh so a new deploy is picked up on next load
  //   - anything else that isn't a file (SPA routes) falls back to index.html
  if (fs.existsSync(FRONTEND_DIR)) {
    console.log(`📦 Serving frontend from ${FRONTEND_DIR}`);

    app.use(
      express.static(FRONTEND_DIR, {
        index: false,
        etag: true,
        maxAge: 0,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          }
        },
      }),
    );

    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.sendFile(indexPath);
    });
  } else {
    console.log(`ℹ️  No frontend build at ${FRONTEND_DIR} — API-only mode`);
  }

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
    clearInterval(statusBroadcast);
    clearInterval(heartbeat);
    autoLottery.stop();
    holderTracker.stop();
    sseClients.forEach(client => client.end());
    sseClients.clear();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
