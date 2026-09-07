import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  createCommitment,
  computeWinningNumber,
  hashSeed,
  verifyDraw,
  NUMBER_COUNT,
} from './draw-random.js';

const SNAPSHOT_HASH = ethers.keccak256(ethers.toUtf8Bytes('snapshot'));

describe('draw randomness', () => {
  it('always lands in 1..50', () => {
    for (let drawId = 1; drawId <= 200; drawId++) {
      const { serverSeed } = createCommitment();
      const number = computeWinningNumber(serverSeed, drawId, SNAPSHOT_HASH);
      expect(number).toBeGreaterThanOrEqual(1);
      expect(number).toBeLessThanOrEqual(NUMBER_COUNT);
    }
  });

  it('is reproducible from the published values', () => {
    const { serverSeed } = createCommitment();
    const first = computeWinningNumber(serverSeed, 7, SNAPSHOT_HASH);
    const second = computeWinningNumber(serverSeed, 7, SNAPSHOT_HASH);
    expect(first).toBe(second);
  });

  it('gives a different result for a different draw', () => {
    const { serverSeed } = createCommitment();
    const numbers = new Set<number>();
    for (let drawId = 1; drawId <= 100; drawId++) {
      numbers.add(computeWinningNumber(serverSeed, drawId, SNAPSHOT_HASH));
    }
    // A seed that ignored drawId would collapse to a single value
    expect(numbers.size).toBeGreaterThan(1);
  });

  it('issues a fresh seed each time', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seeds.add(createCommitment().serverSeed);
    }
    expect(seeds.size).toBe(50);
  });

  it('accepts a draw whose revealed seed matches the commitment', () => {
    const { serverSeed, commitment } = createCommitment();
    const winningNumber = computeWinningNumber(serverSeed, 3, SNAPSHOT_HASH);

    expect(
      verifyDraw({ serverSeed, commitment, drawId: 3, snapshotHash: SNAPSHOT_HASH, winningNumber })
    ).toBe(true);
  });

  it('rejects a seed swapped after the commitment was published', () => {
    // The point of committing first: the operator cannot look at the snapshot,
    // pick a number that suits them, and back-fill a seed for it.
    const { commitment } = createCommitment();
    const substituted = createCommitment().serverSeed;
    const winningNumber = computeWinningNumber(substituted, 3, SNAPSHOT_HASH);

    expect(
      verifyDraw({
        serverSeed: substituted,
        commitment,
        drawId: 3,
        snapshotHash: SNAPSHOT_HASH,
        winningNumber,
      })
    ).toBe(false);
  });

  it('rejects a winning number that the seed does not produce', () => {
    const { serverSeed, commitment } = createCommitment();
    const actual = computeWinningNumber(serverSeed, 3, SNAPSHOT_HASH);
    const tampered = (actual % NUMBER_COUNT) + 1;

    expect(
      verifyDraw({
        serverSeed,
        commitment,
        drawId: 3,
        snapshotHash: SNAPSHOT_HASH,
        winningNumber: tampered,
      })
    ).toBe(false);
  });

  it('commits to the seed with a plain hash anyone can recompute', () => {
    const { serverSeed, commitment } = createCommitment();
    expect(commitment).toBe(ethers.keccak256(serverSeed));
    expect(hashSeed(serverSeed)).toBe(commitment);
  });
});
