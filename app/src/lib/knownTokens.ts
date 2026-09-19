import type { Address } from 'viem'

/**
 * Symbol/decimals for common treasury tokens, so the decoded queue view can
 * format ERC-20 amounts without a display-time RPC read (#260). Tokens not
 * listed here get their metadata from the transaction-time simulation.
 */

export type KnownToken = { symbol: string; decimals: number }

const KNOWN_TOKENS: Record<number, Record<string, KnownToken>> = {
  1: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
    '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18 },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18 },
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', decimals: 8 },
  },
  8453: {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
  },
  42161: {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', decimals: 6 },
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH', decimals: 18 },
  },
  11155111: {
    '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 },
    '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': { symbol: 'WETH', decimals: 18 },
  },
}

export function lookupKnownToken(chainId: number, token: Address): KnownToken | undefined {
  return KNOWN_TOKENS[chainId]?.[token.toLowerCase()]
}
