import { describe, expect, it } from 'vitest'
import { MAINNET_CHAIN_ID, pickPreferredSupportedChainId, SEPOLIA_CHAIN_ID } from './supportedChain'
import { mainnetDeploymentAddresses } from './mainnetDeployments'

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
