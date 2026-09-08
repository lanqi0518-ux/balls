import { memo } from 'react'
import { useNumberDistribution } from '../hooks/useRealtime'

interface Props {
  snapshot: {
    drawId: number
    eligibleCount: number
    hash: string
    commitment?: string
  } | null
  hasSnapshot: boolean
  eligibleCount: number
  topHoldersLimit?: number
  /** Winning number of the most recent draw, highlighted in red. */
  lastWinningNumber?: number
}

export const SnapshotPanel = memo(function SnapshotPanel({
  snapshot,
  hasSnapshot,
  eligibleCount,
  topHoldersLimit,
  lastWinningNumber,
}: Props) {
  const { distribution } = useNumberDistribution()

  return (
    <section className="card">
      <header className="section-header flex-wrap gap-2">
        <h3>Number Distribution</h3>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
            Top {topHoldersLimit ?? 100} · {eligibleCount} eligible
          </span>
          {hasSnapshot && (
            <span className="live-indicator">
              <span className="live-dot" />
              LOCKED
            </span>
          )}
        </span>
      </header>

      <div className="number-grid">
        {Array.from({ length: 50 }, (_, i) => i + 1).map(num => {
          const data = distribution[num] as
            | { count: number; totalBalance: string }
            | undefined
          const count = data?.count ?? 0
          const hasHolders = count > 0
          const isWinning = num === lastWinningNumber

          const className = [
            'number-cell',
            hasHolders ? 'has-holders' : '',
            isWinning ? 'is-winning' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const title = isWinning
            ? `${count} holder${count === 1 ? '' : 's'} · last winning number`
            : hasHolders
              ? `${count} holder${count === 1 ? '' : 's'}`
              : 'No holders'

          return (
            <div key={num} className={className} title={title}>
              {num}
              {hasHolders && <span className="holder-count">{count}</span>}
            </div>
          )
        })}
      </div>

      {snapshot && (
        <div className="mt-6 pt-5 divider-dashed flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs md:text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Draw #{snapshot.drawId}</span>
            <span className="mx-2 md:mx-3 text-[var(--text-muted)]">·</span>
            <span>{snapshot.eligibleCount} participants</span>
          </div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)] mono flex flex-col sm:items-end gap-1">
            <span title={snapshot.hash}>
              snapshot <span className="text-[var(--text-secondary)]">{snapshot.hash.slice(0, 12)}…</span>
            </span>
            {/* Published before the draw; the seed behind it is revealed with
                the result so the winning number can be rechecked. */}
            {snapshot.commitment && (
              <span title={snapshot.commitment}>
                commit <span className="text-[var(--text-secondary)]">{snapshot.commitment.slice(0, 12)}…</span>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
})
