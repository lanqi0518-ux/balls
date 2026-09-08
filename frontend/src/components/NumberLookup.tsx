import { useState, memo } from 'react'
import { useNumberLookup, useUserInfo } from '../hooks/useRealtime'

interface Props {
  topHoldersLimit?: number
}

export const NumberLookup = memo(function NumberLookup({ topHoldersLimit }: Props) {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<{ address: string; number: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { lookupNumber, isLoading } = useNumberLookup()
  const { userInfo } = useUserInfo(result?.address ?? null)

  const handleLookup = async () => {
    setError(null)

    if (!address || address.trim().length < 42) {
      setError('Enter a full 0x… address')
      return
    }

    const number = await lookupNumber(address.trim())
    if (number === null) {
      setError('Could not look that address up')
      return
    }

    setResult({ address: address.trim(), number })
  }

  return (
    <section className="card">
      <header className="section-header">
        <h3>Check Your Number</h3>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="0x…"
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleLookup()
          }}
          className="input flex-1"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={isLoading || !address}
          className="btn btn-primary whitespace-nowrap"
        >
          {isLoading ? 'Checking…' : 'Check'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs" style={{ color: 'var(--red-primary)' }}>
          {error}
        </p>
      )}

      {result && (
        <div
          className="mt-6 rounded-xl border border-[var(--border)] p-4 md:p-5"
          style={{ background: 'rgba(0, 0, 0, 0.25)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                Wallet
              </div>
              <div className="mono text-xs md:text-sm truncate">
                {result.address}
              </div>
            </div>

            <div className="ball ball-lg ball-winning ball-enter">
              {result.number}
            </div>
          </div>

          {userInfo && (
            <div className="mt-5 pt-5 divider-dashed grid grid-cols-4 gap-3">
              <Stat
                label="Holding"
                value={userInfo.isHolder ? 'Yes' : 'No'}
                tone={userInfo.isHolder ? 'green' : 'red'}
              />
              <Stat
                label="Rank"
                value={userInfo.rank ? `#${userInfo.rank}` : '—'}
                tone={
                  userInfo.rank && userInfo.rank <= (topHoldersLimit ?? 100)
                    ? 'green'
                    : 'gold'
                }
              />
              <Stat
                label={`Top ${topHoldersLimit ?? 100}`}
                value={userInfo.isEligible ? 'In' : 'Out'}
                tone={userInfo.isEligible ? 'green' : 'gold'}
              />
              <Stat
                label="Share"
                value={
                  userInfo.isEligible
                    ? `${(userInfo.shareInNumber ?? 0).toFixed(1)}%`
                    : '—'
                }
                tone={userInfo.isEligible ? 'green' : undefined}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
})

function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'green' | 'gold' | 'red'
}) {
  const color =
    tone === 'green'
      ? 'var(--green-primary)'
      : tone === 'gold'
        ? 'var(--gold)'
        : tone === 'red'
          ? 'var(--red-primary)'
          : 'var(--text-primary)'

  return (
    <div className="text-center">
      <div className="text-sm md:text-base font-bold display" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-1">
        {label}
      </div>
    </div>
  )
}
