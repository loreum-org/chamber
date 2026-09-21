import { describe, it, expect } from 'vitest'
import { getLoreumNftAddress, LOREUM_NFT_ADDRESS, CHAIN_IDS } from './addresses'

describe('addresses', () => {
  it('has mainnet address', () => {
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.MAINNET]).toBeDefined()
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.MAINNET]).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('has sepolia address', () => {
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.SEPOLIA]).toBeDefined()
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.SEPOLIA]).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('getLoreumNftAddress returns undefined for unknown chain', () => {
    expect(getLoreumNftAddress(999999)).toBeUndefined()
  })

  it('getLoreumNftAddress returns correct address for mainnet', () => {
    expect(getLoreumNftAddress(CHAIN_IDS.MAINNET)).toBe('0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15')
  })
})
