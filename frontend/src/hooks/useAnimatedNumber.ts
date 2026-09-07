import { useEffect, useRef, useState } from 'react'

interface Options {
  /**
   * How long (ms) to interpolate on an upward change. Defaults to 10 000 —
   * matches the backend's 10 s status broadcast cadence so the counter is
   * always mid-flight when the next update arrives, producing continuous
   * motion instead of stepped increments.
   */
  duration?: number
  /**
   * When true (default), a lower `target` snaps to the new value instead of
   * animating downward. Draws reset the prize pool, and ticking down would
   * look like a bug.
   */
  snapOnDecrease?: boolean
}

/**
 * Smoothly interpolates the displayed number toward `target` between backend
 * updates. Used for the jackpot so it feels alive between 10-second pushes
 * from the SSE stream, instead of jumping in chunks.
 *
 * Rules:
 * - First non-zero value snaps in (no animation from 0).
 * - A drop (draw reset) snaps.
 * - `prefers-reduced-motion` snaps.
 * - Otherwise linear-interpolate over `duration` ms.
 */
export function useAnimatedNumber(
  target: number,
  { duration = 10_000, snapOnDecrease = true }: Options = {},
): number {
  const [display, setDisplay] = useState(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const cancel = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const dropped = snapOnDecrease && target < display
    // Snap the first meaningful value in so the page-load flip from
    // the 0 fallback to the real pool isn't a 10-second countdown.
    const startFromZero = display === 0 && target !== 0
    const noChange = target === display

    if (reduced || dropped || startFromZero || noChange) {
      cancel()
      setDisplay(target)
      return cancel
    }

    const from = display
    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now()

    const tick = (now: number) => {
      const elapsed = now - startedAt
      const t = elapsed >= duration ? 1 : elapsed / duration
      // Linear on purpose: because the next SSE update will pick up right
      // where this frame left off, an ease-out would visibly stutter at
      // each 10 s boundary.
      const next = from + (target - from) * t
      setDisplay(next)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return cancel
    // display is intentionally read fresh in the effect body and left out of
    // deps; including it would cancel/restart the animation every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, snapOnDecrease])

  return display
}
