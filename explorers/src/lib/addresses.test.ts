import { describe, it, expect } from 'vitest'
import { getLoreumNftAddress, LOREUM_NFT_ADDRESS, CHAIN_IDS, parseLoreumNftAddress } from './addresses'

describe('parseLoreumNftAddress', () => {
  it('extracts address from mainnet deployment text', () => {
    const text = `
  LoreumNFT (Explorers)     0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15
    name/symbol             Loreum Explorers / LOREUM
`
    expect(parseLoreumNftAddress(text)).toBe('0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15')
  })

  it('extracts address from sepolia deployment text', () => {
    const text = `
  LoreumNFT (Explorers)     0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8
    name/symbol             Blackholes / HOLES
`
    expect(parseLoreumNftAddress(text)).toBe('0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8')
  })

  it('returns undefined when label is absent', () => {
    expect(parseLoreumNftAddress('Factory 0x1234567890abcdef1234567890abcdef12345678')).toBeUndefined()
  })

  it('returns undefined for invalid address', () => {
    expect(parseLoreumNftAddress('LoreumNFT (Explorers)     0xZZZZ')).toBeUndefined()
  })

  it('checksums the address', () => {
    // all-lowercase valid address should get checksummed
    const text = 'LoreumNFT (Explorers)     0xb99dedbde082b8be86f06449f2fc7b9fed044e15'
    const result = parseLoreumNftAddress(text)
    expect(result).toBe('0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15')
  })

  it('last matching line wins', () => {
    const text = `
  LoreumNFT (Explorers)     0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8
  some other stuff
  LoreumNFT (Explorers)     0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15
`
    expect(parseLoreumNftAddress(text)).toBe('0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15')
  })
})

describe('addresses (parsed from deployment files)', () => {
  it('has mainnet address', () => {
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.MAINNET]).toBeDefined()
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.MAINNET]).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('has sepolia address', () => {
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.SEPOLIA]).toBeDefined()
    expect(LOREUM_NFT_ADDRESS[CHAIN_IDS.SEPOLIA]).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('mainnet address matches deployment file', () => {
    expect(getLoreumNftAddress(CHAIN_IDS.MAINNET)).toBe('0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15')
  })

  it('sepolia address matches deployment file', () => {
    expect(getLoreumNftAddress(CHAIN_IDS.SEPOLIA)).toBe('0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8')
  })

  it('returns undefined for unsupported chain', () => {
    expect(getLoreumNftAddress(999999)).toBeUndefined()
  })
})
