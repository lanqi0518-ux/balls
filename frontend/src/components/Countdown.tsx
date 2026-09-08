import { useState, useEffect, useRef } from 'react'

interface Props {
  /** Seconds until the next draw, as reported by the backend */
  secondsRemaining?: number
  /** Draw interval in seconds, used to keep ticking if updates stop arriving */
  intervalSeconds?: number
}

const DEFAULT_INTERVAL_SECONDS = 60

/**
 * Ticks locally between backend updates and resyncs whenever one arrives.
 * It used to derive the countdown from the wall clock on the assumption that
 * a draw happens at :01 of every minute, which stops being true as soon as
 * DRAW_INTERVAL is changed.
 */
export function Countdown({ secondsRemaining, intervalSeconds }: Props) {
  const interval = intervalSeconds && intervalSeconds > 0 ? intervalSeconds : DEFAULT_INTERVAL_SECONDS
  const base = secondsRemaining ?? interval
  const syncedAt = useRef(Date.now())
  const [timeUntil, setTimeUntil] = useState(base)

  useEffect(() => {
    syncedAt.current = Date.now()
    setTimeUntil(base)
  }, [base])

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - syncedAt.current) / 1000)
      const remaining = base - elapsed

      // Keep counting through the next cycle if updates stop arriving
      const wrapped = remaining > 0 ? remaining : ((remaining % interval) + interval) % interval

      setTimeUntil((prev) => (prev === wrapped ? prev : wrapped))
    }, 1000)

    return () => clearInterval(timer)
  }, [base, interval])

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
