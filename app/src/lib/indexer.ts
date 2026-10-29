/**
 * Ponder GraphQL client for the `indexer/` package.
 *
 * One `VITE_INDEXER_URL` serves every chain in `VITE_INDEXER_CHAIN_IDS`
 * (comma-separated). `VITE_INDEXER_CHAIN_ID` still sets a single chain when
 * the list is unset. “Mine” = chamber.creator OR chamberHolder.shares > 0 on
 * that chain. Directors stay on-chain (`getDirectors`).
 *
 * Chains the indexer does not cover fall back to chunked getLogs.
 */

import type { Address } from 'viem'
import { isNonZeroAddress } from '@/lib/address'

/** Base Sepolia, the chain indexed when no env list is set. */
export const DEFAULT_INDEXER_CHAIN_ID = 84532

/**
 * Ponder network names in `indexer/ponder.config.ts` (`_meta.status` keys).
 * `chainId` on the status row wins when Ponder includes it.
 */
const INDEXER_NETWORK_BY_CHAIN_ID: Record<number, string> = {
  84532: 'baseSepolia',
  421614: 'arbitrumSepolia',
  11155420: 'opSepolia',
  11155111: 'sepolia',
}

const MY_CHAMBERS_QUERY = /* GraphQL */ `
  query MyChambers($chainId: Int!, $account: String!) {
    created: chambers(where: { chainId: $chainId, creator: $account }, orderBy: "createdBlock", orderDirection: "desc") {
      items {
        id
        address
        creator
        source
      }
    }
    held: chamberHolders(where: { chainId: $chainId, account: $account, shares_gt: "0" }) {
      items {
        shares
        chamber {
          id
          address
          creator
          source
        }
      }
    }
  }
`

export type IndexerChamber = {
  address: `0x${string}`
  creator?: `0x${string}`
  source?: string
}

export type IndexerMyChambers = {
  created: IndexerChamber[]
  held: IndexerChamber[]
}

export function getIndexerUrl(): string | undefined {
  const raw = import.meta.env?.VITE_INDEXER_URL
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : undefined
}

export function parsePositiveChainId(raw: string | undefined): number | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const parsed = Number(raw.trim())
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined
  return parsed
}

/** `VITE_INDEXER_CHAIN_IDS` wins. A single `VITE_INDEXER_CHAIN_ID` is the fallback. */
export function parseIndexerChainIds(list: string | undefined, single: string | undefined): number[] {
  if (typeof list === 'string' && list.trim() !== '') {
    const ids: number[] = []
    for (const part of list.split(',')) {
      const id = parsePositiveChainId(part)
      if (id !== undefined && !ids.includes(id)) ids.push(id)
    }
    if (ids.length > 0) return ids
  }
  const one = parsePositiveChainId(single)
  if (one !== undefined) return [one]
  return [DEFAULT_INDEXER_CHAIN_ID]
}

export function getIndexerChainIds(): number[] {
  return parseIndexerChainIds(
    import.meta.env?.VITE_INDEXER_CHAIN_IDS,
    import.meta.env?.VITE_INDEXER_CHAIN_ID,
  )
}

export function getIndexerChainId(): number {
  return getIndexerChainIds()[0] ?? DEFAULT_INDEXER_CHAIN_ID
}

export function indexerAppliesToChain(chainId: number): boolean {
  return !!getIndexerUrl() && getIndexerChainIds().includes(chainId)
}

export function indexerGraphqlUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/graphql') ? trimmed : `${trimmed}/graphql`
}

function asAddress(value: unknown): `0x${string}` | undefined {
  if (typeof value !== 'string') return undefined
  const lower = value.trim().toLowerCase()
  return isNonZeroAddress(lower) ? (lower as `0x${string}`) : undefined
}

function chamberFromPayload(value: unknown): IndexerChamber | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as { id?: unknown; address?: unknown; creator?: unknown; source?: unknown }
  const address = asAddress(row.address) ?? asAddress(row.id)
  if (!address) return undefined
  const creator = asAddress(row.creator)
  const source = typeof row.source === 'string' ? row.source : undefined
  return { address, creator, source }
}

export function parseIndexerMyChambers(payload: unknown): IndexerMyChambers {
  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const createdItems = (root.created as { items?: unknown } | undefined)?.items
  const heldItems = (root.held as { items?: unknown } | undefined)?.items

  const created: IndexerChamber[] = []
  if (Array.isArray(createdItems)) {
    for (const item of createdItems) {
      const chamber = chamberFromPayload(item)
      if (chamber) created.push(chamber)
    }
  }

  const held: IndexerChamber[] = []
  if (Array.isArray(heldItems)) {
    for (const item of heldItems) {
      const row = item && typeof item === 'object' ? (item as { chamber?: unknown }) : undefined
      const chamber = chamberFromPayload(row?.chamber)
      if (chamber) held.push(chamber)
    }
  }

  return { created, held }
}

