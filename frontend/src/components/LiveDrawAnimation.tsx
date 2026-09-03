import { useEffect, useState } from 'react'

interface Props {
  isVisible: boolean
  result: {
    drawId: number
    winningNumber: number
    winnersCount: number
    prizePool: string
  }
  onClose: () => void
}

export function LiveDrawAnimation({ isVisible, result, onClose }: Props) {
  const [phase, setPhase] = useState<'spinning' | 'reveal' | 'done'>('spinning')
  const [displayNumber, setDisplayNumber] = useState(1)

  useEffect(() => {
    if (!isVisible) {
      setPhase('spinning')
      return
    }

    // 旋转动画
    let count = 0
    const spinInterval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 50) + 1)
      count++
      if (count > 20) {
        clearInterval(spinInterval)
        setPhase('reveal')
        setDisplayNumber(result.winningNumber)
      }
    }, 80)

    // 3秒后自动关闭
    const closeTimeout = setTimeout(() => {
      setPhase('done')
      onClose()
    }, 4000)

    return () => {
      clearInterval(spinInterval)
      clearTimeout(closeTimeout)
    }
  }, [isVisible, result.winningNumber])

  if (!isVisible) return null

  return (
    <div className="draw-animation-overlay" onClick={onClose}>
      <div className="text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-[var(--text-muted)] text-sm uppercase tracking-wider mb-4">
          Draw #{result.drawId}
        </p>
        
        <div className={`draw-ball ${phase === 'reveal' ? '' : 'animate-pulse'}`}>
          {displayNumber}
        </div>
        
        {phase === 'reveal' && (
          <div className="mt-8 animate-fade-in">
            <p className="text-xl mb-2">
              <span style={{ color: 'var(--green-primary)' }}>{result.winnersCount}</span> Winner{result.winnersCount !== 1 ? 's' : ''}
            </p>
            <p className="text-[var(--text-muted)]">
              Prize Pool: <span className="font-bold" style={{ color: 'var(--green-primary)' }}>
                {Number(result.prizePool).toLocaleString()}
              </span> BALLS
            </p>
          </div>
        )}
        
        <p className="mt-8 text-sm text-[var(--text-muted)]">
          Click anywhere to close
        </p>
      </div>
    </div>
  )
}
