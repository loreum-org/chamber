/**
 * Alchemy Data API for the Chamber assets panel; optional JSON-RPC fallback for wagmi.
 *
 * Prefer `VITE_*_RPC_URL` in `app/.env` for wagmi (see `src/lib/rpc.ts`). Use `VITE_ALCHEMY_API_KEY`
 * for indexed token/NFT balances, or as RPC fallback when no per-chain RPC URL is set.
 * @see https://docs.alchemy.com/reference/alchemy-gettokenbalances
 * @see https://docs.alchemy.com/reference/getnftsforowner-v3
 */

import { formatUnits, type Address } from 'viem'

/** Alchemy network path segment for RPC + NFT base URL */
const CHAIN_ALCHEMY_NETWORK: Record<number, string> = {
  1: 'eth-mainnet',
  11155111: 'eth-sepolia',
  8453: 'base-mainnet',
  42161: 'arb-mainnet',
}

export function alchemySupportsChain(chainId: number): boolean {
  return chainId in CHAIN_ALCHEMY_NETWORK
}

/**
 * Chain id used for Alchemy portfolio (token balances + NFTs).
 * Anvil default fork (31337) reads **Ethereum mainnet** state for the same contract address.
 */
export function portfolioAlchemyChainId(chainId: number): number {
  return chainId === 31337 ? 1 : chainId
}

export function getAlchemyV2RpcUrl(chainId: number, apiKey: string): string | null {
  const net = CHAIN_ALCHEMY_NETWORK[chainId]
  if (!net || !apiKey) return null
  return `https://${net}.g.alchemy.com/v2/${apiKey}`
}

export function getAlchemyNftV3BaseUrl(chainId: number, apiKey: string): string | null {
  const net = CHAIN_ALCHEMY_NETWORK[chainId]
  if (!net || !apiKey) return null
  return `https://${net}.g.alchemy.com/nft/v3/${apiKey}`
}

export type ChamberPortfolioErc20 = {
  kind: 'erc20'
  address: Address
  balanceRaw: bigint
  symbol?: string
  name?: string
  decimals: number
  logo?: string
}

export type ChamberPortfolioNft = {
  kind: 'nft'
  contractAddress: Address
  contractName?: string
  tokenType?: string
  tokenId: string
  name?: string
  imageUrl?: string
  /** ERC-1155 balance when &gt; 1 */
  balance?: string
}

export type ChamberPortfolio = {
  nativeSymbol: string
  nativeWei: bigint
  erc20: ChamberPortfolioErc20[]
  nfts: ChamberPortfolioNft[]
}

async function alchemyJsonRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`)
  const json = (await res.json()) as { result?: T; error?: { message?: string } }
  if (json.error?.message) throw new Error(json.error.message)
  if (json.result === undefined) throw new Error('Alchemy: empty result')
  return json.result
}

type TokenBalanceEntry = {
  contractAddress?: string
  tokenBalance?: string | null
  error?: string | null
}

type TokenBalancesPage = {
  address?: string
  tokenBalances?: TokenBalanceEntry[]
  pageKey?: string
}

type TokenMetadata = {
  decimals?: number | null
  symbol?: string | null
  name?: string | null
  logo?: string | null
}

async function fetchAllErc20TokenBalances(rpcUrl: string, owner: Address): Promise<TokenBalanceEntry[]> {
  const collected: TokenBalanceEntry[] = []
  let pageKey: string | undefined

  for (let guard = 0; guard < 50; guard++) {
    const params: unknown[] = pageKey
      ? [owner, 'erc20', { pageKey, maxCount: 100 }]
      : [owner, 'erc20', { maxCount: 100 }]

    const page = await alchemyJsonRpc<TokenBalancesPage>(rpcUrl, 'alchemy_getTokenBalances', params)
    const batch = page.tokenBalances ?? []
    collected.push(...batch)
    pageKey = page.pageKey
    if (!pageKey) break
  }

  return collected.filter(
    (t) =>
      t.contractAddress &&
      !t.error &&
      t.tokenBalance &&
      t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
  )
}

async function fetchTokenMetadata(rpcUrl: string, contract: Address): Promise<TokenMetadata | null> {
  try {
    return await alchemyJsonRpc<TokenMetadata>(rpcUrl, 'alchemy_getTokenMetadata', [contract])
  } catch {
    return null
  }
}

async function fetchNativeBalanceWei(rpcUrl: string, owner: Address): Promise<bigint> {
  const hex = await alchemyJsonRpc<string>(rpcUrl, 'eth_getBalance', [owner, 'latest'])
  return BigInt(hex)
}

type NftV3OwnerRow = {
  contract?: { address?: string; name?: string; tokenType?: string }
  tokenId?: string
  name?: string
  image?: { cachedUrl?: string; originalUrl?: string }
  balance?: string
}

type NftV3OwnerResponse = {
  ownedNfts?: NftV3OwnerRow[]
  pageKey?: string
}

/** Native symbol label per chain (sufficient for our supported L2s). */
function nativeSymbolForChain(chainId: number): string {
  if (chainId === 8453 || chainId === 42161) return 'ETH'
  return 'ETH'
}

async function fetchAllNftsForOwner(nftBase: string, owner: Address): Promise<ChamberPortfolioNft[]> {
  const out: ChamberPortfolioNft[] = []
  let url: string | null =
      `${nftBase}/getNFTsForOwner?owner=${encodeURIComponent(owner)}&pageSize=100`

  for (let guard = 0; guard < 50 && url; guard++) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Alchemy NFT API HTTP ${res.status}`)
    const data = (await res.json()) as NftV3OwnerResponse
    const rows = data.ownedNfts ?? []
    for (const row of rows) {
      const addr = row.contract?.address
      if (!addr) continue
      const tokenId = row.tokenId ?? ''
      const imageUrl = row.image?.cachedUrl || row.image?.originalUrl
      out.push({
        kind: 'nft',
        contractAddress: addr as Address,
        contractName: row.contract?.name,
        tokenType: row.contract?.tokenType,
        tokenId,
        name: row.name,
        imageUrl,
        balance: row.balance,
      })
    }
    const pageKey = data.pageKey
    url = pageKey
      ? `${nftBase}/getNFTsForOwner?owner=${encodeURIComponent(owner)}&pageSize=100&pageKey=${encodeURIComponent(pageKey)}`
      : null
  }

  return out
}

