interface Props {
  totalDraws: number
  totalHolders: number
  eligibleHolders: number
}

export function Stats({ totalDraws, totalHolders, eligibleHolders }: Props) {
  return (
    <div className="card">
      <h3 className="text-xs md:text-sm text-[var(--text-muted)] uppercase tracking-wider mb-4 md:mb-6">
        Statistics
      </h3>
      
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="text-center">
          <div className="stat-value">{totalDraws}</div>
          <div className="stat-label">Draws</div>
        </div>
        
        <div className="text-center">
          <div className="stat-value">{totalHolders}</div>
          <div className="stat-label">Holders</div>
        </div>
        
        <div className="text-center">
          <div className="stat-value" style={{ color: 'var(--green-primary)' }}>
            {eligibleHolders}
          </div>
          <div className="stat-label">Eligible</div>
        </div>
      </div>
      
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/5 grid grid-cols-4 gap-2 md:gap-4 text-center">
        <div>
          <div className="text-base md:text-lg font-bold">4%</div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Tax</div>
        </div>
        <div>
          <div className="text-base md:text-lg font-bold" style={{ color: 'var(--green-primary)' }}>Top 200</div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Eligible</div>
        </div>
        <div>
          <div className="text-base md:text-lg font-bold">1-50</div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Numbers</div>
        </div>
        <div>
          <div className="text-base md:text-lg font-bold">1 min</div>
          <div className="text-[10px] md:text-xs text-[var(--text-muted)]">Interval</div>
        </div>
      </div>
    </div>
  )
}
