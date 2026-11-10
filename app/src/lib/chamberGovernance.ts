/**
 * Chamber governance constants and helpers aligned with landed remediations.
 * Seat timings are not public ABI constants (H-03 keeps them `internal`),
 * so they live together here to avoid drift.
 */

/** `pause()` — L-02 / OZ Pausable */
export const PAUSE_SELECTOR = '0x8456cb59' as const
/** `unpause()` — L-02 / OZ Pausable */
export const UNPAUSE_SELECTOR = '0x3f4ba83a' as const

/** `BoardTypes.SEATING_DELAY` (internal, 2 days since 1.4.0; R-1110-C1). Do not change without the on-chain constant. */
export const SEATING_DELAY_SEC = 2n * 24n * 60n * 60n
/** H-03 `SEAT_UPDATE_TIMELOCK` (internal, 7 days) */
export const SEAT_UPDATE_TIMELOCK_SEC = 7n * 24n * 60n * 60n
/** H-03 `SEAT_UPDATE_EXPIRY` (internal, 14 days) */
export const SEAT_UPDATE_EXPIRY_SEC = 14n * 24n * 60n * 60n
/** M-06 `WalletTypes.DEFAULT_TRANSACTION_MAX_AGE` (internal, 30 days) */
export const DEFAULT_TRANSACTION_MAX_AGE_SEC = 30 * 24 * 60 * 60

/** Amber when remaining time is under 1 hour or the last 10% of the default max age. */
export function isProposalDeadlineUrgent(
  remainingSec: number,
  maxAgeSec = DEFAULT_TRANSACTION_MAX_AGE_SEC,
): boolean {
  if (remainingSec <= 0) return false
  return remainingSec < 60 * 60 || remainingSec < maxAgeSec * 0.1
}

/** L-01 `Registry.MAX_PAGE_SIZE` */
export const REGISTRY_PAGE_SIZE = 256n

export function isChamberSelfCall(chamberAddress: `0x${string}`, target: string): boolean {
  return target.toLowerCase() === chamberAddress.toLowerCase()
}

export function selectorOf(data: `0x${string}` | string): string {
  const hex = data.startsWith('0x') ? data : `0x${data}`
  return hex.slice(0, 10).toLowerCase()
}

/**
 * Self-calls the app will queue: pause and unpause. Upgrades are not self-calls; they go to the
 * chamber's ProxyAdmin (`lib/chamberUpgrade`). Chamber 1.3.0 also rejects any other self-call.
 */
export function isAllowedChamberSelfCall(
  chamberAddress: `0x${string}`,
  target: string,
  data: `0x${string}`,
): boolean {
  if (!isChamberSelfCall(chamberAddress, target)) return true
  const selector = selectorOf(data)
  return (
    selector === PAUSE_SELECTOR ||
    selector === UNPAUSE_SELECTOR
  )
}

export function isUnpauseCall(chamberAddress: `0x${string}`, target: string, data: `0x${string}`): boolean {
  return isChamberSelfCall(chamberAddress, target) && selectorOf(data) === UNPAUSE_SELECTOR
}

/** M-04 execute bar: max(submit snapshot, live quorum). Snapshot 0 = legacy / unset. */
export function requiredExecuteConfirmations(
  snapshotQuorum: number | undefined,
  liveQuorum: number,
): number {
  const snapshot = snapshotQuorum && snapshotQuorum > 0 ? snapshotQuorum : 0
  return Math.max(snapshot, liveQuorum)
}

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

/** Human text for when a pending seat can act: "on <date, time>" (1.4.0+) or "at block N". */
export function formatSeatUnlock(seatedAt: bigint | undefined): string {
  if (seatedAt === undefined) return 'soon'
  if (seatedAtIsTime(seatedAt)) return `on ${new Date(Number(seatedAt) * 1000).toLocaleString()}`
  return `at block ${seatedAt.toString()}`
}

/** True when `seatedAt` is a unix time (Chamber 1.4.0+), false when it is a pre-1.4.0 block number. */
export function seatedAtIsTime(seatedAt: bigint | undefined): boolean {
  return seatedAt !== undefined && seatedAt >= SEATED_AT_TIME_FLOOR
}

export type QueueTxStatus = 'pending' | 'ready' | 'executed' | 'cancelled' | 'expired'

export function computeQueueTxStatus(args: {
  executed: boolean
  cancelled: boolean
  expired: boolean
  liveConfirmations: number
  requiredConfirmations: number
}): QueueTxStatus {
  if (args.cancelled) return 'cancelled'
  if (args.executed) return 'executed'
  if (args.expired) return 'expired'
  if (args.liveConfirmations >= args.requiredConfirmations) return 'ready'
  return 'pending'
}
