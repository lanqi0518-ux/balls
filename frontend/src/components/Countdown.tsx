import { useState, useEffect } from 'react'

function getTimeUntilNextDraw(): number {
  const seconds = new Date().getSeconds()
  if (seconds === 0) return 1
  if (seconds >= 1) return 61 - seconds
  return 1
}

export function Countdown() {
  const [timeUntil, setTimeUntil] = useState(getTimeUntilNextDraw)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUntil((prev) => {
        const next = getTimeUntilNextDraw()
        return next === prev ? prev : next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const urgent = timeUntil <= 10
  const minutes = Math.floor(timeUntil / 60)
  const seconds = timeUntil % 60
  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')

  return (
    <div className={`countdown ${urgent ? 'countdown-urgent' : ''}`}>
      <div className="countdown-digit">{mm[0]}</div>
      <div className="countdown-digit">{mm[1]}</div>
      <span className="countdown-separator">:</span>
      <div className="countdown-digit">{ss[0]}</div>
      <div className="countdown-digit">{ss[1]}</div>
    </div>
  )
}
