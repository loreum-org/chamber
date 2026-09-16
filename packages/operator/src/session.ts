/**
 * PMN-M04 session-key constants and readers.
 * Matches Chamber.sol / IChamber — not a second protocol.
 */

/** Matches `Chamber.SESSION_SCOPE_SUBMIT` (`1 << 0`). */
export const SESSION_SCOPE_SUBMIT = 1 << 0
/** Matches `Chamber.SESSION_SCOPE_CONFIRM` (`1 << 1`). */
export const SESSION_SCOPE_CONFIRM = 1 << 1
/** Matches `Chamber.SESSION_SCOPE_EXECUTE` (`1 << 2`). */
export const SESSION_SCOPE_EXECUTE = 1 << 2
/** Matches `Chamber.SESSION_SCOPE_UPDATE_SEATS` (`1 << 3`). */
export const SESSION_SCOPE_UPDATE_SEATS = 1 << 3
/** Matches `Chamber.SESSION_SCOPE_REVOKE` (`1 << 4`). */
export const SESSION_SCOPE_REVOKE = 1 << 4
/** Matches `Chamber.SESSION_SCOPE_CANCEL` (`1 << 5`). */
export const SESSION_SCOPE_CANCEL = 1 << 5
/** Matches `Chamber.SESSION_SCOPE_UNSCOPED` (`type(uint32).max`). Scope `0` is rejected. */
export const SESSION_SCOPE_UNSCOPED = 0xffff_ffff

/** Default set expiry: 30 days from now. Protocol rejects `expiry == 0` (not a no-expiry sentinel). */
export const DEFAULT_SESSION_EXPIRY_DAYS = 30

/** Exclusive-after unix bound accepted by `setDirectorOperator` (`uint64`). */
export const SESSION_EXPIRY_MAX = (1n << 64n) - 1n

export type DirectorSessionStatus = 'none' | 'active' | 'delayed' | 'expired' | 'stale'

export type DirectorSessionRaw = {
  sessionOwner: `0x${string}`
  operator: `0x${string}`
  expiry: bigint
  scope: number
  liveAt: bigint
}

export type DirectorOperatorSnapshot = {
  tokenId: bigint
  operator: `0x${string}`
  expiry: bigint
  scope: number
  liveAt: bigint
  status: DirectorSessionStatus
  blockNumber: bigint
  raw: DirectorSessionRaw
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function isZeroAddress(value: string | undefined): boolean {
  return !value || value.toLowerCase() === ZERO_ADDRESS
}

export function asUint32(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0
  if (typeof value === 'bigint') return Number(value & 0xffff_ffffn)
  return 0
}

export function isUnscopedSession(scope: number): boolean {
  return scope === SESSION_SCOPE_UNSCOPED
}

export function describeSessionScope(scope: number): string {
  if (scope === 0) return 'none'
  if (isUnscopedSession(scope)) return 'unscoped (all actions)'
  const labels: string[] = []
  if ((scope & SESSION_SCOPE_SUBMIT) !== 0) labels.push('submit')
  if ((scope & SESSION_SCOPE_CONFIRM) !== 0) labels.push('confirm')
  if ((scope & SESSION_SCOPE_EXECUTE) !== 0) labels.push('execute')
  if ((scope & SESSION_SCOPE_UPDATE_SEATS) !== 0) labels.push('update-seats')
  if ((scope & SESSION_SCOPE_REVOKE) !== 0) labels.push('revoke')
  if ((scope & SESSION_SCOPE_CANCEL) !== 0) labels.push('cancel')
  return labels.length > 0 ? labels.join(', ') : `custom 0x${scope.toString(16)}`
}

export function defaultSessionExpiry(nowMs = Date.now()): bigint {
  return BigInt(Math.floor(nowMs / 1000) + DEFAULT_SESSION_EXPIRY_DAYS * 24 * 60 * 60)
}

export function isValidSessionExpiry(expiry: bigint, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return expiry > 0n && expiry <= SESSION_EXPIRY_MAX && expiry > BigInt(nowSec)
}

export function directorSessionStatus(args: {
  liveOperator: `0x${string}` | undefined
  rawOperator: `0x${string}` | undefined
  rawExpiry: bigint | undefined
  liveAt: bigint | undefined
  blockNumber: bigint | undefined
  nowSec?: number
}): DirectorSessionStatus {
  if (!isZeroAddress(args.liveOperator)) {
    const liveAt = args.liveAt ?? 0n
    if (args.blockNumber === undefined) return liveAt === 0n ? 'active' : 'delayed'
    return args.blockNumber >= liveAt ? 'active' : 'delayed'
  }

  if (isZeroAddress(args.rawOperator)) return 'none'

  const expiry = args.rawExpiry ?? 0n
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000)
  if (expiry === 0n || BigInt(nowSec) > expiry) return 'expired'
  return 'stale'
}

export function directorSessionStatusLabel(
  status: DirectorSessionStatus,
  liveAt?: bigint,
  blockNumber?: bigint,
): string {
  switch (status) {
    case 'none':
      return 'No session key'
    case 'active':
      return 'Active — confirm/execute unlocked'
    case 'delayed':
      return liveAt !== undefined
        ? `Confirm/execute delayed until block ${liveAt.toString()}${
            blockNumber !== undefined ? ` (now ${blockNumber.toString()})` : ''
          }`
        : 'Confirm/execute delayed until liveAt'
    case 'expired':
      return 'Expired'
    case 'stale':
      return 'Stale (not live — owner changed or EOA-owned)'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
