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
  
  if (seconds === 0) {
    return 1; // 1 second until :01
  } else if (seconds >= 1) {
    return 60 - seconds + 1; // Seconds until next :01
  }
  return 1;
}

/**
 * Real-time status hook with local time-based countdown
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<LotteryStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestDraw, setLatestDraw] = useState<DrawResult | null>(null);
  const [localCountdown, setLocalCountdown] = useState(getTimeUntilNextDraw());

  // Local countdown based on actual time
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalCountdown(getTimeUntilNextDraw());
    }, 100); // Update frequently for accuracy
    return () => clearInterval(timer);
  }, []);

  // SSE connection with auto-reconnect
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      eventSource = new EventSource(`${API_URL}/events`);

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('SSE connected');
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connect, 3000);
      };

      eventSource.addEventListener('status', (event) => {
        const data = JSON.parse(event.data);
        setStatus(data);
      });

      eventSource.addEventListener('draw', (event) => {
        const data = JSON.parse(event.data);
        setLatestDraw(data);
      });
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Return local countdown for smooth, accurate display
  const effectiveStatus = status ? {
    ...status,
    timeUntilNextDraw: localCountdown
  } : null;

  return { status: effectiveStatus, isConnected, latestDraw };
}

/**
 * Get recent draws
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
      console.error('Failed to fetch draws:', error);
    } finally {
      setIsLoading(false);
    }
  }, [count]);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 10000);
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
      const data = await res.json();
      if (data.success) {
        setUserInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
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
      const data = await res.json();
      if (data.success) {
        return data.data.number;
      }
      return null;
    } catch (error) {
      console.error('Failed to lookup number:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookupNumber, isLoading };
}

/**
 * Get number distribution
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
      console.error('Failed to fetch distribution:', error);
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
