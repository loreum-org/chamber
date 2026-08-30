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
