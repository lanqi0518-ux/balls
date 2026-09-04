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
        className="text-center max-w-lg mx-4 md:mx-auto p-5 md:p-8"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', borderRadius: '20px' }}
      >
        <p className="text-[var(--text-muted)] text-xs md:text-sm uppercase tracking-wider mb-1 md:mb-2">
          Draw #{result.drawId}
        </p>
        
        <p className="text-white text-base md:text-lg mb-4 md:mb-6">Winning Number</p>
        
        {/* Big Ball */}
        <div className={`draw-ball mx-auto ${phase === 'spinning' ? 'animate-pulse' : ''}`}>
          {displayNumber}
        </div>
        
        {/* Winners Info */}
        {phase !== 'spinning' && (
          <div className="mt-5 md:mt-8">
            {result.winnersCount > 0 ? (
              <div className="flex justify-center gap-6 md:gap-8 mb-4 md:mb-6">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--green-primary)' }}>
                    {result.winnersCount}
                  </div>
                  <div className="text-xs md:text-sm text-[var(--text-muted)]">Winners</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--green-primary)' }}>
                    {Number(result.prizePool).toFixed(4)} ETH
                  </div>
                  <div className="text-xs md:text-sm text-[var(--text-muted)]">Prize Pool</div>
                </div>
              </div>
            ) : (
              <div className="text-center mb-4 md:mb-6">
                <div className="text-3xl md:text-4xl mb-2">🎰</div>
                <div className="text-xl md:text-2xl font-bold" style={{ color: 'var(--yellow)' }}>
                  JACKPOT ROLLOVER!
                </div>
                <div className="text-xs md:text-sm text-[var(--text-muted)] mt-2">
                  No winners - Prize accumulates to next draw
                </div>
                <div className="text-lg md:text-xl font-bold mt-3 md:mt-4" style={{ color: 'var(--green-primary)' }}>
                  {Number(result.prizePool).toFixed(4)} ETH + Next Round
                </div>
              </div>
            )}
            
            {/* Winner Details */}
            {phase === 'winners' && result.winners && result.winners.length > 0 && (
              <div 
                className="mt-4 md:mt-6 p-3 md:p-4 rounded-xl text-left max-h-48 md:max-h-60 overflow-y-auto"
                style={{ background: 'var(--bg-dark)' }}
              >
                <p className="text-[10px] md:text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 md:mb-3">
                  Distribution by Holding Ratio
                </p>
                
                <div className="space-y-2 md:space-y-3">
                  {result.winners.map((winner, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2 md:p-3 rounded-lg"
                      style={{ background: 'var(--bg-card)' }}
                    >
                      <div>
                        <div className="font-mono text-xs md:text-sm text-white">
                          {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                        </div>
                        <div className="text-[10px] md:text-xs text-[var(--text-muted)]">
                          {Number(winner.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} BALLS
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm md:text-base font-bold" style={{ color: 'var(--green-primary)' }}>
                          +{Number(winner.prize).toFixed(4)} ETH
                        </div>
                        <div className="text-[10px] md:text-xs" style={{ color: 'var(--purple)' }}>
                          {winner.sharePercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
