export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Hold Tokens',
      desc: 'Buy and hold BALLS tokens for at least 1 minute',
    },
    {
      num: '02',
      title: 'Top 200',
      desc: 'Only top 200 holders by balance can participate in draws',
    },
    {
      num: '03',
      title: 'Get Number',
      desc: 'System assigns you a number (1-50) based on your wallet',
    },
    {
      num: '04',
      title: 'Win by Ratio',
      desc: 'Winners split prize pool based on their holding ratio',
    },
  ]

  return (
    <div className="card">
      <h3 className="text-xs md:text-sm text-[var(--text-muted)] uppercase tracking-wider mb-6 md:mb-8 text-center">
        How It Works
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-10">
        {steps.map((step, index) => (
          <div key={index} className="text-center">
            <div 
              className="text-2xl md:text-4xl font-extrabold mb-2 md:mb-3"
              style={{ color: 'var(--green-primary)' }}
            >
              {step.num}
            </div>
            <h4 className="text-sm md:text-base font-bold mb-1 md:mb-2">{step.title}</h4>
            <p className="text-xs md:text-sm text-[var(--text-muted)]">{step.desc}</p>
          </div>
        ))}
      </div>
      
      {/* Tax distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="p-4 md:p-6 rounded-lg" style={{ background: 'var(--bg-dark)' }}>
          <h4 className="text-sm md:text-base font-bold mb-3 md:mb-4" style={{ color: 'var(--green-primary)' }}>
            Tax Distribution
          </h4>
          <div className="space-y-2 md:space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Transaction Tax</span>
              <span className="font-bold">4%</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">→ Prize Pool</span>
              <span style={{ color: 'var(--green-primary)' }}>3%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">→ Developer</span>
              <span>1%</span>
            </div>
          </div>
        </div>
        
        <div className="p-4 md:p-6 rounded-lg" style={{ background: 'var(--bg-dark)' }}>
          <h4 className="text-sm md:text-base font-bold mb-3 md:mb-4" style={{ color: 'var(--green-primary)' }}>
            Prize Distribution
          </h4>
          <div className="text-xs md:text-sm text-[var(--text-muted)] space-y-2">
            <p>
              When your number wins, the prize is split among all winners 
              based on their token holdings.
            </p>
            <p className="font-mono text-[10px] md:text-xs" style={{ color: 'var(--green-primary)' }}>
              Your Prize = (Your Balance / Total Balance) × Pool
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
