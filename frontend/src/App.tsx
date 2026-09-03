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
  const [currentDraw, setCurrentDraw] = useState<typeof latestDraw>(null)
  const [notifications, setNotifications] = useState<string[]>([])
  const lastDrawId = useRef(0)

  // Show animation when new draw comes in
  useEffect(() => {
    if (latestDraw && latestDraw.drawId > lastDrawId.current) {
      lastDrawId.current = latestDraw.drawId
      setCurrentDraw(latestDraw)
      setShowDrawAnimation(true)
      refetchDraws()
      addNotification(`🎱 Draw #${latestDraw.drawId} complete! Winning number: ${latestDraw.winningNumber}`)
    }
  }, [latestDraw])

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev, message])
    setTimeout(() => {
      setNotifications(prev => prev.slice(1))
    }, 5000)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="ball ball-winning" style={{ width: 40, height: 40, fontSize: 16 }}>B</div>
            <div>
              <h1 className="text-xl font-bold">Balls</h1>
              <p className="text-xs text-[var(--text-muted)]">On-Chain Lottery</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="live-indicator">
              <span className="live-dot" />
              {isConnected ? 'LIVE' : 'CONNECTING...'}
            </div>
            
            {status?.demoMode && (
              <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                DEMO
              </span>
            )}
            
            {status && (
              <div className="text-sm text-[var(--text-secondary)]">
                {status.stats.eligibleHolders} participants
              </div>
            )}
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
      {currentDraw && (
        <LiveDrawAnimation
          isVisible={showDrawAnimation}
          result={{
            drawId: currentDraw.drawId,
            winningNumber: currentDraw.winningNumber,
            winnersCount: currentDraw.winnersCount,
            prizePool: currentDraw.prizePool,
          }}
          onClose={() => setShowDrawAnimation(false)}
        />
      )}
      
      <main className="container py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-[var(--text-muted)] text-sm uppercase tracking-widest mb-4">
            Robinhood Chain
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
            <span style={{ color: 'var(--green-primary)' }}>Balls</span> Lottery
          </h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            Hold tokens to automatically participate in draws. No action required.
          </p>
        </div>
        
        {/* Prize Pool & Countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-3">
            <PrizePool 
              prizePool={status?.prizePool || '0'}
              prizePoolWallet={status?.prizePoolWallet}
            />
          </div>
          <div className="lg:col-span-2 card flex flex-col items-center justify-center">
            <p className="text-[var(--text-muted)] text-sm uppercase tracking-wider mb-4">
              Next Draw
            </p>
            <Countdown 
              timeUntil={status?.timeUntilNextDraw || 60}
              isUrgent={(status?.timeUntilNextDraw || 60) <= 10}
            />
            {status?.hasSnapshot && (
              <p className="mt-4 text-sm" style={{ color: 'var(--green-primary)' }}>
                ✓ Snapshot Locked
              </p>
            )}
            
            {/* Last winning number */}
            {draws.length > 0 && (
              <div className="mt-4 text-center">
                <p className="text-xs text-[var(--text-muted)] mb-2">Last Winner</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Stats 
            totalDraws={status?.currentDrawId || 0}
            totalHolders={status?.stats.totalHolders || 0}
            eligibleHolders={status?.stats.eligibleHolders || 0}
          />
          <NumberLookup />
        </div>
        
        {/* Recent Draws */}
        <div className="mb-8">
          <RecentDraws draws={draws} />
        </div>
        
        {/* How It Works */}
        <HowItWorks />
        
        {/* Footer */}
        <footer className="text-center py-12 mt-12 border-t border-white/5">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="ball ball-small ball-winning">B</div>
            <span className="text-lg font-bold" style={{ color: 'var(--green-primary)' }}>Balls</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            Built on Robinhood Chain · Fully Automated
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
