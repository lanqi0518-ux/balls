import { memo } from 'react'

interface Props {
  totalDraws: number
  totalHolders: number
  eligibleHolders: number
  drawIntervalSeconds?: number
  minHoldingSeconds?: number
  topHoldersLimit?: number
}

export const Stats = memo(function Stats({
  totalDraws,
  totalHolders,
  eligibleHolders,
  drawIntervalSeconds,
  minHoldingSeconds,
  topHoldersLimit,
}: Props) {
  return (
    <section className="card">
      <header className="section-header">
        <h3>Game Status</h3>
      </header>

      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="text-center">
          <div className="stat-value">{totalDraws.toLocaleString()}</div>
          <div className="stat-label">Draws</div>
        </div>

        <div className="text-center">
          <div className="stat-value">{totalHolders.toLocaleString()}</div>
          <div className="stat-label">Holders</div>
        </div>

        <div className="text-center">
          <div className="stat-value text-green">
            {eligibleHolders.toLocaleString()}
          </div>
          <div className="stat-label">Eligible</div>
        </div>
      </div>

      <div className="mt-6 pt-5 divider-dashed grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
        <StatBadge value="4%" label="ETH Tax" />
        <StatBadge value={`Top ${topHoldersLimit ?? 100}`} label="Participants" tone="green" />
        <StatBadge value={drawIntervalSeconds ? `${drawIntervalSeconds}s` : '70s'} label="Draw cycle" tone="gold" />
        <StatBadge value={minHoldingSeconds ? `${minHoldingSeconds}s` : '60s'} label="Min hold" />
      </div>
    </section>
  )
})

function StatBadge({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'green' | 'gold'
}) {
  const color =
    tone === 'green'
      ? 'var(--green-primary)'
      : tone === 'gold'
        ? 'var(--gold)'
        : 'var(--text-primary)'

  return (
    <div>
      <div className="text-base md:text-lg font-bold display" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] md:text-xs text-[var(--text-muted)] uppercase tracking-widest font-semibold">
        {label}
      </div>
    </div>
  )
}
