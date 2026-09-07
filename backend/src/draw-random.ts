import { ethers } from 'ethers';

export const NUMBER_COUNT = 50;

/**
 * Commit-reveal randomness for the off-chain draw.
 *
 * The previous seed was keccak(drawId, current second, snapshot hash,
 * eligible count). Every one of those is public or derivable, so anyone could
 * compute the winning number in advance. Because a holder's number is the
 * deterministic keccak(address) % 50 + 1, an attacker could pre-generate
 * addresses mapping to that number and buy in before the snapshot.
 *
 * Now a secret seed is drawn when the snapshot is frozen and only its hash is
 * published. The seed itself is revealed with the result, so:
 *  - players cannot predict the number, because the seed is secret until the
 *    draw has already happened;
 *  - the operator cannot pick a favourable number after seeing the snapshot,
 *    because the commitment pins the seed down beforehand;
 *  - anyone can recheck a past draw with verifyDraw().
 */
export function createCommitment(): { serverSeed: string; commitment: string } {
  const serverSeed = ethers.hexlify(ethers.randomBytes(32));
  return { serverSeed, commitment: hashSeed(serverSeed) };
}

export function hashSeed(serverSeed: string): string {
  return ethers.keccak256(serverSeed);
}

/**
 * Derive the winning number. Depends only on values published with the draw,
 * so a third party can reproduce it exactly.
 */
export function computeWinningNumber(
  serverSeed: string,
  drawId: number,
  snapshotHash: string
): number {
  const seed = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'uint256', 'bytes32'],
      [serverSeed, drawId, snapshotHash]
    )
  );

  return Number(BigInt(seed) % BigInt(NUMBER_COUNT)) + 1;
}

/**
 * Recheck a published draw: the revealed seed must match the commitment that
 * was announced before the draw, and must reproduce the winning number.
 */
export function verifyDraw(params: {
  serverSeed: string;
  commitment: string;
  drawId: number;
  snapshotHash: string;
  winningNumber: number;
}): boolean {
  if (hashSeed(params.serverSeed) !== params.commitment) return false;

  return (
    computeWinningNumber(params.serverSeed, params.drawId, params.snapshotHash) ===
    params.winningNumber
  );
}
