import { formatUnits, type Address } from 'viem'
import type { ChamberPortfolio } from '@/lib/alchemy'

/**
 * Spot USD valuation via DefiLlama Coins API (public, no key).
 * @see https://defillama.com/docs/api
 */

const LLAMA_CHAIN_BY_ALCHEMY_CHAIN: Record<number, string | null> = {
  1: 'ethereum',
  8453: 'base',
  42161: 'arbitrum',
  11155111: null,
}

/** Wrapped native on each chain — price tracks gas token. */
const WRAPPED_NATIVE_BY_LLAMA_CHAIN: Record<string, Address> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  base: '0x4200000000000000000000000000000000000006',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
}

export type PortfolioUsdBreakdown = {
  totalUsd: number
  erc20Priced: number
  erc20Unpriced: number
  /** True when native balance was converted using wrapped-native spot price */
  nativeIncluded: boolean
  /** True when there is native balance but no usable gas-token price */
  nativeUnpriced: boolean
  nftCount: number
}

export function alchemyChainSupportsUsdPricing(alchemyChainId: number): boolean {
  return LLAMA_CHAIN_BY_ALCHEMY_CHAIN[alchemyChainId] != null
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchLlamaPricesBatches(coinIds: string[]): Promise<Record<string, { price: number }>> {
  const merged: Record<string, { price: number }> = {}
  for (const batch of chunk(coinIds, 40)) {
    const url = `https://coins.llama.fi/prices/current/${batch.join(',')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`DefiLlama prices HTTP ${res.status}`)
    const json = (await res.json()) as { coins?: Record<string, { price: number }> }
    Object.assign(merged, json.coins ?? {})
  }
  return merged
}

export function chainSupportsSpotUsdPricing(chainId: number): boolean {
  return LLAMA_CHAIN_BY_ALCHEMY_CHAIN[chainId] != null
}

export type SpotUsdPrices = {
  /** USD price per lower-cased token address; missing key = unpriced. */
  tokens: Record<string, number>
  /** Gas-token (native) price via wrapped-native spot, when available. */
  native: number | null
}

/**
 * Spot USD prices for a set of token addresses on a chain (#260 transaction
 * valuation). Uses the same public DefiLlama Coins feed as the portfolio.
 */
export async function fetchSpotUsdPrices(
  chainId: number,
  tokenAddresses: readonly Address[],
): Promise<SpotUsdPrices> {
  const llamaChain = LLAMA_CHAIN_BY_ALCHEMY_CHAIN[chainId]
  if (!llamaChain) return { tokens: {}, native: null }

  const weth = WRAPPED_NATIVE_BY_LLAMA_CHAIN[llamaChain]
  const wanted = tokenAddresses.map((a) => a.toLowerCase())
  const coinIds = [...new Set([`${llamaChain}:${weth.toLowerCase()}`, ...wanted.map((a) => `${llamaChain}:${a}`)])]
  const priceMap = await fetchLlamaPricesBatches(coinIds)

  const tokens: Record<string, number> = {}
  for (const addr of wanted) {
    const p = priceMap[`${llamaChain}:${addr}`]?.price
    if (p != null && Number.isFinite(p)) tokens[addr] = p
  }
  const nativePx = priceMap[`${llamaChain}:${weth.toLowerCase()}`]?.price
  return {
    tokens,
    native: nativePx != null && Number.isFinite(nativePx) ? nativePx : null,
  }
}

export async function computePortfolioUsd(
  portfolio: ChamberPortfolio,
  alchemyChainId: number
): Promise<PortfolioUsdBreakdown> {
  const llamaChain = LLAMA_CHAIN_BY_ALCHEMY_CHAIN[alchemyChainId]
  if (!llamaChain) {
    return {
      totalUsd: 0,
      erc20Priced: 0,
      erc20Unpriced: portfolio.erc20.length,
      nativeIncluded: false,
      nativeUnpriced: portfolio.nativeWei > 0n,
      nftCount: portfolio.nfts.length,
    }
  }

  const wethAddr = WRAPPED_NATIVE_BY_LLAMA_CHAIN[llamaChain].toLowerCase()
  const coinIdSet = new Set<string>()
  if (portfolio.nativeWei > 0n) {
    coinIdSet.add(`${llamaChain}:${wethAddr}`)
  }
  for (const row of portfolio.erc20) {
    coinIdSet.add(`${llamaChain}:${row.address.toLowerCase()}`)
  }

  const coinIds = [...coinIdSet]
  const priceMap = await fetchLlamaPricesBatches(coinIds)

  let totalUsd = 0
  let erc20Priced = 0
  let erc20Unpriced = 0

  const wethKey = `${llamaChain}:${wethAddr}`
  const wethPx = priceMap[wethKey]?.price
  const nativeHasPrice = wethPx != null && Number.isFinite(wethPx)

  if (portfolio.nativeWei > 0n) {
    if (nativeHasPrice) {
      totalUsd += (Number(portfolio.nativeWei) / 1e18) * wethPx!
    }
  }

  for (const row of portfolio.erc20) {
    const key = `${llamaChain}:${row.address.toLowerCase()}`
    const p = priceMap[key]?.price
    if (p == null || !Number.isFinite(p)) {
      erc20Unpriced++
      continue
    }
    erc20Priced++
    const human = Number.parseFloat(formatUnits(row.balanceRaw, row.decimals))
    if (Number.isFinite(human)) totalUsd += human * p
  }

  return {
    totalUsd,
    erc20Priced,
    erc20Unpriced,
    nativeIncluded: portfolio.nativeWei > 0n && nativeHasPrice,
    nativeUnpriced: portfolio.nativeWei > 0n && !nativeHasPrice,
    nftCount: portfolio.nfts.length,
  }
}

export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.01) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 6,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}
