import { memo } from 'react'

interface Draw {
  drawId: number
  timestamp: number
  winningNumber: number
  prizePool: string
  winnersCount: number
  rollover?: boolean
}

interface Props {
  draws: Draw[]
  /** How many balls to show inline; the rest live in Recent Draws. */
  limit?: number
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp * 1000

  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`

  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export const WinningNumbers = memo(function WinningNumbers({
  draws,
  limit = 8,
}: Props) {
  const shown = draws.slice(0, limit)

  return (
    <section className="card">
      <header className="section-header flex-wrap gap-2">
        <h3>Latest Winning Numbers</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
          Newest → Oldest
        </span>
      </header>

      {shown.length === 0 ? (
        <div className="py-10 text-center text-[var(--text-muted)] text-sm">
          Waiting for the first draw…
        </div>
      ) : (
        <div className="winning-strip">
          {shown.map((draw, index) => {
            const isLatest = index === 0

            return (
              <div key={draw.drawId} className="winning-item">
                <div className="winning-item-id">
                  Draw #{draw.drawId}
                </div>

                <div
                  className={
                    isLatest ? 'ball ball-lg ball-winning ball-enter' : 'ball ball-lg'
                  }
                >
                  {draw.winningNumber}
                </div>

                {draw.rollover ? (
                  <div className="winning-item-prize text-gold">ROLLOVER</div>
                ) : (
                  <div className="winning-item-prize">
                    {Number(draw.prizePool).toFixed(3)} ETH
                  </div>
                )}

                <div className="winning-item-time">
                  {draw.winnersCount} winner{draw.winnersCount === 1 ? '' : 's'} · {formatTime(draw.timestamp)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
})
