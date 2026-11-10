import { describe, expect, it } from 'vitest'
import { parseTestnetDeployment, TESTNET_DEPLOYMENTS } from './testnetDeployments'
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  getNetworkName,
  OP_SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  TESTNET_CHAIN_IDS,
} from './supportedChain'

const ZERO = '0x0000000000000000000000000000000000000000'

describe('parseTestnetDeployment', () => {
  it('reads the committed Base Sepolia deploy', () => {
    const base = TESTNET_DEPLOYMENTS[BASE_SEPOLIA_CHAIN_ID]!
    expect(base.factory).toBe('0x9bd245B992f0ba869D208bdABecB608080984701')
    expect(base.chamberImplementation).toBe('0xC6e817C021D4fADA5Ed27B62112991ec48522E90')
    expect(base.factoryStartBlock).toBe(48_743_114n)
    expect(base.factories).toEqual([base.factory])
  })

  it('keeps the Sepolia Factory and demo tokens', () => {
    const sepolia = TESTNET_DEPLOYMENTS[SEPOLIA_CHAIN_ID]!
    expect(sepolia.factory).toBe('0xE87FF28C44593122e4BD87e48A18c9f08eBc811d')
    expect(sepolia.chamberImplementation).toBe('0x07026D7DC398b8eF7874aEa1bBC00ACA231B20Af')
    expect(sepolia.factories).toEqual([
      '0x43aA92c8A26392f21F63cdA88B6BaB5031C40550',
      '0xE87FF28C44593122e4BD87e48A18c9f08eBc811d',
    ])
    expect(sepolia.factoryStartBlock).toBe(11_571_185n)
    expect(sepolia.mockERC20).toBe('0x486D69BcAF1E07e4F90edDA9fA7e09De50CD01a2')
    expect(sepolia.mockERC721).toBe('0x03CBb0Bb72aeB043b0dc8B299FaCFe77f9159688')
  })

  it('leaves Arbitrum Sepolia and OP Sepolia empty until deployed', () => {
    for (const id of [ARBITRUM_SEPOLIA_CHAIN_ID, OP_SEPOLIA_CHAIN_ID]) {
      const d = TESTNET_DEPLOYMENTS[id]!
      expect(d.factory).toBe(ZERO)
      expect(d.factories).toEqual([])
      expect(d.factoryStartBlock).toBeUndefined()
    }
  })

  it('uses the newest Factory but keeps older ones for discovery', () => {
    const text = `
  Oct 01, 2026 - Arbitrum Sepolia (chain 421614, Factory path)
  Factory                   0x1111111111111111111111111111111111111111
  Factory start block       900
  Factory tx                0x57b2222ab86525ab3b1b8e13f44f94d874466deeae0b7d20102159b4eced7820
  Oct 23, 2026 - Arbitrum Sepolia (chain 421614, Factory path)
  Factory                   0x2222222222222222222222222222222222222222
  Chamber implementation    0x3333333333333333333333333333333333333333
  Factory start block       1200
  MockERC20 (demo)          0x4444444444444444444444444444444444444444
  MockERC721 (membership)   0x5555555555555555555555555555555555555555
`
    const d = parseTestnetDeployment(text)
    expect(d.factory).toBe('0x2222222222222222222222222222222222222222')
    expect(d.factories).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])
    expect(d.factoryStartBlock).toBe(900n)
    expect(d.chamberImplementation).toBe('0x3333333333333333333333333333333333333333')
    expect(d.mockERC20).toBe('0x4444444444444444444444444444444444444444')
    expect(d.mockERC721).toBe('0x5555555555555555555555555555555555555555')
  })
})

describe('supported testnets', () => {
  it('names all four testnets', () => {
    expect(TESTNET_CHAIN_IDS.map((id) => getNetworkName(id))).toEqual([
      'Sepolia',
      'Base Sepolia',
      'Arbitrum Sepolia',
      'OP Sepolia',
    ])
  })
})
