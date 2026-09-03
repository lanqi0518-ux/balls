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

export function SnapshotPanel({ snapshot, hasSnapshot }: Props) {
  const { distribution } = useNumberDistribution()

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wider">
          Number Distribution
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
        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[var(--text-muted)] text-sm">Draw #{snapshot.drawId}</span>
            <span className="mx-3 text-[var(--text-muted)]">·</span>
            <span className="text-sm">{snapshot.eligibleCount} participants</span>
          </div>
          <div className="text-xs text-[var(--text-muted)] font-mono">
            {snapshot.hash.slice(0, 16)}...
          </div>
        </div>
      )}
    </div>
  )
}
