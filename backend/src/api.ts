import express, { Request, Response, Router } from 'express';
import { LotteryService } from './lottery-service.js';
import { AutoDrawer } from './auto-drawer.js';

export function createApiRouter(
  lotteryService: LotteryService, 
  autoDrawer: AutoDrawer
): Router {
  const router = express.Router();

  // ============ 代币信息 ============

  /**
   * GET /api/token/info
   * 获取代币基本信息
   */
  router.get('/token/info', async (_req: Request, res: Response) => {
    try {
      const info = await lotteryService.getTokenInfo();
      res.json({
        success: true,
        data: {
          name: info.name,
          symbol: info.symbol,
          decimals: Number(info.decimals),
          totalSupply: info.totalSupply.toString(),
          totalSupplyFormatted: lotteryService.formatTokenAmount(info.totalSupply),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/token/balance/:address
   * 获取地址余额
   */
  router.get('/token/balance/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const balance = await lotteryService.getBalance(address);
      res.json({
        success: true,
        data: {
          address,
          balance: balance.toString(),
          balanceFormatted: lotteryService.formatTokenAmount(balance),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/token/holders/count
   * 获取持币者数量
   */
  router.get('/token/holders/count', async (_req: Request, res: Response) => {
    try {
      const count = await lotteryService.getHoldersCount();
      res.json({
        success: true,
        data: { count: count.toString() }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ 号码相关 ============

  /**
   * GET /api/number/:address
   * 获取地址对应的号码
   */
  router.get('/number/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const number = await lotteryService.getUserNumber(address);
      res.json({
        success: true,
        data: { address, number }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/number/:number/holders
   * 获取某号码的所有持币者
   */
  router.get('/number/:number/holders', async (req: Request, res: Response) => {
    try {
      const number = parseInt(req.params.number);
      if (number < 1 || number > 50) {
        return res.status(400).json({ success: false, error: '号码必须在1-50之间' });
      }
      const holders = await lotteryService.getHoldersByNumber(number);
      res.json({
        success: true,
        data: { number, holders, count: holders.length }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ 抽奖信息 ============

  /**
   * GET /api/lottery/stats
   * 获取抽奖统计
   */
  router.get('/lottery/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await lotteryService.getStats();
      const timeUntil = await lotteryService.getTimeUntilNextDraw();
      const canDraw = await lotteryService.canDraw();
      
      res.json({
        success: true,
        data: {
          totalDraws: stats.totalDraws.toString(),
          totalDistributed: stats.totalDistributed.toString(),
          totalDistributedFormatted: lotteryService.formatTokenAmount(stats.totalDistributed),
          currentPrizePool: stats.currentPrizePool.toString(),
          currentPrizePoolFormatted: lotteryService.formatTokenAmount(stats.currentPrizePool),
          holdersCount: stats.holdersCount.toString(),
          timeUntilNextDraw: timeUntil.toString(),
          canDraw,
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/lottery/prize-pool
   * 获取当前奖池
   */
  router.get('/lottery/prize-pool', async (_req: Request, res: Response) => {
    try {
      const prizePool = await lotteryService.getCurrentPrizePool();
      res.json({
        success: true,
        data: {
          prizePool: prizePool.toString(),
          prizePoolFormatted: lotteryService.formatTokenAmount(prizePool),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/lottery/draws/recent
   * 获取最近的开奖记录
   */
  router.get('/lottery/draws/recent', async (req: Request, res: Response) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 10, 50);
      const draws = await lotteryService.getRecentDraws(count);
      
      res.json({
        success: true,
        data: draws.map(d => ({
          drawId: d.drawId.toString(),
          timestamp: d.timestamp.toString(),
          winningNumber: d.winningNumber,
          prizePool: d.prizePool.toString(),
          prizePoolFormatted: lotteryService.formatTokenAmount(d.prizePool),
          winnersCount: d.winnersCount.toString(),
          prizePerWinner: d.prizePerWinner.toString(),
          prizePerWinnerFormatted: lotteryService.formatTokenAmount(d.prizePerWinner),
          distributed: d.distributed,
        }))
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/lottery/draws/:id
   * 获取指定期数的开奖详情
   */
  router.get('/lottery/draws/:id', async (req: Request, res: Response) => {
    try {
      const drawId = parseInt(req.params.id);
      const draw = await lotteryService.getDrawInfo(drawId);
      const winners = await lotteryService.getDrawWinners(drawId);
      
      res.json({
        success: true,
        data: {
          drawId: draw.drawId.toString(),
          timestamp: draw.timestamp.toString(),
          winningNumber: draw.winningNumber,
          prizePool: draw.prizePool.toString(),
          prizePoolFormatted: lotteryService.formatTokenAmount(draw.prizePool),
          winnersCount: draw.winnersCount.toString(),
          prizePerWinner: draw.prizePerWinner.toString(),
          prizePerWinnerFormatted: lotteryService.formatTokenAmount(draw.prizePerWinner),
          distributed: draw.distributed,
          winners: winners.map(w => ({
            address: w.winner,
            prize: w.prize.toString(),
            prizeFormatted: lotteryService.formatTokenAmount(w.prize),
            claimed: w.claimed,
          })),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ 用户相关 ============

  /**
   * GET /api/user/:address
   * 获取用户信息
   */
  router.get('/user/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      const [balance, number, pendingPrize] = await Promise.all([
        lotteryService.getBalance(address),
        lotteryService.getUserNumber(address),
        lotteryService.getPendingPrize(address),
      ]);
      
      res.json({
        success: true,
        data: {
          address,
          balance: balance.toString(),
          balanceFormatted: lotteryService.formatTokenAmount(balance),
          number,
          pendingPrize: pendingPrize.toString(),
          pendingPrizeFormatted: lotteryService.formatTokenAmount(pendingPrize),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ 自动开奖服务状态 ============

  /**
   * GET /api/service/status
   * 获取自动开奖服务状态
   */
  router.get('/service/status', (_req: Request, res: Response) => {
    const status = autoDrawer.getStatus();
    res.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        lastDrawAttempt: status.lastDrawAttempt?.toISOString() || null,
        consecutiveFailures: status.consecutiveFailures,
        walletAddress: status.walletAddress,
      }
    });
  });

  /**
   * POST /api/service/start
   * 启动自动开奖（需要认证）
   */
  router.post('/service/start', (req: Request, res: Response) => {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    autoDrawer.start();
    res.json({ success: true, message: '自动开奖服务已启动' });
  });

  /**
   * POST /api/service/stop
   * 停止自动开奖（需要认证）
   */
  router.post('/service/stop', (req: Request, res: Response) => {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    autoDrawer.stop();
    res.json({ success: true, message: '自动开奖服务已停止' });
  });

  /**
   * POST /api/service/draw
   * 手动触发开奖（需要认证）
   */
  router.post('/service/draw', async (req: Request, res: Response) => {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    const result = await autoDrawer.manualDraw();
    res.json({
      success: result.success,
      data: result.success ? { drawId: result.drawId?.toString() } : undefined,
      error: result.error,
    });
  });

  return router;
}
