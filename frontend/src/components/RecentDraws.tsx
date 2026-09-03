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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wider">
          Recent Draws
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
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
                <div className="flex items-center gap-4">
                  <span className="text-[var(--text-muted)] text-sm w-12">
                    #{draw.drawId}
                  </span>
                  <div className="ball ball-small ball-winning">
                    {draw.winningNumber}
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-bold" style={{ color: 'var(--green-primary)' }}>
                      {Number(draw.prizePool).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">Prize</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold">{draw.winnersCount}</div>
                    <div className="text-xs text-[var(--text-muted)]">Winners</div>
                  </div>
                  
                  <div className="text-sm text-[var(--text-muted)] w-24 text-right">
                    {formatTime(draw.timestamp)}
                  </div>
                  
                  {draw.winners && draw.winners.length > 0 && (
                    <svg 
                      className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${expandedDraw === draw.drawId ? 'rotate-180' : ''}`}
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
                <div className="mt-2 p-4 rounded-lg" style={{ background: 'var(--bg-dark)' }}>
                  <div className="text-xs text-[var(--text-muted)] mb-3">
                    Winner distribution (by holding ratio)
                  </div>
                  
                  <div className="space-y-2">
                    {draw.winners.map((winner, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: 'var(--bg-card)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-muted)] text-sm w-6">{idx + 1}</span>
                          <span className="font-mono text-sm">
                            {winner.address.slice(0, 8)}...{winner.address.slice(-6)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-sm">
                              {Number(winner.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Balance</div>
                          </div>
                          
                          <div className="text-right w-16">
                            <div className="text-sm font-bold" style={{ color: 'var(--purple)' }}>
                              {winner.sharePercent.toFixed(1)}%
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Share</div>
                          </div>
                          
                          <div className="text-right w-20">
                            <div className="text-sm font-bold" style={{ color: 'var(--green-primary)' }}>
                              {Number(winner.prize).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Won</div>
                          </div>
                          
                          <div className="text-right w-16">
                            {winner.txHash ? (
                              <a 
                                href={`https://explorer.robinhoodchain.com/tx/${winner.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs"
                                style={{ color: 'var(--green-primary)' }}
                              >
                                ✓ Sent
                              </a>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--yellow)' }}>
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
