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
      endpoints: ['/health', '/api/status', '/api/draws', '/api/events']
    });
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  
  // SSE real-time events
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send current status
    const sendStatus = () => {
      const status = autoLottery.getStatus();
      res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
    };
    
    // Send status every second
    const interval = setInterval(sendStatus, 1000);
    
    // Draw event
    const onDraw = (result: any) => {
      res.write(`event: draw\ndata: ${JSON.stringify(result)}\n\n`);
    };
    
    // Snapshot event
    const onSnapshot = (snapshot: any) => {
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    };
    
    autoLottery.onDraw = onDraw;
    autoLottery.onSnapshot = onSnapshot;
    
    // Cleanup
    req.on('close', () => {
      clearInterval(interval);
      autoLottery.onDraw = null;
      autoLottery.onSnapshot = null;
    });
  });
  
  // Start server
  app.listen(config.port, () => {
    console.log(`\n🚀 API running at http://localhost:${config.port}`);
    console.log('\nEndpoints:');
    console.log('  GET  /health              - Health check');
    console.log('  GET  /api/status          - Lottery status');
    console.log('  GET  /api/draws           - Recent draws');
    console.log('  GET  /api/user/:address   - User info');
    console.log('  GET  /api/distribution    - Number distribution');
    console.log('  GET  /api/holders         - All holders');
    console.log('  GET  /api/number/:address - Lookup number');
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
