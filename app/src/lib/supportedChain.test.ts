import { describe, expect, it } from 'vitest'
import { mainnetDeploymentAddresses } from './mainnetDeployments'
import {
  BASE_SEPOLIA_CHAIN_ID,
  chainIdsToQuery,
  isSupportedWalletChain,
  MAINNET_CHAIN_ID,
  pickPreferredSupportedChainId,
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
  it('offers only Ethereum mainnet and Sepolia, with mainnet first', () => {
    expect([...SUPPORTED_WALLET_CHAIN_IDS]).toEqual([MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID])
    expect(selectWalletChains(catalog).map((chain) => chain.name)).toEqual(['Mainnet', 'Sepolia'])
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
      selectWalletChains(catalog, [MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID]).map(
        (chain) => chain.id,
      ),
    ).toEqual([MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID])
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
        SEPOLIA_CHAIN_ID,
        MAINNET_CHAIN_ID,
      ]),
    ).toEqual([MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID])
  })
})

describe('default network', () => {
  it('prefers Ethereum mainnet when it has a Factory', () => {
    expect(pickPreferredSupportedChainId([84_532, SEPOLIA_CHAIN_ID, MAINNET_CHAIN_ID])).toBe(MAINNET_CHAIN_ID)
  })

  it('falls back to the first configured chain without mainnet', () => {
    expect(pickPreferredSupportedChainId([84_532, SEPOLIA_CHAIN_ID])).toBe(84_532)
  })

  it('reads the committed mainnet Factory', () => {
    expect(mainnetDeploymentAddresses.factory.toLowerCase()).toBe('0x35977d540799db1e8910c00f476a879e2c0e1a24')
  })
})
