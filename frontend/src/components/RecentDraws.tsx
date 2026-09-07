import { useState, memo } from 'react'

interface WinnerShare {
  address: string
  balance: string
  sharePercent: number
  prize: string
  txHash?: string
}

interface DrawResult {
  drawId: number
  timestamp: number
  winningNumber: number
  prizePool: string
  winnersCount: number
  totalWinnerBalance?: string
  winners?: WinnerShare[]
  rollover?: boolean
}

interface Props {
  draws: DrawResult[]
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const RecentDraws = memo(function RecentDraws({ draws }: Props) {
  const [expandedDraw, setExpandedDraw] = useState<number | null>(null)

  return (
    <section className="card">
      <header className="section-header flex-wrap gap-2">
        <h3>Draw History</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
          Prize split by holding ratio
        </span>
      </header>

      {draws.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          No draws yet.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {draws.map((draw, index) => {
            const isNewest = index === 0
            const isExpanded = expandedDraw === draw.drawId
            const hasDetails = !!draw.winners && draw.winners.length > 0

            return (
              <div key={draw.drawId}>
                <button
                  type="button"
                  className={`draw-item w-full text-left ${isNewest ? 'draw-item-new' : ''}`}
                  onClick={() =>
                    setExpandedDraw(isExpanded ? null : draw.drawId)
                  }
                  aria-expanded={isExpanded}
                >
                  <span className="text-[var(--text-muted)] text-xs md:text-sm mono w-10 md:w-14">
                    #{draw.drawId}
                  </span>

                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className={draw.rollover ? 'ball ball-sm ball-jackpot' : 'ball ball-sm ball-winning'}>
                      {draw.winningNumber}
                    </div>
                    <div className="hidden sm:block text-xs text-[var(--text-muted)] mono">
                      {formatTime(draw.timestamp)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm md:text-base font-bold text-gold display">
                      {Number(draw.prizePool).toFixed(4)}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                      ETH prize
                    </div>
                  </div>

                  <div className="text-right min-w-[64px] md:min-w-[80px]">
                    {draw.rollover ? (
                      <>
                        <div className="text-sm md:text-base font-bold text-gold">ROLLOVER</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                          Next round
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm md:text-base font-bold">
                          {draw.winnersCount}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                          Winner{draw.winnersCount === 1 ? '' : 's'}
                        </div>
                      </>
                    )}
                  </div>

                  <svg
                    className={`w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''} ${hasDetails ? '' : 'opacity-25'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && hasDetails && (
                  <div
                    className="mt-2 mb-4 rounded-xl border border-[var(--border)] p-3 md:p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-3">
                      Distribution
                    </div>

                    <div className="flex flex-col gap-2">
                      {draw.winners!.map((winner, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg gap-2 border border-[var(--border)]"
                          style={{ background: 'var(--bg-card)' }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[var(--text-muted)] text-xs mono w-5">
                              {idx + 1}
                            </span>
                            <span className="mono text-xs md:text-sm truncate">
                              {winner.address.slice(0, 6)}…{winner.address.slice(-4)}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 md:gap-6 ml-7 sm:ml-0">
                            <div className="text-right">
                              <div className="text-xs md:text-sm font-bold text-[var(--purple)]">
                                {winner.sharePercent.toFixed(1)}%
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                                Share
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xs md:text-sm font-bold text-gold display">
                                +{Number(winner.prize).toFixed(4)}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                                ETH
                              </div>
                            </div>

                            <div className="text-right">
                              {winner.txHash ? (
                                <a
                                  href={`https://robinhoodchain.blockscout.com/tx/${winner.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-[var(--green-primary)] hover:underline"
                                >
                                  ✓ SENT
                                </a>
                              ) : (
                                <span className="text-[10px] font-semibold text-[var(--yellow)]">
                                  PENDING
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
})
