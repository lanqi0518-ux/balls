import { useState, useEffect } from 'react'

interface Props {
  prizePool: string
  prizePoolUsd?: string
  ethPriceUsd?: number
  prizePoolWallet?: string
}

export function PrizePool({ prizePool, prizePoolUsd, ethPriceUsd, prizePoolWallet }: Props) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isIncreasing, setIsIncreasing] = useState(false)

  useEffect(() => {
    const targetValue = Number(prizePoolUsd) || 0
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
  }, [prizePoolUsd])

  const ethAmount = Number(prizePool) || 0

  return (
    <div className="prize-pool">
      <div className="prize-label">Current Jackpot</div>
      
      {/* USD Value - Main Display */}
      <div 
        className={`prize-amount transition-transform duration-300 ${isIncreasing ? 'scale-105' : ''}`}
      >
        ${displayValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
      
      {/* ETH Amount */}
      <div className="text-[var(--text-secondary)] text-sm md:text-lg font-semibold mt-1 md:mt-2">
        {ethAmount.toFixed(4)} ETH
      </div>
      
      {/* ETH Price */}
      {ethPriceUsd && ethPriceUsd > 0 && (
        <div className="text-[var(--text-muted)] text-xs mt-1">
          ETH = ${ethPriceUsd.toLocaleString()}
        </div>
      )}
      
      {/* Prize Pool Wallet */}
      {prizePoolWallet && (
        <div className="mt-4 md:mt-6 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[var(--text-muted)] text-[10px] md:text-xs">Prize Pool:</span>
          <a 
            href={`https://robinhoodchain.blockscout.com/address/${prizePoolWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] md:text-xs font-mono hover:underline"
            style={{ color: 'var(--green-primary)' }}
          >
            {prizePoolWallet.slice(0, 8)}...{prizePoolWallet.slice(-6)}
          </a>
        </div>
      )}
      
      {/* Live Indicator */}
      <div className="mt-3 md:mt-4 flex justify-center">
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE
        </div>
      </div>
    </div>
  )
}