export type FetchChamberPortfolioOptions = {
  apiKey: string
  /** Extra ERC-20 contracts to ensure are queried (merged into balance scan) */
  extraErc20?: Address[]
}

/**
 * Fetches native balance, indexed ERC-20 balances (with metadata), and NFTs held by `chamberAddress`.
 * @throws if the chain is unsupported or the API key is missing
 */
export async function fetchChamberPortfolioAlchemy(
  chamberAddress: Address,
  chainId: number,
  opts: FetchChamberPortfolioOptions
): Promise<ChamberPortfolio> {
  const { apiKey } = opts
  if (!alchemySupportsChain(chainId)) {
    throw new Error(`Alchemy portfolio: unsupported chain ${chainId}`)
  }

  const rpcUrl = getAlchemyV2RpcUrl(chainId, apiKey)
  const nftBase = getAlchemyNftV3BaseUrl(chainId, apiKey)
  if (!rpcUrl || !nftBase) throw new Error('Alchemy portfolio: missing URL')

  const [nativeWei, rawBalances, nfts] = await Promise.all([
    fetchNativeBalanceWei(rpcUrl, chamberAddress),
    fetchAllErc20TokenBalances(rpcUrl, chamberAddress),
    fetchAllNftsForOwner(nftBase, chamberAddress),
  ])

  const byAddr = new Map<string, TokenBalanceEntry>()
  for (const row of rawBalances) {
    const key = row.contractAddress!.toLowerCase()
    byAddr.set(key, row)
  }
  for (const extra of opts.extraErc20 ?? []) {
    const key = extra.toLowerCase()
    if (byAddr.has(key)) continue
    const page = await alchemyJsonRpc<TokenBalancesPage>(rpcUrl, 'alchemy_getTokenBalances', [
      chamberAddress,
      [extra],
    ])
    const hit = page.tokenBalances?.[0]
    if (
      hit?.tokenBalance &&
      hit.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      byAddr.set(key, hit)
    }
  }

  const erc20: ChamberPortfolioErc20[] = []
  const rows = [...byAddr.values()]
  const metaList = await Promise.all(rows.map((row) => fetchTokenMetadata(rpcUrl, row.contractAddress as Address)))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const addr = row.contractAddress as Address
    const balanceRaw = BigInt(row.tokenBalance as string)
    const meta = metaList[i]
    const decimals =
      meta?.decimals !== undefined && meta.decimals !== null
        ? Number(meta.decimals)
        : 18
    const safeDecimals = Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18

    erc20.push({
      kind: 'erc20',
      address: addr,
      balanceRaw,
      symbol: meta?.symbol ?? undefined,
      name: meta?.name ?? undefined,
      decimals: safeDecimals,
      logo: meta?.logo ?? undefined,
    })
  }

  erc20.sort((a, b) => {
    const sa = (a.symbol ?? a.address).toLowerCase()
    const sb = (b.symbol ?? b.address).toLowerCase()
    return sa.localeCompare(sb)
  })

  return {
    nativeSymbol: nativeSymbolForChain(chainId),
    nativeWei,
    erc20,
    nfts,
  }
}

export function formatErc20BalanceHuman(row: ChamberPortfolioErc20): string {
  try {
    return formatUnits(row.balanceRaw, row.decimals)
  } catch {
    return row.balanceRaw.toString()
  }
}

export function getAlchemyApiKeyFromEnv(): string | undefined {
  const k = import.meta.env.VITE_ALCHEMY_API_KEY
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : undefined
}
