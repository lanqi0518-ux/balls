import { useState, useEffect } from 'react'

interface Props {
  prizePool: string
  prizePoolWallet?: string
}

export function PrizePool({ prizePool, prizePoolWallet }: Props) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isIncreasing, setIsIncreasing] = useState(false)

  useEffect(() => {
    const targetValue = Number(prizePool) || 0
    const currentValue = displayValue
    
    if (targetValue > currentValue) {
      setIsIncreasing(true)
      setTimeout(() => setIsIncreasing(false), 1000)
    }
    
    const duration = 800
    const steps = 20
    const increment = (targetValue - currentValue) / steps
    let step = 0
    
    const timer = setInterval(() => {
      step++
      if (step >= steps) {
        setDisplayValue(targetValue)
        clearInterval(timer)
      } else {
        setDisplayValue(prev => prev + increment)
      }
    }, duration / steps)
    
    return () => clearInterval(timer)
  }, [prizePool])

  return (
    <div className="prize-pool">
      <div className="prize-label">Current Jackpot</div>
      
      <div 
        className={`prize-amount transition-transform duration-300 ${isIncreasing ? 'scale-105' : ''}`}
      >
        {displayValue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      </div>
      
      <div className="text-[var(--text-muted)] text-lg font-semibold mt-2">
        BALLS
      </div>
      
      {/* 奖池钱包 */}
      {prizePoolWallet && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="text-[var(--text-muted)] text-xs">Prize Pool:</span>
          <a 
            href={`https://explorer.robinhoodchain.com/address/${prizePoolWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono hover:underline"
            style={{ color: 'var(--green-primary)' }}
          >
            {prizePoolWallet.slice(0, 10)}...{prizePoolWallet.slice(-8)}
          </a>
        </div>
      )}
      
      {/* 实时指示器 */}
      <div className="mt-4 flex justify-center">
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE
        </div>
      </div>
    </div>
  )
}
