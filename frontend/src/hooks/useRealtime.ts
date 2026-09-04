import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

interface LotteryStatus {
  isRunning: boolean;
  currentDrawId: number;
  timeUntilNextDraw: number;
  nextDrawTime: number;
  hasSnapshot: boolean;
  prizePool: string;
  prizePoolWallet: string;
  demoMode?: boolean;
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
 * Calculate time until next draw (second :01 of every minute)
 */
function getTimeUntilNextDraw(): number {
  const now = new Date();
  const seconds = now.getSeconds();
  
  if (seconds === 0) return 1;
  if (seconds >= 1) return 60 - seconds + 1;
  return 1;
}

/**
 * Real-time status hook
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<LotteryStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestDraw, setLatestDraw] = useState<DrawResult | null>(null);
  const [localCountdown, setLocalCountdown] = useState(getTimeUntilNextDraw());

  // Local countdown - update every 500ms for smooth display
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalCountdown(getTimeUntilNextDraw());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const connect = () => {
      try {
        eventSource = new EventSource(`${API_URL}/events`);

        eventSource.onopen = () => {
          setIsConnected(true);
          retryCount = 0;
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          
          // Exponential backoff: 1s, 2s, 4s, max 10s
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          retryCount++;
          reconnectTimeout = setTimeout(connect, delay);
        };

        eventSource.addEventListener('status', (event) => {
          try {
            const data = JSON.parse(event.data);
            setStatus(data);
          } catch (e) {}
        });

        eventSource.addEventListener('draw', (event) => {
          try {
            const data = JSON.parse(event.data);
            setLatestDraw(data);
          } catch (e) {}
        });
      } catch (e) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Combine server status with local countdown
  const effectiveStatus = status ? {
    ...status,
    timeUntilNextDraw: localCountdown
  } : null;

  return { status: effectiveStatus, isConnected, latestDraw };
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
    const interval = setInterval(refetch, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { distribution, isLoading, refetch };
}
