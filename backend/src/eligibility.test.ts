import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HolderTracker } from './holder-tracker.js';
import { config, getEligibilityWindowMs, validateConfig } from './config.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';

function trackerWithHolder(heldForSeconds: number): HolderTracker {
  const tracker = new HolderTracker();
  const holders = (tracker as any).holders as Map<string, any>;
  const now = Math.floor(Date.now() / 1000);

  holders.set(ADDRESS, {
    balance: 1_000n * 10n ** 18n,
    firstSeen: now - heldForSeconds,
    number: tracker.getNumber(ADDRESS),
    lastUpdated: now,
  });

  return tracker;
}

describe('holder eligibility', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts a holder that has cleared the holding requirement', () => {
    const tracker = trackerWithHolder(config.minHoldingDuration);
    expect(tracker.getEligibleHolders()).toHaveLength(1);
  });

  it('rejects a holder that bought too recently', () => {
    const tracker = trackerWithHolder(config.minHoldingDuration - 1);
    expect(tracker.getEligibleHolders()).toHaveLength(0);
  });

  it('keeps a long-term holder eligible instead of restarting their clock', () => {
    // Regression: the draw loop used to reset every firstSeen timestamp once a
    // draw finished. The next snapshot is taken less than minHoldingDuration
    // later, so after the first draw no address could ever clear the holding
    // requirement again and every subsequent draw rolled over forever.
    const tracker = trackerWithHolder(config.minHoldingDuration * 5);
    expect(tracker.getEligibleHolders()).toHaveLength(1);

    // The reset helper must stay gone; re-adding it reintroduces the deadlock.
    expect((tracker as any).resetAllFirstSeen).toBeUndefined();

    const holder = (tracker as any).holders.get(ADDRESS);
    const firstSeenBefore = holder.firstSeen;

    // Simulate the snapshot for the following draw.
    vi.setSystemTime(Date.now() + getEligibilityWindowMs());

    expect(holder.firstSeen).toBe(firstSeenBefore);
    expect(tracker.getEligibleHolders()).toHaveLength(1);
  });

  it('reports holders past the holding time separately from the top-N cap', () => {
    const tracker = new HolderTracker();
    const holders = (tracker as any).holders as Map<string, any>;
    const now = Math.floor(Date.now() / 1000);
    const total = config.topHoldersLimit + 5;

    for (let i = 1; i <= total; i++) {
      const addr = '0x' + i.toString(16).padStart(40, '0');
      holders.set(addr, {
        balance: BigInt(i) * 10n ** 18n,
        firstSeen: now - config.minHoldingDuration,
        number: tracker.getNumber(addr),
        lastUpdated: now,
      });
    }

    const stats = tracker.getStats();
    expect(stats.holdersWithTime).toBe(total);
    expect(stats.eligibleHolders).toBe(config.topHoldersLimit);
  });
});

describe('schedule configuration', () => {
  const original = {
    minHoldingDuration: config.minHoldingDuration,
    drawInterval: config.drawInterval,
    snapshotLeadTime: config.snapshotLeadTime,
  };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(config, original);
    vi.restoreAllMocks();
  });

  it('accepts a holding requirement that fits inside the eligibility window', () => {
    expect(() => validateConfig()).not.toThrow();
  });

  it('rejects a snapshot lead that does not fit inside the draw interval', () => {
    config.snapshotLeadTime = config.drawInterval;
    expect(() => validateConfig()).toThrow(/must be shorter than/);
  });

  it('rejects a zero holding requirement that would allow snapshot sniping', () => {
    config.minHoldingDuration = 0;
    expect(() => validateConfig()).toThrow(/must be positive/);
  });

  it('sizes the default buyer window to fit the default holding requirement', () => {
    // Regression: the default schedule used to leave only 50s between one
    // snapshot being frozen and the next one being taken, while the holding
    // requirement was 60s. Every fresh buyer therefore had to sit out one
    // round before qualifying. Keep them aligned so a buyer arriving right
    // after a draw has exactly one holding period to clear before the next
    // snapshot.
    expect(getEligibilityWindowMs()).toBeGreaterThanOrEqual(
      config.minHoldingDuration * 1000
    );
  });
});
