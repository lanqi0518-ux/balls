import { useState, useEffect, useRef } from 'react'
import { PrizePool } from './components/PrizePool'
import { Countdown } from './components/Countdown'
import { RecentDraws } from './components/RecentDraws'
import { Stats } from './components/Stats'
import { HowItWorks } from './components/HowItWorks'
import { SnapshotPanel } from './components/SnapshotPanel'
import { LiveDrawAnimation } from './components/LiveDrawAnimation'
import { NumberLookup } from './components/NumberLookup'
import { useRealtimeStatus, useRecentDraws } from './hooks/useRealtime'

function App() {
  const { status, isConnected, latestDraw } = useRealtimeStatus()
  const { draws, refetch: refetchDraws } = useRecentDraws(10)
  const [showDrawAnimation, setShowDrawAnimation] = useState(false)
  const [animationResult, setAnimationResult] = useState<typeof latestDraw>(null)
  const [notifications, setNotifications] = useState<string[]>([])
  const processedDraws = useRef<Set<number>>(new Set())

  // Handle new draw
  useEffect(() => {
    if (latestDraw && !processedDraws.current.has(latestDraw.drawId)) {
      console.log('🎰 New draw received:', latestDraw)
      processedDraws.current.add(latestDraw.drawId)
      
      // Show animation
      setAnimationResult(latestDraw)
      setShowDrawAnimation(true)
      
      // Refresh draws list
      refetchDraws()
      
      // Add notification
      addNotification(`🎱 Draw #${latestDraw.drawId}! Winning number: ${latestDraw.winningNumber}`)
    }
  }, [latestDraw, refetchDraws])

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev].slice(0, 3))
    setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1))
    }, 5000)
  }

  const closeAnimation = () => {
    setShowDrawAnimation(false)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-50 bg-[var(--bg-dark)]/95 backdrop-blur-sm">
        <div className="container py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo.svg" alt="Balls" className="w-8 h-8 md:w-10 md:h-10" />
            <div>
              <h1 className="text-lg md:text-xl font-bold">Balls</h1>
              <p className="text-[10px] md:text-xs text-[var(--text-muted)] hidden sm:block">On-Chain Lottery</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className={`live-indicator ${!isConnected ? 'opacity-50' : ''}`}>
              <span className={`live-dot ${!isConnected ? 'bg-red-500' : ''}`} />
              <span className="hidden xs:inline">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
            
            {status?.demoMode && (
              <span className="text-[10px] md:text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                DEMO
              </span>
            )}
            
            {status && (
              <div className="text-xs md:text-sm text-[var(--text-secondary)] hidden sm:block">
                {status.stats.eligibleHolders} participants
              </div>
            )}
            
            <a 
              href="https://twitter.com/ballsonrobin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'var(--green-primary)' }}
              title="@ballsonrobin"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>
      </header>
      
      {/* Notifications */}
      <div className="toast-container">
        {notifications.map((msg, index) => (
          <div key={index} className="toast">
            <span>{msg}</span>
          </div>
        ))}
      </div>
      
      {/* Draw Animation */}
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
      
      <main className="container py-6 md:py-12">
        {/* Hero */}
        <div className="text-center mb-8 md:mb-12">
          <p className="text-[var(--text-muted)] text-xs md:text-sm uppercase tracking-widest mb-2 md:mb-4">
            Robinhood Chain
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 md:mb-4">
            <span style={{ color: 'var(--green-primary)' }}>Balls</span> Lottery
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-lg max-w-xl mx-auto px-4">
            Top 200 holders automatically participate. No action required.
          </p>
        </div>
        
        {/* Prize Pool & Countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="lg:col-span-3">
            <PrizePool 
              prizePool={status?.prizePool || '0'}
              prizePoolUsd={status?.prizePoolUsd || '0'}
              ethPriceUsd={status?.ethPriceUsd || 0}
              prizePoolWallet={status?.taxReceiverWallet}
            />
          </div>
          <div className="lg:col-span-2 card flex flex-col items-center justify-center py-6 md:py-8">
            <p className="text-[var(--text-muted)] text-xs md:text-sm uppercase tracking-wider mb-3 md:mb-4">
              Next Draw
            </p>
            <Countdown 
              timeUntil={status?.timeUntilNextDraw || 60}
              isUrgent={(status?.timeUntilNextDraw || 60) <= 10}
            />
            {status?.hasSnapshot && (
              <p className="mt-3 md:mt-4 text-xs md:text-sm" style={{ color: 'var(--green-primary)' }}>
                ✓ Snapshot Locked
              </p>
            )}
            
            {/* Last winning number */}
            {draws.length > 0 && (
              <div className="mt-3 md:mt-4 text-center">
                <p className="text-[10px] md:text-xs text-[var(--text-muted)] mb-1 md:mb-2">Last Winner</p>
                <div className="ball ball-small ball-winning">
                  {draws[0].winningNumber}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Snapshot Panel */}
        <SnapshotPanel 
          snapshot={status?.snapshot || null}
          hasSnapshot={status?.hasSnapshot || false}
          eligibleCount={status?.stats.eligibleHolders || 0}
        />
        
        {/* Stats & Lookup */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <Stats 
            totalDraws={status?.currentDrawId || 0}
            totalHolders={status?.stats.totalHolders || 0}
            eligibleHolders={status?.stats.eligibleHolders || 0}
          />
          <NumberLookup />
        </div>
        
        {/* Recent Draws */}
        <div className="mb-6 md:mb-8">
          <RecentDraws draws={draws} />
        </div>
        
        {/* How It Works */}
        <HowItWorks />
        
        {/* Footer */}
        <footer className="text-center py-8 md:py-12 mt-8 md:mt-12 border-t border-white/5">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
            <img src="/logo.svg" alt="Balls" className="w-8 h-8 md:w-10 md:h-10" />
            <span className="text-base md:text-lg font-bold" style={{ color: 'var(--green-primary)' }}>Balls</span>
          </div>
          <p className="text-[var(--text-muted)] text-xs md:text-sm mb-3">
            Built on Robinhood Chain · Fully Automated
          </p>
          <a 
            href="https://twitter.com/ballsonrobin" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs md:text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--green-primary)' }}
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            @ballsonrobin
          </a>
        </footer>
      </main>
    </div>
  )
}

export default App
