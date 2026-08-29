/**
 * List ERC-721 token IDs owned by an address.
 *
 * `tokenOfOwnerByIndex` (ERC-721 Enumerable) is the fast path. Sepolia demo
 * membership (`MockERC721` / EXPLORERS) is plain ERC-721 — that call reverts and
 * a `balanceOf > 0` wallet would otherwise look like it owns nothing.
 *
 * Public Sepolia RPCs cap `eth_getLogs` (often 10k–50k blocks) and drop watches,
 * so logs are a last resort. Dense `ownerOf` scans cover sequential mint
 * collections; Alchemy NFT API covers sparse IDs when a key is configured.
 */

import { parseAbiItem, type Address, type PublicClient } from 'viem'
import { erc721Abi } from '@/contracts/abis'
import {
  alchemySupportsChain,
  fetchOwnedNftTokenIdsForContract,
} from '@/lib/alchemy'

export const ERC721_TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
)

/** Same cap the previous enumerable-only hook used. */
export const MAX_OWNED_MEMBERSHIP_NFTS = 50

/** Sequential membership collections stay well under this (EXPLORERS faucet). */
const MAX_DENSE_TOKEN_ID = 4096n
const OWNER_OF_BATCH = 128
const LOG_LOOKBACK_BLOCKS = 100_000n
const DEFAULT_LOG_CHUNK = 10_000n

export type OwnedNftClient = Pick<
  PublicClient,
  'readContract' | 'multicall' | 'getLogs' | 'getBlockNumber'
>

export type ListOwnedErc721Options = {
  client: OwnedNftClient
  nft: Address
  owner: Address
  /** Skip a `balanceOf` read when the caller already has it. */
  expectedBalance?: bigint
  chainId?: number
  alchemyApiKey?: string
}

