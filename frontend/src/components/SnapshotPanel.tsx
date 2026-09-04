import { memo } from 'react'
import { useNumberDistribution } from '../hooks/useRealtime'

interface Props {
  snapshot: {
    drawId: number
    eligibleCount: number
    hash: string
  } | null
  hasSnapshot: boolean
  eligibleCount: number
}

export const SnapshotPanel = memo(function SnapshotPanel({ snapshot, hasSnapshot }: Props) {
  const { distribution } = useNumberDistribution()

  return (
    <div className="card mb-6 md:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm text-[var(--text-muted)] uppercase tracking-wider">
          Number Distribution <span style={{ color: 'var(--green-primary)' }}>(Top 100)</span>
        </h3>
        
        {hasSnapshot && (
          <div className="live-indicator">
            <span className="live-dot" />
            SNAPSHOT LOCKED
          </div>
        )}
      </div>
      
      {/* Number Grid */}
      <div className="number-grid">
        {Array.from({ length: 50 }, (_, i) => i + 1).map(num => {
          const data = distribution[num] as {count: number; totalBalance: string} | undefined
          const count = data?.count || 0
          const hasHolders = count > 0
          
          return (
            <div 
              key={num} 
              className={`number-cell ${hasHolders ? 'has-holders' : ''}`}
              title={hasHolders ? `${count} holders` : 'No holders'}
            >
              {num}
              {hasHolders && (
                <span className="holder-count">{count}</span>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Snapshot Info */}
      {snapshot && (
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs md:text-sm">
            <span className="text-[var(--text-muted)]">Draw #{snapshot.drawId}</span>
            <span className="mx-2 md:mx-3 text-[var(--text-muted)]">·</span>
            <span>{snapshot.eligibleCount} participants</span>
          </div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)] font-mono">
            {snapshot.hash.slice(0, 12)}...
          </div>
        </div>
      )}
    </div>
  )
})
