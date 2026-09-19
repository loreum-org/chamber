import { isNonZeroAddress } from './address'

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

export const SESSION_EXPIRY_PRESETS = [7, 30, 90] as const

/** Exclusive-after unix bound accepted by `setDirectorOperator` (`uint64`). */
export const SESSION_EXPIRY_MAX = (1n << 64n) - 1n

export const SESSION_SCOPE_BITS = [
  {
    bit: SESSION_SCOPE_SUBMIT,
    id: 'submit',
    label: 'Submit',
    detail: 'Submit transactions (including batch and metadata). Not delayed by liveAt.',
  },
  {
    bit: SESSION_SCOPE_CONFIRM,
    id: 'confirm',
    label: 'Confirm',
    detail: 'Confirm transactions (including batch). Delayed until liveAt.',
  },
  {
    bit: SESSION_SCOPE_EXECUTE,
    id: 'execute',
    label: 'Execute',
    detail: 'Execute transactions (including batch). Delayed until liveAt.',
  },
  {
    bit: SESSION_SCOPE_UPDATE_SEATS,
    id: 'update-seats',
    label: 'Update seats',
    detail: 'updateSeats / cancelSeatUpdate now; executeSeatsUpdate waits for liveAt.',
  },
  {
    bit: SESSION_SCOPE_REVOKE,
    id: 'revoke',
    label: 'Revoke',
    detail: 'revokeConfirmation. Not delayed by liveAt.',
  },
  {
    bit: SESSION_SCOPE_CANCEL,
    id: 'cancel',
    label: 'Cancel',
    detail: 'cancelTransaction. Not delayed by liveAt.',
  },
] as const

export type SessionScopeBitId = (typeof SESSION_SCOPE_BITS)[number]['id']

export type DirectorSessionStatus = 'none' | 'active' | 'delayed' | 'expired' | 'stale'

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
  const labels = SESSION_SCOPE_BITS.filter(({ bit }) => (scope & bit) !== 0).map(({ label }) => label)
  return labels.length > 0 ? labels.join(', ') : `custom 0x${scope.toString(16)}`
}

export function scopeFromSelectedBits(selected: ReadonlySet<SessionScopeBitId>, unscoped: boolean): number {
  if (unscoped) return SESSION_SCOPE_UNSCOPED
  return SESSION_SCOPE_BITS.reduce((mask, { bit, id }) => (selected.has(id) ? mask | bit : mask), 0)
}

export function selectedBitsFromScope(scope: number): Set<SessionScopeBitId> {
  if (isUnscopedSession(scope) || scope === 0) return new Set()
  return new Set(SESSION_SCOPE_BITS.filter(({ bit }) => (scope & bit) !== 0).map(({ id }) => id))
}

export function expiryUnixFromDays(days: number, nowMs = Date.now()): bigint {
  return BigInt(Math.floor(nowMs / 1000) + days * 24 * 60 * 60)
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
  if (isNonZeroAddress(args.liveOperator)) {
    const liveAt = args.liveAt ?? 0n
    if (args.blockNumber === undefined) return liveAt === 0n ? 'active' : 'delayed'
    return args.blockNumber >= liveAt ? 'active' : 'delayed'
  }

  if (!isNonZeroAddress(args.rawOperator)) return 'none'

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

