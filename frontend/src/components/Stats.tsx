interface Props {
  totalDraws: number
  totalHolders: number
  eligibleHolders: number
}

export function Stats({ totalDraws, totalHolders, eligibleHolders }: Props) {
  return (
    <div className="card">
      <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wider mb-6">
        Statistics
      </h3>
      
      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="stat-value">{totalDraws}</div>
          <div className="stat-label">Total Draws</div>
        </div>
        
        <div>
          <div className="stat-value">{totalHolders}</div>
          <div className="stat-label">Holders</div>
        </div>
        
        <div>
          <div className="stat-value" style={{ color: 'var(--green-primary)' }}>
            {eligibleHolders}
          </div>
          <div className="stat-label">Eligible</div>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-3 gap-6 text-center">
        <div>
          <div className="text-lg font-bold">4%</div>
          <div className="text-xs text-[var(--text-muted)]">Tax</div>
        </div>
        <div>
          <div className="text-lg font-bold">1-50</div>
          <div className="text-xs text-[var(--text-muted)]">Numbers</div>
        </div>
        <div>
          <div className="text-lg font-bold">1 min</div>
          <div className="text-xs text-[var(--text-muted)]">Interval</div>
        </div>
      </div>
    </div>
  )
}
