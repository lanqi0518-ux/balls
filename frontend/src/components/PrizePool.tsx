import { memo, type ReactNode } from 'react'

interface Props {
  prizePool: string
  prizePoolUsd?: string
  ethPriceUsd?: number
  prizePoolWallet?: string
  children?: ReactNode
}

function PrizePoolInner({
  prizePool,
  prizePoolUsd,
  ethPriceUsd,
  prizePoolWallet,
  children,
}: Props) {
  const usdAmount = Number(prizePoolUsd) || 0
  const ethAmount = Number(prizePool) || 0

  // Powerball prints the jackpot as a whole number of dollars — mirror that.
  const usdDisplay = usdAmount >= 1
    ? `$${Math.round(usdAmount).toLocaleString()}`
    : `$${usdAmount.toFixed(2)}`

  return (
    <section className="jackpot-hero">
      <div className="jackpot-label">Estimated Jackpot</div>

      <h2 className="jackpot-amount">{usdDisplay}</h2>

      <div className="jackpot-subamount">
        <span className="text-gold display">{ethAmount.toFixed(4)}</span> ETH
      </div>

      {ethPriceUsd && ethPriceUsd > 0 && (
        <div className="jackpot-eth-price">
          Cash value at ETH ${ethPriceUsd.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
        </div>
      )}

      <div className="jackpot-meta">
        <span className="jackpot-chip">
          <span className="live-dot" />
          LIVE POOL
        </span>

        {prizePoolWallet && (
          <span className="jackpot-chip">
            Wallet
            <a
              href={`https://robinhoodchain.blockscout.com/address/${prizePoolWallet}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {prizePoolWallet.slice(0, 6)}…{prizePoolWallet.slice(-4)}
            </a>
          </span>
        )}
      </div>

      {children && <div className="mt-8">{children}</div>}
    </section>
  )
}

export const PrizePool = memo(PrizePoolInner)
