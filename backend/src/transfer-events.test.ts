import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HolderTracker } from './holder-tracker.js';

const SENDER = '0x1111111111111111111111111111111111111111';
const RECEIVER = '0x2222222222222222222222222222222222222222';

describe('transfer event handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies events in order when balance lookups resolve out of order', async () => {
    // Regression: the listener kicked off balanceOf for every event without
    // waiting, so a slow reply for an earlier transfer could land after a
    // later one and write a stale balance back into the holder map.
    const tracker = new HolderTracker();
    const internal = tracker as any;

    // Two buys in a row: 100 then 300. The first lookup answers slowly.
    const replies: Array<{ balance: bigint; delayMs: number }> = [
      { balance: 100n * 10n ** 18n, delayMs: 30 },
      { balance: 300n * 10n ** 18n, delayMs: 0 },
    ];
    let lookups = 0;

    internal.tokenContract = {
      balanceOf: async (address: string) => {
        if (address.toLowerCase() !== RECEIVER) return 0n;
        const reply = replies[Math.min(lookups++, replies.length - 1)];
        await new Promise(resolve => setTimeout(resolve, reply.delayMs));
        return reply.balance;
      },
    };

    const first = internal.enqueueTransfer(SENDER, RECEIVER, 100n * 10n ** 18n);
    const second = internal.enqueueTransfer(SENDER, RECEIVER, 200n * 10n ** 18n);
    await Promise.all([first, second]);

    expect(internal.holders.get(RECEIVER).balance).toBe(300n * 10n ** 18n);
  });

  it('keeps processing after one event throws', async () => {
    const tracker = new HolderTracker();
    const internal = tracker as any;

    let lookups = 0;
    internal.tokenContract = {
      balanceOf: async (address: string) => {
        if (address.toLowerCase() !== RECEIVER) return 0n;
        lookups++;
        if (lookups === 1) throw new Error('RPC exploded');
        return 42n * 10n ** 18n;
      },
    };

    await internal.enqueueTransfer(SENDER, RECEIVER, 1n);
    await internal.enqueueTransfer(SENDER, RECEIVER, 1n);

    expect(internal.holders.get(RECEIVER).balance).toBe(42n * 10n ** 18n);
  });
});
