/**
 * Offchain calldata archive for Chamber proposals.
 * Onchain storage is keccak256(calldata) only; full bytes come from localStorage
 * (same browser that submitted) or SubmitTransaction logs.
 */

import { keccak256, parseAbiItem, type Hex } from 'viem'

const STORAGE_PREFIX = 'chamber-proposal-calldata'

const SUBMIT_TX_EVENT = parseAbiItem(
  'event SubmitTransaction(uint256 indexed tokenId, uint256 indexed nonce, address indexed to, uint256 value, bytes data)',
)

function storageKey(chamberAddress: string, txId: number): string {
  return `${STORAGE_PREFIX}-${chamberAddress.toLowerCase()}-${txId}`
}

export function getStoredProposalCalldata(
  chamberAddress: string,
  txId: number,
): `0x${string}` | null {
  try {
    const raw = localStorage.getItem(storageKey(chamberAddress, txId))
    if (!raw) return null
    const normalized = raw.startsWith('0x') ? raw : `0x${raw}`
    return normalized as `0x${string}`
  } catch {
    return null
  }
}

export function setStoredProposalCalldata(
  chamberAddress: string,
  txId: number,
  calldata: `0x${string}`,
): void {
  localStorage.setItem(storageKey(chamberAddress, txId), calldata)
}

export function proposalCalldataMatchesHash(
  calldata: `0x${string}`,
  dataHash: `0x${string}`,
): boolean {
  return keccak256(calldata).toLowerCase() === dataHash.toLowerCase()
}

export type ProposalCalldataSource = 'local' | 'event' | 'metadata'

export type ResolvedProposalCalldata = {
  calldata: `0x${string}`
  source: ProposalCalldataSource
}

/**
 * Fetch calldata for a proposal nonce from SubmitTransaction logs.
 */
export async function fetchProposalCalldataFromEvents(
  publicClient: {
    getLogs: (args: {
      address: `0x${string}`
      event: typeof SUBMIT_TX_EVENT
      args: { nonce: bigint }
      fromBlock: bigint
    }) => Promise<
      {
        args: {
          nonce?: bigint
          data?: Hex
        }
      }[]
    >
  },
  chamberAddress: `0x${string}`,
  txId: number,
  dataHash: `0x${string}`,
): Promise<ResolvedProposalCalldata | null> {
  const logs = await publicClient.getLogs({
    address: chamberAddress,
    event: SUBMIT_TX_EVENT,
    args: { nonce: BigInt(txId) },
    fromBlock: 0n,
  })

  for (const log of logs) {
    const data = log.args.data
    if (!data) continue
    const calldata = data as `0x${string}`
    if (proposalCalldataMatchesHash(calldata, dataHash)) {
      return { calldata, source: 'event' }
    }
  }

  return null
}

function normalizeCalldataHex(raw: string): `0x${string}` | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '0x') return null
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

export function resolveCalldataFromMetadataField(
  metadataCalldata: string | undefined,
  dataHash: `0x${string}`,
): ResolvedProposalCalldata | null {
  const calldata = metadataCalldata ? normalizeCalldataHex(metadataCalldata) : null
  if (!calldata || !proposalCalldataMatchesHash(calldata, dataHash)) return null
  return { calldata, source: 'metadata' }
}

/**
 * Resolve calldata: localStorage, onchain metadata field, then SubmitTransaction logs.
 * Persists successful hits to localStorage.
 */
export async function resolveProposalCalldata(
  publicClient: Parameters<typeof fetchProposalCalldataFromEvents>[0],
  chamberAddress: `0x${string}`,
  txId: number,
  dataHash: `0x${string}`,
  metadataCalldata?: string,
): Promise<ResolvedProposalCalldata | null> {
  const stored = getStoredProposalCalldata(chamberAddress, txId)
  if (stored && proposalCalldataMatchesHash(stored, dataHash)) {
    return { calldata: stored, source: 'local' }
  }

  const fromMeta = resolveCalldataFromMetadataField(metadataCalldata, dataHash)
  if (fromMeta) {
    setStoredProposalCalldata(chamberAddress, txId, fromMeta.calldata)
    return fromMeta
  }

  const fromEvents = await fetchProposalCalldataFromEvents(
    publicClient,
    chamberAddress,
    txId,
    dataHash,
  )
  if (fromEvents) {
    setStoredProposalCalldata(chamberAddress, txId, fromEvents.calldata)
    return fromEvents
  }

  return null
}

export { SUBMIT_TX_EVENT }
