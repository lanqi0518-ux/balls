import { useState } from 'react'

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
  rollover?: boolean // No winners, prize rolls over
}

interface Props {
  draws: DrawResult[]
}

export function RecentDraws({ draws }: Props) {
  const [expandedDraw, setExpandedDraw] = useState<number | null>(null)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-1">
        <h3 className="text-xs md:text-sm text-[var(--text-muted)] uppercase tracking-wider">
          Recent Draws
        </h3>
        <span className="text-[10px] md:text-xs text-[var(--text-muted)]">
          Distributed by holding ratio
        </span>
      </div>
      
      {draws.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No draws yet
        </div>
      ) : (
        <div className="space-y-2">
          {draws.map((draw, index) => (
            <div key={draw.drawId}>
              <div 
                className={`draw-item ${index === 0 ? 'draw-item-new' : ''}`}
                onClick={() => setExpandedDraw(expandedDraw === draw.drawId ? null : draw.drawId)}
              >
                {/* Left side: ID + Ball */}
                <div className="flex items-center gap-2 md:gap-4">
                  <span className="text-[var(--text-muted)] text-xs md:text-sm w-8 md:w-12">
                    #{draw.drawId}
                  </span>
                  <div className="ball ball-small ball-winning">
                    {draw.winningNumber}
                  </div>
                </div>
                
                {/* Right side: Stats */}
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="text-right">
                    <div className="font-bold text-sm md:text-base" style={{ color: 'var(--green-primary)' }}>
                      {Number(draw.prizePool).toFixed(4)} ETH
                    </div>
                    <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Prize</div>
                  </div>
                  
                  <div className="text-right min-w-[50px] md:min-w-[60px]">
                    {draw.rollover ? (
                      <>
                        <div className="font-bold text-sm md:text-base" style={{ color: 'var(--yellow)' }}>🎰</div>
                        <div className="text-[10px] md:text-xs" style={{ color: 'var(--yellow)' }}>ROLLOVER</div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-sm md:text-base">{draw.winnersCount}</div>
                        <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Winners</div>
                      </>
                    )}
                  </div>
                  
                  <div className="text-[10px] md:text-sm text-[var(--text-muted)] w-16 md:w-24 text-right hidden xs:block">
                    {formatTime(draw.timestamp)}
                  </div>
                  
                  {draw.winners && draw.winners.length > 0 && (
                    <svg 
                      className={`w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)] transition-transform ${expandedDraw === draw.drawId ? 'rotate-180' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedDraw === draw.drawId && draw.winners && draw.winners.length > 0 && (
                <div className="mt-2 p-3 md:p-4 rounded-lg" style={{ background: 'var(--bg-dark)' }}>
                  <div className="text-[10px] md:text-xs text-[var(--text-muted)] mb-2 md:mb-3">
                    Winner distribution (by holding ratio)
                  </div>
                  
                  <div className="space-y-2">
                    {draw.winners.map((winner, idx) => (
                      <div 
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 md:p-3 rounded-lg gap-2"
                        style={{ background: 'var(--bg-card)' }}
                      >
                        {/* Address */}
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="text-[var(--text-muted)] text-xs md:text-sm w-5 md:w-6">{idx + 1}</span>
                          <span className="font-mono text-xs md:text-sm">
                            {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                          </span>
                        </div>
                        
                        {/* Stats - horizontal on mobile */}
                        <div className="flex items-center gap-3 md:gap-6 ml-7 sm:ml-0">
                          <div className="text-left sm:text-right">
                            <div className="text-xs md:text-sm font-bold" style={{ color: 'var(--purple)' }}>
                              {winner.sharePercent.toFixed(1)}%
                            </div>
                            <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Share</div>
                          </div>
                          
                          <div className="text-left sm:text-right">
                            <div className="text-xs md:text-sm font-bold" style={{ color: 'var(--green-primary)' }}>
                              {Number(winner.prize).toFixed(4)} ETH
                            </div>
                            <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Won</div>
                          </div>
                          
                          <div className="text-left sm:text-right">
                            {winner.txHash ? (
                              <a 
                                href={`https://robinhoodchain.blockscout.com/tx/${winner.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] md:text-xs"
                                style={{ color: 'var(--green-primary)' }}
                              >
                                ✓ Sent
                              </a>
                            ) : (
                              <span className="text-[10px] md:text-xs" style={{ color: 'var(--yellow)' }}>
                                Pending
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
          ))}
        </div>
      )}
    </div>
  )
}
