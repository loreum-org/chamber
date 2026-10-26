import { describe, expect, it } from 'vitest'
import { parseBaseSepoliaDeploymentAddresses } from './baseSepoliaDeployments'
import baseSepoliaTxt from '../../contracts/deployments/base-sepolia.txt?raw'

const EXPECTED = {
  factory: '0x9bd245B992f0ba869D208bdABecB608080984701' as const,
  chamberImplementation: '0xC6e817C021D4fADA5Ed27B62112991ec48522E90' as const,
}

describe('parseBaseSepoliaDeploymentAddresses', () => {
  it('returns the Oct 22 2026 Base Sepolia Factory deploy', () => {
    expect(parseBaseSepoliaDeploymentAddresses(baseSepoliaTxt)).toEqual(EXPECTED)
    expect(baseSepoliaTxt).toContain('48743114')
    expect(baseSepoliaTxt).toContain('84532')
  })

  it('does not treat Factory start block or Factory tx as the Factory address', () => {
    const factoryRe = /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i
    expect(factoryRe.test('Factory start block       48743114')).toBe(false)
    expect(factoryRe.test('Factory tx                0x57b2222ab86525ab3b1b8e13f44f94d874466deeae0b7d20102159b4eced7820')).toBe(false)
  })
})