export async function fetchIndexerMyChambers(
  url: string,
  account: Address,
  chainId: number,
): Promise<IndexerMyChambers> {
  const endpoint = indexerGraphqlUrl(url)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: MY_CHAMBERS_QUERY,
      variables: { account: account.toLowerCase(), chainId },
    }),
  })
  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`)
  const json = (await res.json()) as { errors?: { message?: string }[]; data?: unknown }
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'Indexer GraphQL error')
  }
  return parseIndexerMyChambers(json)
}

/** Indexer head from Ponder `_meta.status` for one network. */
export type IndexerHead = { number: bigint; timestamp: bigint; ready: boolean }

function headFromStatusRow(network: unknown): IndexerHead | undefined {
  const row = network as { ready?: unknown; block?: { number?: unknown; timestamp?: unknown } } | null
  const number = row?.block?.number
  const timestamp = row?.block?.timestamp
  if (number === undefined || number === null) return undefined
  return {
    number: BigInt(number as number | string),
    timestamp: BigInt((timestamp ?? 0) as number | string),
    ready: row?.ready === true,
  }
}

function statusChainId(name: string, network: unknown): number | undefined {
  if (network && typeof network === 'object' && 'chainId' in network) {
    const value = (network as { chainId?: unknown }).chainId
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  }
  const known = Object.entries(INDEXER_NETWORK_BY_CHAIN_ID).find(([, networkName]) => networkName === name)
  return known ? Number(known[0]) : undefined
}

export function parseIndexerHead(status: unknown, chainId?: number): IndexerHead | undefined {
  if (!status || typeof status !== 'object') return undefined
  const entries = Object.entries(status as Record<string, unknown>)
  if (chainId === undefined) {
    for (const [, network] of entries) {
      const head = headFromStatusRow(network)
      if (head) return head
    }
    return undefined
  }
  for (const [name, network] of entries) {
    if (statusChainId(name, network) !== chainId) continue
    return headFromStatusRow(network)
  }
  const networkName = INDEXER_NETWORK_BY_CHAIN_ID[chainId]
  if (!networkName) return undefined
  return headFromStatusRow((status as Record<string, unknown>)[networkName])
}

/** Thrown when the indexer has not reached a block the app is waiting for. React Query retries it. */
export class IndexerBehindError extends Error {
  constructor(readonly head: bigint | undefined, readonly required: bigint) {
    super(`Indexer at block ${head ?? 'unknown'}, waiting for ${required}`)
    this.name = 'IndexerBehindError'
  }
}

/**
 * After a wallet write lands in block N, reads for that chamber must come from
 * an indexer at ≥ N or the UI would show pre-write state. Keyed by chain and
 * lowercase chamber so the same CREATE2 address on two chains stays independent.
 */
const requiredBlockByChamber = new Map<string, bigint>()

function freshnessKey(chainId: number | undefined, chamber: string): string {
  const address = chamber.toLowerCase()
  return chainId === undefined ? address : `${chainId}:${address}`
}

export function requireIndexerBlock(chamber: string, blockNumber: bigint, chainId?: number): void {
  const key = freshnessKey(chainId, chamber)
  const current = requiredBlockByChamber.get(key)
  if (current === undefined || blockNumber > current) requiredBlockByChamber.set(key, blockNumber)
}

export function requiredIndexerBlock(chamber: string, chainId?: number): bigint | undefined {
  return requiredBlockByChamber.get(freshnessKey(chainId, chamber))
}

/**
 * POST a GraphQL query that selects `_meta { status }` alongside its data.
 * Throws `IndexerBehindError` when `chamber` has a pending write the indexer has not reached.
 */
export async function indexerRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { url?: string; chamber?: string; chainId?: number } = {},
): Promise<{ data: T; head: IndexerHead | undefined }> {
  const url = options.url ?? getIndexerUrl()
  if (!url) throw new Error('Indexer URL not configured')
  const res = await fetch(indexerGraphqlUrl(url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`)
  const json = (await res.json()) as {
    errors?: { message?: string }[]
    data?: T & { _meta?: { status?: unknown } }
  }
  if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Indexer GraphQL error')
  if (!json.data) throw new Error('Indexer returned no data')

  const head = parseIndexerHead(json.data._meta?.status, options.chainId)
  const required = options.chamber ? requiredIndexerBlock(options.chamber, options.chainId) : undefined
  if (required !== undefined && (!head || head.number < required)) {
    throw new IndexerBehindError(head?.number, required)
  }
  return { data: json.data, head }
}

/** React Query retry policy: keep polling while the indexer catches up to a write, else retry twice. */
export function indexerRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof IndexerBehindError) return failureCount < 40
  return failureCount < 2
}

export function indexerRetryDelay(failureCount: number, error: unknown): number {
  if (error instanceof IndexerBehindError) return 1500
  return Math.min(1000 * 2 ** failureCount, 8000)
}
