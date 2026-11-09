import { describe, expect, it } from 'vitest'
import {
  BASE_SEPOLIA_CHAIN_ID,
  chainIdsToQuery,
  isSupportedWalletChain,
  MAINNET_CHAIN_ID,
  selectWalletChains,
  SEPOLIA_CHAIN_ID,
  SUPPORTED_WALLET_CHAIN_IDS,
} from './supportedChain'

const catalog = [
  { id: BASE_SEPOLIA_CHAIN_ID, name: 'Base Sepolia' },
  { id: 421_614, name: 'Arbitrum Sepolia' },
  { id: 11_155_420, name: 'OP Sepolia' },
  { id: 8453, name: 'Base' },
  { id: 42161, name: 'Arbitrum' },
  { id: 31337, name: 'Localhost' },
  { id: MAINNET_CHAIN_ID, name: 'Mainnet' },
  { id: SEPOLIA_CHAIN_ID, name: 'Sepolia' },
]

describe('wallet chains', () => {
  it('offers only Ethereum Sepolia and mainnet, with Sepolia first', () => {
    expect([...SUPPORTED_WALLET_CHAIN_IDS]).toEqual([SEPOLIA_CHAIN_ID, MAINNET_CHAIN_ID])
    expect(selectWalletChains(catalog).map((chain) => chain.name)).toEqual(['Sepolia', 'Mainnet'])
  })

  it('treats every other chain as unsupported for the connected wallet', () => {
    expect(isSupportedWalletChain(SEPOLIA_CHAIN_ID)).toBe(true)
    expect(isSupportedWalletChain(MAINNET_CHAIN_ID)).toBe(true)
    for (const id of [BASE_SEPOLIA_CHAIN_ID, 421_614, 11_155_420, 8453, 42161, 31337]) {
      expect(isSupportedWalletChain(id)).toBe(false)
    }
  })

  it('offers a catalog chain again when its id is added back', () => {
    expect(
      selectWalletChains(catalog, [SEPOLIA_CHAIN_ID, MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID]).map(
        (chain) => chain.id,
      ),
    ).toEqual([SEPOLIA_CHAIN_ID, MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID])
  })

  it('skips an id that is not in the catalog', () => {
    expect(selectWalletChains(catalog, [999_999, SEPOLIA_CHAIN_ID]).map((chain) => chain.id)).toEqual([
      SEPOLIA_CHAIN_ID,
    ])
  })

  it('queries only mainnet and Sepolia, dropping every other candidate', () => {
    expect(
      chainIdsToQuery([
        BASE_SEPOLIA_CHAIN_ID,
        421_614,
        11_155_420,
        31337,
        MAINNET_CHAIN_ID,
        SEPOLIA_CHAIN_ID,
      ]),
    ).toEqual([SEPOLIA_CHAIN_ID, MAINNET_CHAIN_ID])
  })
})
