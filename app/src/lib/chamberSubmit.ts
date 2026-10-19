import { decodeEventLog, parseAbi, type Hex, type TransactionReceipt } from 'viem'
import { chamberAbi } from '@/contracts/abis'
import { chamberVersionBytes32ToLabel } from './utils'

/**
 * Proposal submit across Chamber versions.
 *
 * 1.3.0 has a single `submitTransaction(tokenId, target, value, data, metadataURI, deadline)`.
 * Chambers before 1.3.0 do not have that selector, and their catch-all `fallback` returns
 * success for unknown calls, so sending the 1.3.0 call to them "succeeds" without queueing
 * anything. We therefore read `VERSION()` on-chain before every submit and use the legacy
 * `submitTransactionWithMetadata` for 1.1.5–1.2.x. Anything older (or unreadable) is blocked.
 * After mining, the receipt must carry the chamber's `SubmitTransaction` event.
 */

/** First version with the single 6-arg `submitTransaction`. */
export const SINGLE_SUBMIT_VERSION = [1, 3, 0] as const
/** Oldest version with the 6-arg `submitTransactionWithMetadata` the app can still drive. */
export const MIN_LEGACY_SUBMIT_VERSION = [1, 1, 5] as const

/** Only for chambers older than 1.3.0. Do not use for anything else. */
export const legacySubmitAbi = parseAbi([
  'function submitTransactionWithMetadata(uint256 tokenId, address target, uint256 value, bytes data, string metadataURI, uint256 deadline)',
])

/** Identical on every Chamber version (IWallet). */
export const submitTransactionEventAbi = parseAbi([
  'event SubmitTransaction(uint256 indexed tokenId, uint256 indexed nonce, address indexed to, uint256 value, bytes data)',
])

export class ChamberSubmitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChamberSubmitError'
  }
}

export type SemVer = readonly [number, number, number]

export function parseChamberVersion(label: string | undefined): SemVer | undefined {
  if (!label) return undefined
  // Strict, like ProposeChamberUpgrade.parseVersion: a suffix such as `-rc` fails closed.
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(label.trim())
  if (!m) return undefined
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function compareVersions(a: SemVer, b: SemVer): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

export interface SubmitArgs {
  tokenId: bigint
  target: `0x${string}`
  value: bigint
  data: Hex
  metadataURI?: string
  deadline?: bigint
}

export type SubmitPlan =
  | {
      kind: 'single'
      abi: typeof chamberAbi
      functionName: 'submitTransaction'
      args: readonly [bigint, `0x${string}`, bigint, Hex, string, bigint]
    }
  | {
      kind: 'legacy'
      abi: typeof legacySubmitAbi
      functionName: 'submitTransactionWithMetadata'
      args: readonly [bigint, `0x${string}`, bigint, Hex, string, bigint]
    }

/** Picks the submit call for the chamber's on-chain `VERSION` label, or throws if none is safe. */
export function planSubmit(versionLabel: string | undefined, a: SubmitArgs): SubmitPlan {
  const version = parseChamberVersion(versionLabel)
  if (!version) {
    throw new ChamberSubmitError(
      'Could not read this chamber’s VERSION, so the app cannot tell which submit function it has. Nothing was sent.',
    )
  }
  const args = [a.tokenId, a.target, a.value, a.data, a.metadataURI ?? '', a.deadline ?? 0n] as const
  if (compareVersions(version, SINGLE_SUBMIT_VERSION) >= 0) {
    return { kind: 'single', abi: chamberAbi, functionName: 'submitTransaction', args }
  }
  if (compareVersions(version, MIN_LEGACY_SUBMIT_VERSION) >= 0) {
    return { kind: 'legacy', abi: legacySubmitAbi, functionName: 'submitTransactionWithMetadata', args }
  }
  throw new ChamberSubmitError(
    `This chamber runs Chamber ${versionLabel}, which this app can no longer submit proposals to. ` +
      'The chamber needs to be redeployed on a current version.',
  )
}

/** Minimal client surface so the helpers stay testable without wagmi. */
export interface ChamberReadClient {
  readContract(args: {
    address: `0x${string}`
    abi: typeof chamberAbi
    functionName: 'VERSION'
  }): Promise<unknown>
}

export interface ReceiptClient {
  waitForTransactionReceipt(args: { hash: Hex }): Promise<TransactionReceipt>
}

/** Reads `VERSION()` on-chain (never from cache) and returns its label, e.g. `1.3.0`. */
export async function readChamberVersionLabel(
  client: ChamberReadClient,
  chamber: `0x${string}`,
): Promise<string | undefined> {
  try {
    const raw = await client.readContract({ address: chamber, abi: chamberAbi, functionName: 'VERSION' })
    return chamberVersionBytes32ToLabel(raw as Hex)
  } catch {
    return undefined
  }
}

/**
 * Returns the queued nonce from the chamber's `SubmitTransaction` log. Throws when the
 * transaction reverted or the log is missing (for example an old fallback swallowed the call).
 */
export function submittedNonceFromReceipt(receipt: TransactionReceipt, chamber: `0x${string}`): bigint {
  if (receipt.status !== 'success') {
    throw new ChamberSubmitError('The submit transaction reverted. No proposal was queued.')
  }
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== chamber.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({ abi: submitTransactionEventAbi, data: log.data, topics: log.topics })
      if (decoded.eventName === 'SubmitTransaction') return decoded.args.nonce
    } catch {
      // not a SubmitTransaction log
    }
  }
  throw new ChamberSubmitError(
    'The transaction was mined but the chamber did not record a proposal (no SubmitTransaction event). ' +
      'Nothing was queued. Check the chamber version before trying again.',
  )
}

export async function verifySubmitReceipt(
  client: ReceiptClient,
  hash: Hex,
  chamber: `0x${string}`,
): Promise<bigint> {
  const receipt = await client.waitForTransactionReceipt({ hash })
  return submittedNonceFromReceipt(receipt, chamber)
}
