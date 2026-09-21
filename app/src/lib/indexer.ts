/**
 * Ponder GraphQL client for loreum-org/chamber-indexer.
 *
 * Dual discovery: Registry (legacy) + Factory when PONDER_FACTORY_ADDRESS is set.
 * “Mine” = chamber.creator OR chamberHolder.shares > 0. Directors stay on-chain
 * (`getDirectors`); the indexer does not reconstruct the board.
 *
 * Host the indexer and set `VITE_INDEXER_URL` (e.g. https://indexer.example.com).
 * A live host is not required — `discoverChambers` falls back to chunked getLogs.
 */

import type { Address } from 'viem'
import { isNonZeroAddress } from '@/lib/address'

/** Sepolia-only today (chamber-indexer `ponder.config.ts`). Override with `VITE_INDEXER_CHAIN_ID`. */
export const DEFAULT_INDEXER_CHAIN_ID = 11155111

const MY_CHAMBERS_QUERY = /* GraphQL */ `
  query MyChambers($account: String!) {
    created: chambers(where: { creator: $account }, orderBy: "createdBlock", orderDirection: "desc") {
      items {
        id
        address
        creator
        source
      }
    }
    held: chamberHolders(where: { account: $account, shares_gt: "0" }) {
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

export function getIndexerChainId(): number {
  const raw = import.meta.env?.VITE_INDEXER_CHAIN_ID
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw.trim())
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_INDEXER_CHAIN_ID
}

export function indexerAppliesToChain(chainId: number): boolean {
  return !!getIndexerUrl() && chainId === getIndexerChainId()
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
): Promise<IndexerMyChambers> {
  const endpoint = indexerGraphqlUrl(url)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: MY_CHAMBERS_QUERY,
      variables: { account: account.toLowerCase() },
    }),
  })
  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`)
  const json = (await res.json()) as { errors?: { message?: string }[]; data?: unknown }
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'Indexer GraphQL error')
  }
  return parseIndexerMyChambers(json)
}

/** Indexer head from Ponder `_meta.status` (one network per deployment). */
export type IndexerHead = { number: bigint; timestamp: bigint; ready: boolean }

export function parseIndexerHead(status: unknown): IndexerHead | undefined {
  if (!status || typeof status !== 'object') return undefined
  for (const network of Object.values(status as Record<string, unknown>)) {
    const row = network as { ready?: unknown; block?: { number?: unknown; timestamp?: unknown } } | null
    const number = row?.block?.number
    const timestamp = row?.block?.timestamp
    if (number === undefined || number === null) continue
    return {
      number: BigInt(number as number | string),
      timestamp: BigInt((timestamp ?? 0) as number | string),
      ready: row?.ready === true,
    }
  }
  return undefined
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
 * an indexer at ≥ N or the UI would show pre-write state. Keyed by lowercase chamber.
 */
const requiredBlockByChamber = new Map<string, bigint>()

export function requireIndexerBlock(chamber: string, blockNumber: bigint): void {
  const key = chamber.toLowerCase()
  const current = requiredBlockByChamber.get(key)
  if (current === undefined || blockNumber > current) requiredBlockByChamber.set(key, blockNumber)
}

export function requiredIndexerBlock(chamber: string): bigint | undefined {
  return requiredBlockByChamber.get(chamber.toLowerCase())
}

/**
 * POST a GraphQL query that selects `_meta { status }` alongside its data.
 * Throws `IndexerBehindError` when `chamber` has a pending write the indexer has not reached.
 */
export async function indexerRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { url?: string; chamber?: string } = {},
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

  const head = parseIndexerHead(json.data._meta?.status)
  const required = options.chamber ? requiredIndexerBlock(options.chamber) : undefined
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
