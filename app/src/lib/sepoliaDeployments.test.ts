import { describe, expect, it } from 'vitest'
import { parseSepoliaDeploymentAddresses } from './sepoliaDeployments'
import sepoliaTxt from '../../contracts/deployments/sepolia.txt?raw'

/**
 * Snapshot of parsed addresses BEFORE the LoreumNFT (Explorers) entry was added.
 * The new label must NOT match any existing LINE_PARSERS regex so that app/
 * parsing remains unchanged. See issue #291.
 */
const EXPECTED_BASELINE = {
  registry: '0x7AECf59eAD4B054A58bD42Af8704d381FdD9E821' as const,
  factory: '0xE87FF28C44593122e4BD87e48A18c9f08eBc811d' as const,
  chamberImplementation: '0x07026D7DC398b8eF7874aEa1bBC00ACA231B20Af' as const,
  mockERC20: '0x486D69BcAF1E07e4F90edDA9fA7e09De50CD01a2' as const,
  mockERC721: '0x03CBb0Bb72aeB043b0dc8B299FaCFe77f9159688' as const,
}

describe('parseSepoliaDeploymentAddresses', () => {
  it('returns known addresses from the committed sepolia.txt', () => {
    const result = parseSepoliaDeploymentAddresses(sepoliaTxt)
    expect(result).toEqual(EXPECTED_BASELINE)
  })

  it('ignores LoreumNFT (Explorers) label — does not overwrite any parsed key', () => {
    // The LoreumNFT (Explorers) line must not match MockERC721 or any other regex.
    const textWithExplorers = `${sepoliaTxt}
  LoreumNFT (Explorers)     0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8
`
    const result = parseSepoliaDeploymentAddresses(textWithExplorers)
    expect(result).toEqual(EXPECTED_BASELINE)
  })

  it('does not match LoreumNFT label against MockERC721 regex', () => {
    const mockERC721Re = /^MockERC721(?:\s*\([^)]*\))?\s+(0x[a-fA-F0-9]{40})\s*$/i
    expect(mockERC721Re.test('LoreumNFT (Explorers)     0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8')).toBe(false)
  })
})
