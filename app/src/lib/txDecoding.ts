/**
 * Human-readable decoding of Chamber proposal calldata (#260).
 *
 * Ordinary transactions only commit keccak256(calldata) onchain, so decoding
 * runs on the resolved preimage (see resolveProposalCalldata) or on plain ETH
 * sends. Common patterns (ERC-20 transfer/transferFrom/approve, ETH sends,
 * chamber upgrade/pause) decode without any token ABI — the argument layout is
 * canonical — so decode coverage does not depend on token verification.
 */

import {
  decodeErrorResult,
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { chamberAbi } from '@/contracts/abis'

export type TxTransferIntent =
  | { kind: 'eth'; recipient: Address; amountRaw: bigint }
  | {
      kind: 'erc20'
      token: Address
      mode: 'transfer' | 'transferFrom' | 'approve'
      from?: Address
      to?: Address
      spender?: Address
      amountRaw: bigint
    }
  | null

export type DecodedTransaction = {
  functionName: string
  /** Plain-English summary that does not embed the counterparty (rendered separately). */
  summary: string
  /** Address the action transfers to / approves / upgrades — rendered as ENS/label. */
  counterparty?: Address
  counterpartyRole?:
    | 'recipient'
    | 'sender'
    | 'spender'
    | 'implementation'
    | 'target'
  intent: TxTransferIntent
  /** True when the proposal calls the Chamber itself (upgrade / pause / unpause). */
  isChamberSelfCall: boolean
}

const CHAMBER_SELF_CALL_ABI = parseAbi([
  'function upgradeImplementation(address newImplementation, bytes data)',
  'function pause()',
  'function unpause()',
])

const STANDARD_ERROR_ABI = parseAbi([
  'error Error(string)',
  'error Panic(uint256)',
])

function isAddress_(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function shortHex(value: string): string {
  if (value.length < 14) return value
  return `${value.slice(0, 8)}…${value.slice(-6)}`
}

function formatRawAmount(amountRaw: bigint): string {
  const formatted = formatUnits(amountRaw, 18)
  const [whole, frac = ''] = formatted.split('.')
  if (whole !== '0') return `${whole}${frac ? `.${frac.replace(/0+$/, '')}` : ''}`
  const trimmed = frac.replace(/0+$/, '')
  if (!trimmed) return '0'
  if (frac.indexOf(trimmed) >= 6) return amountRaw.toString()
  return `0.${trimmed}`
}

/**
 * Decode a proposal's calldata into a director-facing structure. Works from
 * the canonical ERC-20 signatures alone, then the chamber ABI, then falls back
 * to the selector.
 */
export function decodeTransactionAction(params: {
  target: Address
  value: bigint
  calldata?: string | null
  functionNameHint?: string
}): DecodedTransaction | null {
  const { target, value, functionNameHint } = params
  const hex =
    params.calldata && params.calldata !== '0x'
      ? ((params.calldata.startsWith('0x') ? params.calldata : `0x${params.calldata}`) as Hex)
      : null

  // Plain ETH send (no calldata).
  if (!hex) {
    if (value <= 0n && !functionNameHint) return null
    return {
      functionName: functionNameHint ?? 'ETH transfer',
      summary: 'Send ETH from the treasury',
      counterparty: target,
      counterpartyRole: 'recipient',
      intent: { kind: 'eth', recipient: target, amountRaw: value },
      isChamberSelfCall: false,
    }
  }

  const selector = hex.slice(0, 10).toLowerCase()

  // ERC-20 patterns decode from raw bytes — canonical signatures, no ABI needed.
  const words = hex.slice(10)
  const readAddressAt = (wordIndex: number): Address | null => {
    const start = wordIndex * 64 + 24
    const raw = words.slice(start, start + 40)
    if (raw.length !== 40) return null
    return isAddress_(`0x${raw}`) ? `0x${raw}` : null
  }
  const readUintAt = (wordIndex: number): bigint | null => {
    const start = wordIndex * 64
    const raw = words.slice(start, start + 64)
    if (raw.length !== 64) return null
    try {
      return BigInt(`0x${raw}`)
    } catch {
      return null
    }
  }

  if (selector === '0xa9059cbb') {
    const recipient = readAddressAt(0)
    const amountRaw = readUintAt(1)
    if (recipient && amountRaw !== null) {
      return {
        functionName: 'transfer',
        summary: 'Send tokens from the treasury',
        counterparty: recipient,
        counterpartyRole: 'recipient',
        intent: { kind: 'erc20', token: target, mode: 'transfer', to: recipient, amountRaw },
        isChamberSelfCall: false,
      }
    }
  }

  if (selector === '0x23b872dd') {
    const from = readAddressAt(0)
    const to = readAddressAt(1)
    const amountRaw = readUintAt(2)
    if (from && to && amountRaw !== null) {
      return {
        functionName: 'transferFrom',
        summary: 'Move tokens via transferFrom',
        counterparty: to,
        counterpartyRole: 'recipient',
        intent: { kind: 'erc20', token: target, mode: 'transferFrom', from, to, amountRaw },
        isChamberSelfCall: false,
      }
    }
  }

  if (selector === '0x095ea7b3') {
    const spender = readAddressAt(0)
    const amountRaw = readUintAt(1)
    if (spender && amountRaw !== null) {
      return {
        functionName: 'approve',
        summary: amountRaw === 0n ? 'Revoke token allowance' : 'Approve token spending',
        counterparty: spender,
        counterpartyRole: 'spender',
        intent: { kind: 'erc20', token: target, mode: 'approve', spender, amountRaw },
        isChamberSelfCall: false,
      }
    }
  }

  // Chamber self-calls (upgrade / pause / unpause).
  try {
    const decoded = decodeFunctionData({ abi: CHAMBER_SELF_CALL_ABI, data: hex })
    const args = (decoded.args as readonly unknown[] | undefined) ?? []
    if (decoded.functionName === 'upgradeImplementation') {
      const impl = args[0]
      if (isAddress_(impl)) {
        return {
          functionName: 'upgradeImplementation',
          summary: 'Upgrade the Chamber implementation (governance change)',
          counterparty: impl,
          counterpartyRole: 'implementation',
          intent: null,
          isChamberSelfCall: true,
        }
      }
    }
    return {
      functionName: decoded.functionName,
      summary:
        decoded.functionName === 'pause'
          ? 'Pause the Chamber vault (governance change)'
          : 'Unpause the Chamber vault (governance change)',
      intent: null,
      isChamberSelfCall: true,
    }
  } catch {
    // Not a chamber self-call selector.
  }

  // Generic known patterns (mint / deposit / withdraw / …).
  for (const abi of [erc20Abi, chamberAbi] as const) {
    try {
      const decoded = decodeFunctionData({ abi, data: hex })
      const args = (decoded.args as readonly unknown[] | undefined) ?? []
      let counterparty: Address | undefined
      for (const arg of args) {
        if (isAddress_(arg)) {
          counterparty = arg
          break
        }
      }
      return {
        functionName: decoded.functionName,
        summary: `${decoded.functionName}(${args.map((a) => (isAddress_(a) ? shortHex(a) : typeof a === 'bigint' ? formatRawAmount(a) : shortHex(String(a)))).join(', ')})`,
        counterparty,
        counterpartyRole: counterparty ? 'target' : undefined,
        intent: null,
        isChamberSelfCall: false,
      }
    } catch {
      // Try the next ABI.
    }
  }

  if (functionNameHint) {
    return {
      functionName: functionNameHint,
      summary: `${functionNameHint} (${selector})`,
      intent: null,
      isChamberSelfCall: false,
    }
  }
  return {
    functionName: selector,
    summary: `Contract call ${selector}`,
    intent: null,
    isChamberSelfCall: false,
  }
}

export const CHAMBER_ERROR_COPY: Record<string, string> = {
  NotDirector: 'Caller is not a seated director.',
  DirectorNotSeated: 'Director seat is not seated yet (seating delay active).',
  NotEnoughConfirmations: 'Not enough confirmations to execute yet.',
  AlreadyConfirmed: 'This director already confirmed this proposal.',
  InvalidTransaction: 'Proposal does not exist or was already executed.',
  TransactionExpired: 'Proposal deadline has passed — it expired.',
  EnforcedPause: 'Chamber is paused — execution is halted.',
  ExpectedPause: 'Chamber is not paused.',
  InvalidTokenId: 'Not a valid director seat token.',
  NotAuthorized: 'Caller is not authorized for this action.',
  InvalidCalldata: 'Execution calldata is empty or does not match the commitment.',
}

/** Best-effort decode of revert data into director-readable copy. */
export function humanizeRevertData(revertData: Hex | undefined | null): string | null {
  if (!revertData || revertData.length < 10) return null
  try {
    const decoded = decodeErrorResult({ abi: STANDARD_ERROR_ABI, data: revertData })
    if (decoded.errorName === 'Error' && typeof decoded.args?.[0] === 'string') {
      return decoded.args[0]
    }
    if (decoded.errorName === 'Panic') {
      const code = decoded.args?.[0]
      if (code === 0x11n) return 'Arithmetic overflow (Panic 0x11) — the numbers do not add up.'
      if (code === 0x12n) return 'Division by zero (Panic 0x12).'
      return `Solidity panic ${code?.toString() ?? ''}.`
    }
  } catch {
    // Not a standard error.
  }
  try {
    const decoded = decodeErrorResult({ abi: chamberAbi, data: revertData })
    return (
      CHAMBER_ERROR_COPY[decoded.errorName] ??
      `Chamber reverted with ${decoded.errorName}.`
    )
  } catch {
    // Unknown custom error — show selector.
  }
  return `Reverted with unknown error ${revertData.slice(0, 10)}.`
}

function extractRevertData(error: unknown, depth = 0): Hex | undefined {
  if (depth > 6 || typeof error !== 'object' || error === null) return undefined
  const candidates: unknown[] = [
    (error as { data?: unknown }).data,
    (error as { revertData?: unknown }).revertData,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.startsWith('0x') && candidate.length >= 10) {
      return candidate as Hex
    }
    if (typeof candidate === 'object' && candidate !== null) {
      const inner = (candidate as { data?: unknown }).data
      if (typeof inner === 'string' && inner.startsWith('0x') && inner.length >= 10) {
        return inner as Hex
      }
    }
  }
  return extractRevertData((error as { cause?: unknown }).cause, depth + 1)
}

/** Director-readable reason for a simulation/RPC failure. */
export function humanizeSimulationError(error: unknown): string {
  const revertData = extractRevertData(error)
  const reason = humanizeRevertData(revertData)
  if (reason) return reason
  if (error instanceof Error) {
    const msg = error.message.trim()
    if (msg) return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg
  }
  return 'Simulation failed for an unknown reason.'
}

export { erc20Abi, formatUnits }
