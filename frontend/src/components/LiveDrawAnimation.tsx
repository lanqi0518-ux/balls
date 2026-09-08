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

// Draws run about once a minute, so the overlay has to get out of the way on
// its own. It used to stay up until the user clicked Close, covering the page.
const AUTO_CLOSE_MS = 12000

export function LiveDrawAnimation({ isVisible, result, onClose }: Props) {
  const [phase, setPhase] = useState<'spinning' | 'reveal' | 'winners'>('spinning')
  const [displayNumber, setDisplayNumber] = useState(1)

  useEffect(() => {
    if (!isVisible) {
      setPhase('spinning')
      return
    }

    const timeouts: ReturnType<typeof setTimeout>[] = []

    let count = 0
    const spinInterval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 50) + 1)
      count++
      if (count > 18) {
        clearInterval(spinInterval)
        setPhase('reveal')
        setDisplayNumber(result.winningNumber)

        timeouts.push(
          setTimeout(() => {
            setPhase('winners')
          }, 1600),
        )
      }
    }, 90)

    timeouts.push(setTimeout(onClose, AUTO_CLOSE_MS))

    return () => {
      clearInterval(spinInterval)
      timeouts.forEach(clearTimeout)
    }
  }, [isVisible, result.winningNumber, onClose])

  if (!isVisible) return null

  const hasWinners = result.winnersCount > 0
  const spinning = phase === 'spinning'

  return (
    <div
      className="draw-animation-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Draw ${result.drawId} result`}
    >
      <div className="draw-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="draw-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="text-center">
          <div className="jackpot-label" style={{ color: 'var(--text-muted)' }}>
            Draw #{result.drawId}
          </div>
          <div className="text-white text-base md:text-lg font-semibold mb-6 mt-1">
            Winning Number
          </div>

          <div className="flex justify-center">
            <div
              className={`ball ball-xl ${spinning ? '' : 'ball-winning'}`}
              style={spinning ? undefined : { animation: 'ball-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              {displayNumber}
            </div>
          </div>

          {!spinning && (
            <div className="mt-8">
              {hasWinners ? (
                <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
                  <div className="text-center">
                    <div className="stat-value text-green">
                      {result.winnersCount}
                    </div>
                    <div className="stat-label">Winners</div>
                  </div>
                  <div className="text-center">
                    <div className="stat-value text-gold">
                      {Number(result.prizePool).toFixed(4)}
                    </div>
                    <div className="stat-label">ETH Prize</div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">🎰</div>
                  <div className="display text-2xl md:text-3xl text-gold">
                    JACKPOT ROLLS OVER
                  </div>
                  <p className="text-xs md:text-sm text-[var(--text-muted)] mt-2">
                    No holders matched. Prize accumulates to the next draw.
                  </p>
                  <div className="mt-4 text-lg md:text-xl display text-green">
                    +{Number(result.prizePool).toFixed(4)} ETH
                  </div>
                </div>
              )}

              {phase === 'winners' && result.winners && result.winners.length > 0 && (
                <div
                  className="mt-6 rounded-xl p-3 text-left max-h-52 overflow-y-auto border border-[var(--border)]"
                  style={{ background: 'rgba(0, 0, 0, 0.35)' }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-3 px-1">
                    Distribution by holding ratio
                  </div>

                  <div className="flex flex-col gap-2">
                    {result.winners.map((winner, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 md:p-3 rounded-lg"
                        style={{ background: 'var(--bg-card)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mono text-xs md:text-sm truncate">
                            {winner.address.slice(0, 6)}…{winner.address.slice(-4)}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mono">
                            {Number(winner.balance).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}{' '}
                            BALLS
                          </div>
                        </div>

                        <div className="text-right ml-3 flex-shrink-0">
                          <div className="text-sm md:text-base font-bold text-gold display">
                            +{Number(winner.prize).toFixed(4)}
                          </div>
                          <div className="text-[10px] text-[var(--purple)] font-semibold">
                            {winner.sharePercent.toFixed(1)}% share
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auto-close indicator */}
          <div className="draw-progress mt-6" aria-hidden>
            <div
              className="draw-progress-fill"
              style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
