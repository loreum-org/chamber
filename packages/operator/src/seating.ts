/**
 * Seating is mature once `seatedAt` has passed. `seatedAt == 0` is the on-chain grandfather
 * for pre-upgrade incumbents (`Board._isSeatingMature`), so those seats are mature.
 * Chamber 1.4.0+ stores a unix time (2-day `SEATING_DELAY`, R-1110-C1); older chambers stored
 * a block number. Values below {@link SEATED_AT_TIME_FLOOR} are read as block numbers.
 */
export function isSeatingMature(
  seatedAt: bigint | undefined,
  blockNumber: bigint | undefined,
  nowSec: bigint = BigInt(Math.floor(Date.now() / 1000)),
): boolean {
  if (seatedAt === undefined) return false
  if (seatedAt === 0n) return true
  if (seatedAt >= SEATED_AT_TIME_FLOOR) return nowSec >= seatedAt
  if (blockNumber === undefined) return false
  return blockNumber >= seatedAt
}

/** `seatedAt` at or above this is a unix time (1.4.0+), below it a block number (before 1.4.0). */
export const SEATED_AT_TIME_FLOOR = 1_000_000_000n

/** True when `seatedAt` is a unix time (Chamber 1.4.0+), false when it is a pre-1.4.0 block number. */
export function seatedAtIsTime(seatedAt: bigint | undefined): boolean {
  return seatedAt !== undefined && seatedAt >= SEATED_AT_TIME_FLOOR
}
