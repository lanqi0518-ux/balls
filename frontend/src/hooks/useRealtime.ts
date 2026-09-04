import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

interface LotteryStatus {
  isRunning: boolean;
  currentDrawId: number;
  timeUntilNextDraw: number;
  nextDrawTime: number;
  hasSnapshot: boolean;
  // ETH-based prize pool
  prizePool: string;
  prizePoolUsd: string;
  ethBalance: string;
  ethBalanceUsd: string;
  ethPriceUsd: number;
  prizeInEth?: boolean;
  // Wallets
  taxReceiverWallet: string;
  devWallet: string;
  // Status
  hasEnoughForTransfers?: boolean;
  autoTransferEnabled?: boolean;
  demoMode?: boolean;
  // Stats
  totalDraws?: number;
  failedTransfers?: number;
  snapshot: {
    drawId: number;
    eligibleCount: number;
    hash: string;
  } | null;
  stats: {
    totalHolders: number;
    eligibleHolders: number;
    holdersWithTime?: number;
    topHoldersLimit?: number;
    minHoldingDuration: number;
  };
}

interface WinnerShare {
  address: string;
  balance: string;
  sharePercent: number;
  prize: string;
  txHash?: string;
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
  isInTop200?: boolean;
  rank?: number;
  pendingPrize?: string;
  shareInNumber?: number;
  sameNumberHolders?: number;
}

/**
 * Real-time status hook
 */
function statusUnchanged(prev: LotteryStatus, next: LotteryStatus): boolean {
  return (
    prev.prizePool === next.prizePool &&
    prev.prizePoolUsd === next.prizePoolUsd &&
    prev.ethPriceUsd === next.ethPriceUsd &&
    prev.hasSnapshot === next.hasSnapshot &&
    prev.currentDrawId === next.currentDrawId &&
    prev.stats?.eligibleHolders === next.stats?.eligibleHolders &&
    prev.stats?.totalHolders === next.stats?.totalHolders
  );
}

export function useRealtimeStatus() {
  const [status, setStatus] = useState<LotteryStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestDraw, setLatestDraw] = useState<DrawResult | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        esRef.current?.close();
        const eventSource = new EventSource(`${API_URL}/events`);
        esRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          retryCount = 0;
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();
          if (closed) return;
          const delay = Math.min(2000 * Math.pow(2, retryCount), 15000);
          retryCount++;
          reconnectTimeout = setTimeout(connect, delay);
        };

        eventSource.addEventListener('status', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data) as LotteryStatus;
            setStatus((prev) => (prev && statusUnchanged(prev, data) ? prev : data));
          } catch {}
        });

        eventSource.addEventListener('draw', (event) => {
          try {
            setLatestDraw(JSON.parse((event as MessageEvent).data));
          } catch {}
        });
      } catch {
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      closed = true;
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return { status, isConnected, latestDraw };
}

/**
 * Get recent draws - with caching
 */
export function useRecentDraws(count: number = 10) {
  const [draws, setDraws] = useState<DrawResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/draws?count=${count}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDraws(data.data);
        }
      }
    } catch (error) {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [count]);

  useEffect(() => {
    refetch();
    // Refresh every 30 seconds instead of 10
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { draws, isLoading, refetch };
}

/**
 * Get user info
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
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserInfo(data.data);
        }
      }
    } catch (error) {
      // Silent fail
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
 * Lookup number
 */
export function useNumberLookup() {
  const [isLoading, setIsLoading] = useState(false);

  const lookupNumber = useCallback(async (address: string): Promise<number | null> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/number/${address}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return data.data.number;
        }
      }
      return null;
    } catch (error) {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookupNumber, isLoading };
}

/**
 * Get number distribution - with longer cache
 */
export function useNumberDistribution() {
  const [distribution, setDistribution] = useState<Record<number, {count: number; totalBalance: string}>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/distribution`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDistribution(data.data);
        }
      }
    } catch (error) {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // Refresh every 60 seconds instead of 30
    const interval = setInterval(refetch, 90000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { distribution, isLoading, refetch };
}