function uniqSort(ids: bigint[]): bigint[] {
  return [...new Set(ids.map((id) => id.toString()))]
    .map((s) => BigInt(s))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function sameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function maxRangeFromError(err: unknown, fallback: bigint): bigint {
  const msg = errorMessage(err)
  const match =
    msg.match(/maximum block range:\s*(\d+)/i) ||
    msg.match(/block range[^\d]{0,40}(\d{3,})/i)
  if (!match) return fallback
  const n = BigInt(match[1])
  if (n <= 0n || n > 100_000n) return fallback
  return n
}

async function multicallOrSerial<T>(
  client: OwnedNftClient,
  contracts: Parameters<OwnedNftClient['multicall']>[0]['contracts'],
): Promise<{ status: 'success' | 'failure'; result?: T }[]> {
  try {
    return (await client.multicall({
      contracts,
      allowFailure: true,
    })) as { status: 'success' | 'failure'; result?: T }[]
  } catch {
    const out: { status: 'success' | 'failure'; result?: T }[] = []
    for (const c of contracts) {
      try {
        const result = (await client.readContract(c as never)) as T
        out.push({ status: 'success', result })
      } catch {
        out.push({ status: 'failure' })
      }
    }
    return out
  }
}

async function readOwners(
  client: OwnedNftClient,
  nft: Address,
  tokenIds: bigint[],
): Promise<(Address | null)[]> {
  if (tokenIds.length === 0) return []
  const results = await multicallOrSerial<Address>(
    client,
    tokenIds.map((tokenId) => ({
      address: nft,
      abi: erc721Abi,
      functionName: 'ownerOf' as const,
      args: [tokenId] as const,
    })),
  )
  return results.map((r) =>
    r.status === 'success' && r.result ? r.result : null,
  )
}

async function filterCurrentlyOwned(
  client: OwnedNftClient,
  nft: Address,
  owner: Address,
  tokenIds: bigint[],
): Promise<bigint[]> {
  const owners = await readOwners(client, nft, tokenIds)
  const kept: bigint[] = []
  for (let i = 0; i < tokenIds.length; i++) {
    const current = owners[i]
    if (current && sameAddress(current, owner)) kept.push(tokenIds[i]!)
  }
  return kept
}

async function listViaEnumerable(
  client: OwnedNftClient,
  nft: Address,
  owner: Address,
  want: number,
): Promise<bigint[]> {
  const results = await multicallOrSerial<bigint>(
    client,
    Array.from({ length: want }, (_, i) => ({
      address: nft,
      abi: erc721Abi,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [owner, BigInt(i)] as const,
    })),
  )
  const ids: bigint[] = []
  for (const r of results) {
    if (r.status === 'success' && r.result !== undefined) ids.push(r.result)
  }
  return ids
}

/**
 * Sequential collections (MockERC721 mint starts at 1). Skip when neither 0 nor 1 exists.
 */
async function listViaDenseOwnerOf(
  client: OwnedNftClient,
  nft: Address,
  owner: Address,
  want: number,
): Promise<bigint[]> {
  const [owner0, owner1] = await readOwners(client, nft, [0n, 1n])
  if (!owner0 && !owner1) return []

  const start = owner0 ? 0n : 1n
  const owned: bigint[] = []
  if (owner0 && sameAddress(owner0, owner)) owned.push(0n)
  if (owner1 && sameAddress(owner1, owner) && start === 1n) owned.push(1n)
  if (owned.length >= want) return owned

  let next = start + 1n
  while (next <= MAX_DENSE_TOKEN_ID && owned.length < want) {
    const batch: bigint[] = []
    for (let i = 0; i < OWNER_OF_BATCH && next <= MAX_DENSE_TOKEN_ID; i++) {
      batch.push(next)
      next += 1n
    }
    const owners = await readOwners(client, nft, batch)
    let anyExist = false
    for (let i = 0; i < batch.length; i++) {
      const current = owners[i]
      if (!current) continue
      anyExist = true
      if (sameAddress(current, owner)) owned.push(batch[i]!)
      if (owned.length >= want) break
    }
    if (!anyExist) break
  }

  return owned
}

async function collectTransferTokenIds(
  client: OwnedNftClient,
  nft: Address,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint | 'latest',
): Promise<bigint[]> {
  const logs = await client.getLogs({
    address: nft,
    event: ERC721_TRANSFER_EVENT,
    args: { to: owner },
    fromBlock,
    toBlock,
  })
  const ids: bigint[] = []
  for (const log of logs) {
    if (log.args.tokenId !== undefined) ids.push(log.args.tokenId)
  }
  return ids
}

async function listViaTransferLogs(
  client: OwnedNftClient,
  nft: Address,
  owner: Address,
): Promise<bigint[]> {
  try {
    return await collectTransferTokenIds(client, nft, owner, 0n, 'latest')
  } catch (fullErr) {
    try {
      const latest = await client.getBlockNumber()
      const from =
        latest > LOG_LOOKBACK_BLOCKS ? latest - LOG_LOOKBACK_BLOCKS : 0n
      let chunk = maxRangeFromError(fullErr, DEFAULT_LOG_CHUNK)
      const ids: bigint[] = []
      let cursor = from
      while (cursor <= latest) {
        const end = cursor + chunk - 1n > latest ? latest : cursor + chunk - 1n
        try {
          ids.push(...(await collectTransferTokenIds(client, nft, owner, cursor, end)))
          cursor = end + 1n
        } catch (chunkErr) {
          const next = maxRangeFromError(chunkErr, chunk / 2n)
          if (next >= chunk || next === 0n) break
          chunk = next
        }
      }
      return ids
    } catch {
      return []
    }
  }
}

/**
 * Owned token IDs for `nft` / `owner`, up to {@link MAX_OWNED_MEMBERSHIP_NFTS}.
 */
export async function listOwnedErc721TokenIds(
  opts: ListOwnedErc721Options,
): Promise<bigint[]> {
  const { client, nft, owner, chainId, alchemyApiKey } = opts

  const balance =
    opts.expectedBalance !== undefined
      ? opts.expectedBalance
      : ((await client.readContract({
          address: nft,
          abi: erc721Abi,
          functionName: 'balanceOf',
          args: [owner],
        })) as bigint)

  if (balance === 0n) return []

  const want = Number(balance > BigInt(MAX_OWNED_MEMBERSHIP_NFTS) ? MAX_OWNED_MEMBERSHIP_NFTS : balance)
  const collected = new Set<string>()

  const add = (ids: bigint[]) => {
    for (const id of ids) collected.add(id.toString())
  }

  add(await listViaEnumerable(client, nft, owner, want))
  if (collected.size >= want) {
    return uniqSort([...collected].map((s) => BigInt(s))).slice(0, want)
  }

  add(await listViaDenseOwnerOf(client, nft, owner, want))
  if (collected.size >= want) {
    return uniqSort([...collected].map((s) => BigInt(s))).slice(0, want)
  }

  if (alchemyApiKey && chainId !== undefined && alchemySupportsChain(chainId)) {
    try {
      const alchemyIds = await fetchOwnedNftTokenIdsForContract({
        apiKey: alchemyApiKey,
        chainId,
        owner,
        contract: nft,
      })
      if (alchemyIds) {
        add(await filterCurrentlyOwned(client, nft, owner, alchemyIds))
      }
    } catch {
      // indexer optional
    }
    if (collected.size >= want) {
      return uniqSort([...collected].map((s) => BigInt(s))).slice(0, want)
    }
  }

  add(
    await filterCurrentlyOwned(
      client,
      nft,
      owner,
      await listViaTransferLogs(client, nft, owner),
    ),
  )

  return uniqSort([...collected].map((s) => BigInt(s))).slice(0, want)
}
