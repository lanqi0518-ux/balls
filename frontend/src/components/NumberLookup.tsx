import { useState } from 'react'
import { useNumberLookup, useUserInfo } from '../hooks/useRealtime'

export function NumberLookup() {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<{address: string; number: number} | null>(null)
  const { lookupNumber, isLoading } = useNumberLookup()
  const { userInfo } = useUserInfo(result?.address || null)

  const handleLookup = async () => {
    if (!address || address.length < 42) return
    
    const number = await lookupNumber(address)
    if (number !== null) {
      setResult({ address, number })
    }
  }

  return (
    <div className="card">
      <h3 className="text-sm text-[var(--text-muted)] uppercase tracking-wider mb-6">
        Check Your Number
      </h3>
      
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Enter wallet address 0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLookup()}
          className="input flex-1"
        />
        <button
          onClick={handleLookup}
          disabled={isLoading || !address}
          className="btn btn-primary"
        >
          {isLoading ? '...' : 'Check'}
        </button>
      </div>
      
      {result && (
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--bg-dark)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Wallet</div>
              <div className="font-mono text-sm">
                {result.address.slice(0, 10)}...{result.address.slice(-8)}
              </div>
            </div>
            
            <div className="ball ball-winning">
              {result.number}
            </div>
          </div>
          
          {userInfo && (
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`font-bold ${userInfo.isHolder ? 'text-[var(--green-primary)]' : 'text-[var(--red)]'}`}>
                  {userInfo.isHolder ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Holding</div>
              </div>
              <div>
                <div className={`font-bold ${userInfo.isEligible ? 'text-[var(--green-primary)]' : 'text-[var(--yellow)]'}`}>
                  {userInfo.isEligible ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Eligible</div>
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--green-primary)' }}>
                  {userInfo.shareInNumber?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-[var(--text-muted)]">Share</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
