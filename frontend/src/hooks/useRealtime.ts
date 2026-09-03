import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface LotteryStatus {
  isRunning: boolean;
  currentDrawId: number;
  lastDrawTime: number;
  timeUntilNextDraw: number;
  timeUntilSnapshot: number;
  hasSnapshot: boolean;
  // 实时奖池（从奖池钱包读取）
  prizePool: string;
  prizePoolWallet: string;
  snapshot: {
    drawId: number;
    eligibleCount: number;
    hash: string;
  } | null;
  stats: {
    totalHolders: number;
    eligibleHolders: number;
    minHoldingDuration: number;
  };
}

interface WinnerShare {
  address: string;
  balance: string;
  sharePercent: number;
  prize: string;
}

interface DrawResult {
  drawId: number;
  timestamp: number;
  winningNumber: number;
  prizePool: string;
  winnersCount: number;
  totalWinnerBalance?: string;
  winners?: WinnerShare[];
  snapshotHash: string;
}

interface UserInfo {
  address: string;
  isHolder: boolean;
  number: number;
  balance: string;
  holdingSince?: number;
  isEligible: boolean;
  pendingPrize: string;
  shareInNumber?: number;
  sameNumberHolders?: number;
}

/**
 * 实时状态 Hook
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<LotteryStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestDraw, setLatestDraw] = useState<DrawResult | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/events`);

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('SSE 连接已建立');
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.log('SSE 连接断开');
    };

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);
    });

    eventSource.addEventListener('draw', (event) => {
      const data = JSON.parse(event.data);
      setLatestDraw(data);
      console.log('新开奖:', data);
    });

    eventSource.addEventListener('snapshot', (event) => {
      const data = JSON.parse(event.data);
      console.log('新快照:', data);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return { status, isConnected, latestDraw };
}

/**
 * 获取最近开奖记录
 */
export function useRecentDraws(count: number = 10) {
  const [draws, setDraws] = useState<DrawResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/draws?count=${count}`);
      const data = await res.json();
      if (data.success) {
        setDraws(data.data);
      }
    } catch (error) {
      console.error('获取开奖记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [count]);

  useEffect(() => {
    refetch();
    // 每10秒刷新一次
    const interval = setInterval(refetch, 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { draws, isLoading, refetch };
}

/**
 * 查询用户信息
 */
export function useUserInfo(address: string | null) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address) {
      setUserInfo(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/${address}`);
      const data = await res.json();
      if (data.success) {
        setUserInfo(data.data);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { userInfo, isLoading, refetch };
}

/**
 * 查询号码
 */
export function useNumberLookup() {
  const [isLoading, setIsLoading] = useState(false);

  const lookupNumber = useCallback(async (address: string): Promise<number | null> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/number/${address}`);
      const data = await res.json();
      if (data.success) {
        return data.data.number;
      }
      return null;
    } catch (error) {
      console.error('查询号码失败:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookupNumber, isLoading };
}

/**
 * 获取号码分布
 */
export function useNumberDistribution() {
  const [distribution, setDistribution] = useState<Record<number, {count: number; totalBalance: string}>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/distribution`);
      const data = await res.json();
      if (data.success) {
        setDistribution(data.data);
      }
    } catch (error) {
      console.error('获取号码分布失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { distribution, isLoading, refetch };
}
