import { decodeErrorResult, isHex } from 'viem'
import { chamberAbi } from './abi.ts'

/**
 * Human-readable Chamber revert copy.
 *
 * Strings match the React app so agents see the same failures TransactionQueue
 * and DelegationManager already surface:
 * - `DelegationManager.getErrorMessage` (`app/src/components/DelegationManager.tsx`)
 * - `TreasuryOverview.getErrorMessage` (`app/src/components/TreasuryOverview.tsx`)
 * - `TransactionQueue` expired / seating toasts
 */
export const CHAMBER_ERROR_MESSAGES = {
  InsufficientChamberBalance: "You don't have enough shares to delegate this amount",
  InsufficientDelegatedAmount: "You haven't delegated this much to this member",
  ZeroTokenId: 'Token ID cannot be zero',
  ZeroAmount: 'Amount cannot be zero',
  InvalidTokenId: 'This member ID does not exist',
  NotDirector: 'You are not a director',
  DirectorNotSeated: 'Your seat is not mature yet',
  ExceedsDelegatedAmount: 'Amount exceeds your delegated balance',
  AssetAmountMismatch: 'Fee-on-transfer or rebasing tokens are not supported',
  EnforcedPause: 'This chamber is paused',
  TransactionExpired: 'This transaction has expired',
  ERC20InsufficientAllowance: 'Token approval required',
  ERC20InsufficientBalance: 'Insufficient token balance',
} as const

export type ChamberErrorName = keyof typeof CHAMBER_ERROR_MESSAGES

/** H-02 seating copy from TransactionQueue when a live seat is not yet mature. */
export const DIRECTOR_SEATING_NOT_MATURE = 'Director seating is not mature yet'

const CUSTOM_ERROR_RE = /reverted with custom error '([^']+)'/
const REASON_STRING_RE = /reverted with reason string '([^']+)'/
const SOLIDITY_ERROR_CALL_RE = /\b([A-Z][A-Za-z0-9_]+)\(\)/
const GENERIC_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'BaseError',
  'CallExecutionError',
  'ContractFunctionExecutionError',
  'ContractFunctionRevertedError',
  'RpcRequestError',
  'TransactionExecutionError',
  'UnknownRpcError',
])

function collectErrorText(error: unknown): string {
  const parts: string[] = []
  const seen = new Set<unknown>()
  const walk = (value: unknown) => {
    if (value == null || seen.has(value)) return
    seen.add(value)
    if (typeof value === 'string') {
      parts.push(value)
      return
    }
    if (typeof value !== 'object') return
    const o = value as {
      name?: unknown
      message?: unknown
      shortMessage?: unknown
      details?: unknown
      metaMessages?: unknown
      data?: unknown
      walk?: (fn?: (err: unknown) => unknown) => unknown
      cause?: unknown
    }
    if (typeof o.walk === 'function') {
      try {
        o.walk((err) => {
          walk(err)
          return undefined
        })
      } catch {
        // ignore walk failures; fall through to fields
      }
    }
    if (typeof o.name === 'string' && !GENERIC_ERROR_NAMES.has(o.name)) parts.push(o.name)
    if (typeof o.shortMessage === 'string') parts.push(o.shortMessage)
    if (typeof o.message === 'string') parts.push(o.message)
    if (typeof o.details === 'string') parts.push(o.details)
    if (Array.isArray(o.metaMessages)) {
      for (const line of o.metaMessages) {
        if (typeof line === 'string') parts.push(line)
      }
    }
    if (typeof o.data === 'string') parts.push(o.data)
    walk(o.cause)
  }
  walk(error)
  return parts.join('\n')
}

function decodeRevertData(error: unknown): string | undefined {
  const seen = new Set<unknown>()
  const walk = (value: unknown): string | undefined => {
    if (value == null || seen.has(value)) return undefined
    seen.add(value)
    if (typeof value === 'string' && isHex(value) && value.length >= 10) {
      try {
        return decodeErrorResult({ abi: chamberAbi, data: value }).errorName
      } catch {
        return undefined
      }
    }
    if (typeof value !== 'object') return undefined
    const o = value as { data?: unknown; cause?: unknown }
    if (typeof o.data === 'string') {
      const named = walk(o.data)
      if (named) return named
    }
    return walk(o.cause)
  }
  return walk(error)
}

function errorNameFromUnknown(error: unknown): string | undefined {
  const seen = new Set<unknown>()
  const walk = (value: unknown): string | undefined => {
    if (value == null || seen.has(value)) return undefined
    seen.add(value)
    if (typeof value !== 'object') return undefined
    const o = value as {
      name?: unknown
      errorName?: unknown
      data?: { errorName?: unknown }
      cause?: unknown
      walk?: (fn?: (err: unknown) => unknown) => unknown
    }
    if (typeof o.errorName === 'string' && o.errorName) return o.errorName
    if (typeof o.data?.errorName === 'string' && o.data.errorName) return o.data.errorName
    if (typeof o.name === 'string' && o.name in CHAMBER_ERROR_MESSAGES) return o.name
    if (typeof o.walk === 'function') {
      let found: string | undefined
      try {
        o.walk((err) => {
          found ??= walk(err)
          return undefined
        })
      } catch {
        // ignore
      }
      if (found) return found
    }
    return walk(o.cause)
  }
  return walk(error)
}

export function formatChamberError(error: unknown, fallback = 'Transaction failed'): string {
  const named = errorNameFromUnknown(error) ?? decodeRevertData(error)
  if (named && named in CHAMBER_ERROR_MESSAGES) {
    return CHAMBER_ERROR_MESSAGES[named as ChamberErrorName]
  }

  const message = collectErrorText(error)
  if (!message) return fallback

  for (const [errorName, friendly] of Object.entries(CHAMBER_ERROR_MESSAGES)) {
    if (message.includes(errorName)) return friendly
  }

  const solidityCall = message.match(SOLIDITY_ERROR_CALL_RE)
  if (solidityCall && solidityCall[1] in CHAMBER_ERROR_MESSAGES) {
    return CHAMBER_ERROR_MESSAGES[solidityCall[1] as ChamberErrorName]
  }

  const revertMatch = message.match(REASON_STRING_RE)
  if (revertMatch) return revertMatch[1]

  const customErrorMatch = message.match(CUSTOM_ERROR_RE)
  if (customErrorMatch) {
    const errorName = customErrorMatch[1]
    return CHAMBER_ERROR_MESSAGES[errorName as ChamberErrorName] ?? errorName
  }

  // Same selector fallbacks as DelegationManager.
  if (message.includes('0x1fed7fc5')) return CHAMBER_ERROR_MESSAGES.InvalidTokenId
  if (message.includes('0xf4844814')) return "You don't have enough shares"

  if (message.includes('insufficient balance')) return 'Insufficient balance'
  if (message.includes('exceeds balance')) return 'Amount exceeds balance'
  if (message.includes('not owner')) return 'You do not own this member token'

  const firstLine =
    message
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !GENERIC_ERROR_NAMES.has(line)) ?? fallback
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine
}

export class ChamberOperatorError extends Error {
  readonly errorName?: string

  constructor(message: string, options?: { cause?: unknown; errorName?: string }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ChamberOperatorError'
    this.errorName = options?.errorName
  }
}

export function wrapChamberError(error: unknown, fallback = 'Transaction failed'): ChamberOperatorError {
  if (error instanceof ChamberOperatorError) return error
  const errorName = errorNameFromUnknown(error)
  return new ChamberOperatorError(formatChamberError(error, fallback), {
    cause: error,
    errorName,
  })
}
