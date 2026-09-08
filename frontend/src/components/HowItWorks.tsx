import { memo } from 'react'

interface Props {
  drawIntervalSeconds?: number
  minHoldingSeconds?: number
  topHoldersLimit?: number
}

export const HowItWorks = memo(function HowItWorks({
  drawIntervalSeconds = 70,
  minHoldingSeconds = 60,
  topHoldersLimit = 100,
}: Props) {
  const steps = [
    {
      num: '01',
      title: 'Hold',
      desc: `Buy and hold BALLS. After ${minHoldingSeconds}s in your wallet you're in the pool.`,
    },
    {
      num: '02',
      title: 'Rank',
      desc: `Only the top ${topHoldersLimit} holders by balance take part in each draw.`,
    },
    {
      num: '03',
      title: 'Number',
      desc: 'Your address deterministically maps to a number 1–50. Same wallet, same number.',
    },
    {
      num: '04',
      title: 'Win',
      desc: `Every ${drawIntervalSeconds}s a number is drawn. Holders of that number split the ETH pool.`,
    },
  ]

  return (
    <section className="card">
      <header className="section-header">
        <h3>How to Play</h3>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {steps.map(step => (
          <article
            key={step.num}
            className="rounded-xl p-4 md:p-5 border border-[var(--border)]"
            style={{ background: 'rgba(0, 0, 0, 0.2)' }}
          >
            <div
              className="text-2xl md:text-4xl display mb-2 md:mb-3"
              style={{ color: 'var(--gold)' }}
            >
              {step.num}
            </div>
            <h4 className="text-sm md:text-base font-bold mb-1">
              {step.title}
            </h4>
            <p className="text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
              {step.desc}
            </p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <article className="rounded-xl p-4 md:p-6 border border-[var(--border)]" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
          <h4 className="text-sm md:text-base font-bold mb-3 text-green">
            Tax Split (ETH)
          </h4>
          <div className="space-y-2 text-sm">
            <TaxRow label="Transaction tax" value="4% ETH" />
            <div className="h-px bg-white/10 my-2" />
            <TaxRow label="→ Prize pool" value="3% (all to winners)" tone="green" />
            <TaxRow label="→ Team wallet" value="1% (paid at draw)" />
          </div>
          <p className="text-[11px] md:text-xs text-[var(--text-muted)] pt-3 mt-3 border-t border-white/5 leading-relaxed">
            The 3% is paid in full to winners of that draw. The 1% is forwarded to
            the team wallet in the same batch as the prize payouts.
          </p>
        </article>

        <article className="rounded-xl p-4 md:p-6 border border-[var(--border)]" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
          <h4 className="text-sm md:text-base font-bold mb-3 text-green">
            Prize Distribution
          </h4>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
            When your number is drawn, the ETH pool is split among every winner
            in proportion to their BALLS balance at the snapshot.
          </p>
          <div
            className="rounded-lg p-3 mono text-xs md:text-sm"
            style={{ background: 'rgba(0, 200, 5, 0.08)', color: 'var(--green-light)' }}
          >
            your_eth = (your_balls / total_winners_balls) × prize_pool
          </div>
          <p className="text-[11px] md:text-xs text-[var(--text-muted)] pt-3 mt-3 border-t border-white/5 leading-relaxed">
            No one holds your number? The pool rolls straight into the next draw.
          </p>
        </article>
      </div>
    </section>
  )
})

function TaxRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green'
}) {
  const color = tone === 'green' ? 'var(--green-primary)' : 'var(--text-primary)'

  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
