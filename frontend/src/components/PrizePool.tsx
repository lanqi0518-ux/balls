import { memo } from 'react'

interface Props {
  prizePool: string
  prizePoolUsd?: string
  ethPriceUsd?: number
  prizePoolWallet?: string
}

function PrizePoolInner({ prizePool, prizePoolUsd, ethPriceUsd, prizePoolWallet }: Props) {
  const usdAmount = Number(prizePoolUsd) || 0
  const ethAmount = Number(prizePool) || 0

  return (
    <div className="prize-pool">
      <div className="prize-label">Current Jackpot</div>
      
      <div className="prize-amount">
        ${usdAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
      
      <div className="text-[var(--text-secondary)] text-sm md:text-lg font-semibold mt-1 md:mt-2">
        {ethAmount.toFixed(4)} ETH
      </div>
      
      {ethPriceUsd && ethPriceUsd > 0 && (
        <div className="text-[var(--text-muted)] text-xs mt-1">
          ETH = ${ethPriceUsd.toLocaleString()}
        </div>
      )}
      
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
      
      <div className="mt-3 md:mt-4 flex justify-center">
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE
        </div>
      </div>
    </div>
  )
}

export const PrizePool = memo(PrizePoolInner)
