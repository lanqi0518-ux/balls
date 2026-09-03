import { useEffect, useState } from 'react'

interface Winner {
  address: string
  balance: string
  sharePercent: number
  prize: string
}

interface Props {
  isVisible: boolean
  result: {
    drawId: number
    winningNumber: number
    winnersCount: number
    prizePool: string
    winners?: Winner[]
  }
  onClose: () => void
}

export function LiveDrawAnimation({ isVisible, result, onClose }: Props) {
  const [phase, setPhase] = useState<'spinning' | 'reveal' | 'winners'>('spinning')
  const [displayNumber, setDisplayNumber] = useState(1)

  useEffect(() => {
    if (!isVisible) {
      setPhase('spinning')
      return
    }

    // Spinning animation
    let count = 0
    const spinInterval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 50) + 1)
      count++
      if (count > 15) {
        clearInterval(spinInterval)
        setPhase('reveal')
        setDisplayNumber(result.winningNumber)
        
        // Show winners after 1.5s
        setTimeout(() => {
          setPhase('winners')
        }, 1500)
      }
    }, 100)

    return () => {
      clearInterval(spinInterval)
    }
  }, [isVisible, result.winningNumber])

  if (!isVisible) return null

  return (
    <div className="draw-animation-overlay" onClick={onClose}>
      <div 
        className="text-center max-w-lg mx-auto p-8"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', borderRadius: '24px' }}
      >
        <p className="text-[var(--text-muted)] text-sm uppercase tracking-wider mb-2">
          Draw #{result.drawId}
        </p>
        
        <p className="text-white text-lg mb-6">Winning Number</p>
        
        {/* Big Ball */}
        <div className={`draw-ball mx-auto ${phase === 'spinning' ? 'animate-pulse' : ''}`}>
          {displayNumber}
        </div>
        
        {/* Winners Info */}
        {phase !== 'spinning' && (
          <div className="mt-8">
            <div className="flex justify-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: 'var(--green-primary)' }}>
                  {result.winnersCount}
                </div>
                <div className="text-sm text-[var(--text-muted)]">Winners</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: 'var(--green-primary)' }}>
                  {Number(result.prizePool).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-sm text-[var(--text-muted)]">Prize Pool</div>
              </div>
            </div>
            
            {/* Winner Details */}
            {phase === 'winners' && result.winners && result.winners.length > 0 && (
              <div 
                className="mt-6 p-4 rounded-xl text-left max-h-60 overflow-y-auto"
                style={{ background: 'var(--bg-dark)' }}
              >
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Distribution by Holding Ratio
                </p>
                
                <div className="space-y-3">
                  {result.winners.map((winner, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'var(--bg-card)' }}
                    >
                      <div>
                        <div className="font-mono text-sm text-white">
                          {winner.address.slice(0, 8)}...{winner.address.slice(-6)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Balance: {Number(winner.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold" style={{ color: 'var(--green-primary)' }}>
                          +{Number(winner.prize).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--purple)' }}>
                          {winner.sharePercent.toFixed(1)}% share
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {phase === 'winners' && result.winnersCount === 0 && (
              <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
                <p className="text-[var(--text-muted)]">
                  No winners this round. Prize rolls over to next draw!
                </p>
              </div>
            )}
          </div>
        )}
        
        <button 
          onClick={onClose}
          className="mt-8 btn btn-primary"
        >
          Close
        </button>
      </div>
    </div>
  )
}
