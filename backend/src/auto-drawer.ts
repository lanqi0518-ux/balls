import cron from 'node-cron';
import { LotteryService } from './lottery-service.js';
import { config } from './config.js';

/**
 * 自动开奖服务
 * 定时检查并执行开奖
 */
export class AutoDrawer {
  private lotteryService: LotteryService;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private lastDrawAttempt: Date | null = null;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;

  constructor(lotteryService: LotteryService) {
    this.lotteryService = lotteryService;
  }

  /**
   * 启动自动开奖
   */
  start(): void {
    if (this.isRunning) {
      console.log('自动开奖服务已在运行中');
      return;
    }

    const walletAddress = this.lotteryService.getWalletAddress();
    if (!walletAddress) {
      console.error('无法启动自动开奖：钱包未配置');
      return;
    }

    console.log(`启动自动开奖服务，钱包地址: ${walletAddress}`);
    console.log(`开奖间隔: ${config.drawInterval / 1000} 秒`);

    // 每30秒检查一次是否可以开奖
    this.cronJob = cron.schedule('*/30 * * * * *', async () => {
      await this.checkAndDraw();
    });

    this.isRunning = true;
    console.log('自动开奖服务已启动');

    // 立即检查一次
    this.checkAndDraw();
  }

  /**
   * 停止自动开奖
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('自动开奖服务未运行');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    console.log('自动开奖服务已停止');
  }

  /**
   * 检查并执行开奖
   */
  private async checkAndDraw(): Promise<void> {
    try {
      // 检查是否可以开奖
      const canDraw = await this.lotteryService.canDraw();
      
      if (!canDraw) {
        const timeUntil = await this.lotteryService.getTimeUntilNextDraw();
        if (Number(timeUntil) > 0) {
          // 静默等待，不打印日志避免刷屏
          return;
        }
      }

      console.log('\n========== 开始开奖 ==========');
      console.log(`时间: ${new Date().toISOString()}`);
      
      this.lastDrawAttempt = new Date();

      // 获取开奖前的状态
      const prizePool = await this.lotteryService.getCurrentPrizePool();
      const stats = await this.lotteryService.getStats();
      
      console.log(`当前奖池: ${this.lotteryService.formatTokenAmount(prizePool)} 代币`);
      console.log(`持币者数量: ${stats.holdersCount}`);

      // 执行开奖
      const result = await this.lotteryService.executeDraw();

      if (result.success) {
        this.consecutiveFailures = 0;
        
        // 获取开奖结果
        const drawInfo = await this.lotteryService.getDrawInfo(Number(result.drawId));
        
        console.log('\n🎉 开奖成功！');
        console.log(`期数: #${result.drawId}`);
        console.log(`中奖号码: ${drawInfo.winningNumber}`);
        console.log(`中奖人数: ${drawInfo.winnersCount}`);
        console.log(`奖池金额: ${this.lotteryService.formatTokenAmount(drawInfo.prizePool)} 代币`);
        
        if (Number(drawInfo.winnersCount) > 0) {
          console.log(`每人奖金: ${this.lotteryService.formatTokenAmount(drawInfo.prizePerWinner)} 代币`);
          
          // 获取中奖者列表
          const winners = await this.lotteryService.getDrawWinners(Number(result.drawId));
          console.log('\n中奖者:');
          winners.forEach((w, i) => {
            console.log(`  ${i + 1}. ${w.winner}`);
          });
        } else {
          console.log('本期无人中奖，奖金滚入下期');
        }
        
        console.log(`\n交易哈希: ${result.txHash}`);
      } else {
        this.consecutiveFailures++;
        console.error(`❌ 开奖失败: ${result.error}`);
        
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          console.error(`连续失败 ${this.consecutiveFailures} 次，暂停自动开奖`);
          this.stop();
        }
      }

      console.log('==============================\n');
      
    } catch (error) {
      this.consecutiveFailures++;
      console.error('开奖检查出错:', error);
      
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        console.error(`连续失败 ${this.consecutiveFailures} 次，暂停自动开奖`);
        this.stop();
      }
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    isRunning: boolean;
    lastDrawAttempt: Date | null;
    consecutiveFailures: number;
    walletAddress: string | null;
  } {
    return {
      isRunning: this.isRunning,
      lastDrawAttempt: this.lastDrawAttempt,
      consecutiveFailures: this.consecutiveFailures,
      walletAddress: this.lotteryService.getWalletAddress(),
    };
  }

  /**
   * 手动触发一次开奖
   */
  async manualDraw(): Promise<{ success: boolean; drawId?: bigint; error?: string }> {
    console.log('手动触发开奖...');
    return this.lotteryService.executeDraw();
  }
}
