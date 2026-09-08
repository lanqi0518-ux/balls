import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { PrizePool } from './components/PrizePool'
import { Countdown } from './components/Countdown'
import { RecentDraws } from './components/RecentDraws'
import { WinningNumbers } from './components/WinningNumbers'
import { Stats } from './components/Stats'
import { HowItWorks } from './components/HowItWorks'
import { SnapshotPanel } from './components/SnapshotPanel'
import { LiveDrawAnimation } from './components/LiveDrawAnimation'
import { NumberLookup } from './components/NumberLookup'
import { useRealtimeStatus, useRecentDraws } from './hooks/useRealtime'

interface Notification {
  id: number
  message: string
}

function App() {
  const { status, isConnected, latestDraw } = useRealtimeStatus()
  const { draws, refetch: refetchDraws } = useRecentDraws(12)
  const [showDrawAnimation, setShowDrawAnimation] = useState(false)
  const [animationResult, setAnimationResult] = useState<typeof latestDraw>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const processedDraws = useRef<Set<number>>(new Set())
  const notificationId = useRef(0)

  useEffect(() => {
    if (latestDraw && !processedDraws.current.has(latestDraw.drawId)) {
      processedDraws.current.add(latestDraw.drawId)

      // A draw a minute would otherwise grow this set without bound
      if (processedDraws.current.size > 200) {
        processedDraws.current = new Set([latestDraw.drawId])
      }

      setAnimationResult(latestDraw)
      setShowDrawAnimation(true)

      refetchDraws()

      addNotification(
        `Draw #${latestDraw.drawId} — number ${latestDraw.winningNumber}`,
      )
    }
  }, [latestDraw, refetchDraws])

  const addNotification = (message: string) => {
    const id = notificationId.current++
    setNotifications(prev => [{ id, message }, ...prev].slice(0, 3))
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const closeAnimation = useCallback(() => {
    setShowDrawAnimation(false)
  }, [])

  const drawIntervalSeconds = status?.drawIntervalMs
    ? Math.round(status.drawIntervalMs / 1000)
    : undefined

  const minHoldingSeconds = status?.stats.minHoldingDuration
  const topHoldersLimit = status?.stats.topHoldersLimit

  const tickerItems = useMemo(() => {
    if (draws.length === 0) return []

    // 8 recent draws so the loop feels lively without too much motion
    return draws.slice(0, 8).map(d => ({
      id: d.drawId,
      number: d.winningNumber,
      prize: Number(d.prizePool).toFixed(3),
      winners: d.winnersCount,
      rollover: d.rollover,
    }))
  }, [draws])

  const lastWinningNumber = draws[0]?.winningNumber

  return (
    <div className="min-h-screen">
      {/* Header ------------------------------------------------------------ */}
      <header
        className="border-b border-white/5 sticky top-0 z-50"
        style={{ background: 'rgba(6, 15, 31, 0.85)', backdropFilter: 'blur(10px)' }}
      >
        <div className="container py-3 md:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo.svg" alt="Balls" className="w-8 h-8 md:w-10 md:h-10" />
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Balls</h1>
              <p className="text-[10px] md:text-xs text-[var(--text-muted)] hidden sm:block uppercase tracking-widest font-semibold">
                On-Chain Powerball
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="live-indicator">
              <span className={`live-dot ${!isConnected ? 'offline' : ''}`} />
              <span className="hidden xs:inline">
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            {status && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold">
                <span className="text-green">
                  {status.stats.eligibleHolders}
                </span>
                <span className="text-[var(--text-muted)]">/ {status.stats.totalHolders} in pool</span>
              </div>
            )}

            <a
              href="https://twitter.com/ballsonrobin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity text-[var(--text-secondary)]"
              title="@ballsonrobin"
              aria-label="Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Recent draws ticker */}
        {tickerItems.length > 0 && (
          <div className="ticker" aria-hidden>
            {/* Duplicate the run so it can loop seamlessly */}
            <div className="ticker-track">
              {[...tickerItems, ...tickerItems].map((item, idx) => (
                <span key={`${item.id}-${idx}`} className="ticker-item">
                  <span className="text-[var(--text-muted)]">Draw #{item.id}</span>
                  <strong>№ {item.number}</strong>
                  <span className="text-gold mono">{item.prize} ETH</span>
                  <span className="text-[var(--text-muted)]">
                    {item.rollover ? '· rollover' : `· ${item.winners} winner${item.winners === 1 ? '' : 's'}`}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Notifications ---------------------------------------------------- */}
      <div className="toast-container">
        {notifications.map(({ id, message }) => (
          <div key={id} className="toast">
            <span>{message}</span>
          </div>
        ))}
      </div>

      {/* Draw animation --------------------------------------------------- */}
      {showDrawAnimation && animationResult && (
        <LiveDrawAnimation
          isVisible={showDrawAnimation}
          result={{
            drawId: animationResult.drawId,
            winningNumber: animationResult.winningNumber,
            winnersCount: animationResult.winnersCount,
            prizePool: animationResult.prizePool,
            winners: animationResult.winners,
          }}
          onClose={closeAnimation}
        />
      )}

      <main className="container py-6 md:py-10">
        {/* Hero: jackpot + countdown ------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="lg:col-span-3">
            <PrizePool
              prizePool={status?.prizePool || '0'}
              prizePoolUsd={status?.prizePoolUsd || '0'}
              ethPriceUsd={status?.ethPriceUsd || 0}
              prizePoolWallet={status?.taxReceiverWallet}
            />
          </div>

          <aside className="lg:col-span-2 card card-elevated flex flex-col items-center justify-center py-8 md:py-10 gap-4">
            <div className="jackpot-label" style={{ color: 'var(--text-muted)' }}>
              Next Drawing In
            </div>

            <Countdown
              secondsRemaining={status?.timeUntilNextDraw}
              intervalSeconds={drawIntervalSeconds}
            />

            <div className="flex items-center gap-2 mt-2">
              {status?.hasSnapshot ? (
                <span
                  className="jackpot-chip"
                  style={{
                    background: 'rgba(0, 200, 5, 0.14)',
                    borderColor: 'rgba(0, 200, 5, 0.35)',
                    color: 'var(--green-primary)',
                  }}
                >
                  ✓ Snapshot Locked
                </span>
              ) : (
                <span className="jackpot-chip">
                  Snapshot in {Math.max(
                    0,
                    (status?.timeUntilNextDraw ?? drawIntervalSeconds ?? 70) -
                      Math.round((status?.snapshotLeadMs ?? 10000) / 1000),
                  )}
                  s
                </span>
              )}
            </div>

            {lastWinningNumber !== undefined && (
              <div className="pt-4 mt-4 border-t border-white/5 flex flex-col items-center gap-2 w-full">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  Last Winning Number
                </div>
                <div className="ball ball-winning">{lastWinningNumber}</div>
              </div>
            )}
          </aside>
        </div>

        {/* Latest winning numbers strip ---------------------------------- */}
        <div className="mb-6 md:mb-8">
          <WinningNumbers draws={draws} limit={8} />
        </div>

        {/* Number distribution ------------------------------------------- */}
        <div className="mb-6 md:mb-8">
          <SnapshotPanel
            snapshot={status?.snapshot || null}
            hasSnapshot={status?.hasSnapshot || false}
            eligibleCount={status?.stats.eligibleHolders || 0}
            topHoldersLimit={topHoldersLimit}
            lastWinningNumber={lastWinningNumber}
          />
        </div>

        {/* Stats + lookup ------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <Stats
            totalDraws={status?.currentDrawId || 0}
            totalHolders={status?.stats.totalHolders || 0}
            eligibleHolders={status?.stats.eligibleHolders || 0}
            drawIntervalSeconds={drawIntervalSeconds}
            minHoldingSeconds={minHoldingSeconds}
            topHoldersLimit={topHoldersLimit}
          />
          <NumberLookup topHoldersLimit={topHoldersLimit} />
        </div>

        {/* Full draw history --------------------------------------------- */}
        <div className="mb-6 md:mb-8">
          <RecentDraws draws={draws} />
        </div>

        {/* How to play --------------------------------------------------- */}
        <HowItWorks
          drawIntervalSeconds={drawIntervalSeconds}
          minHoldingSeconds={minHoldingSeconds}
          topHoldersLimit={topHoldersLimit}
        />

        {/* Footer -------------------------------------------------------- */}
        <footer className="text-center py-10 mt-10 border-t border-white/5">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/logo.svg" alt="Balls" className="w-8 h-8 md:w-10 md:h-10" />
            <span className="text-lg md:text-xl font-bold">Balls</span>
          </div>
          <p className="text-[var(--text-muted)] text-xs md:text-sm mb-4 max-w-md mx-auto">
            Built on Robinhood Chain · Fully automated · Prizes verifiable via
            snapshot hash and commit–reveal
          </p>
          <a
            href="https://twitter.com/ballsonrobin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs md:text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @ballsonrobin
          </a>
        </footer>
      </main>
    </div>
  )
}

export default App
