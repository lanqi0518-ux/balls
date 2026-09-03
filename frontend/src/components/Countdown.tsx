interface Props {
  timeUntil: number
  isUrgent: boolean
}

export function Countdown({ timeUntil, isUrgent }: Props) {
  const minutes = Math.floor(timeUntil / 60)
  const seconds = timeUntil % 60
  
  const formatDigit = (n: number) => n.toString().padStart(2, '0')

  return (
    <div className={`countdown ${isUrgent ? 'countdown-urgent' : ''}`}>
      <div className="countdown-digit">{formatDigit(minutes)[0]}</div>
      <div className="countdown-digit">{formatDigit(minutes)[1]}</div>
      <span className="countdown-separator">:</span>
      <div className="countdown-digit">{formatDigit(seconds)[0]}</div>
      <div className="countdown-digit">{formatDigit(seconds)[1]}</div>
    </div>
  )
}
