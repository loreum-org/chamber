import { getAddress, isAddress } from 'viem'
import sepoliaTxt from '../../contracts/deployments/sepolia.txt?raw'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export type SepoliaDeploymentAddresses = {
  registry: `0x${string}`
  factory: `0x${string}`
  chamberImplementation: `0x${string}`
  mockERC20: `0x${string}`
  mockERC721: `0x${string}`
}

const EMPTY_SEPOLIA: SepoliaDeploymentAddresses = {
  registry: ZERO_ADDRESS,
  factory: ZERO_ADDRESS,
  chamberImplementation: ZERO_ADDRESS,
  mockERC20: ZERO_ADDRESS,
  mockERC721: ZERO_ADDRESS,
}

const LINE_PARSERS: Array<{ key: keyof SepoliaDeploymentAddresses; re: RegExp }> = [
  { key: 'registry', re: /^Registry \(proxy\)\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'factory', re: /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'chamberImplementation', re: /^Chamber implementation\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'mockERC20', re: /^MockERC20(?:\s*\([^)]*\))?\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'mockERC721', re: /^MockERC721(?:\s*\([^)]*\))?\s+(0x[a-fA-F0-9]{40})\s*$/i },
]

function parseAddress(raw: string): `0x${string}` | undefined {
  if (!isAddress(raw)) return undefined
  return getAddress(raw)
}

/** Last matching label in `contracts/deployments/sepolia.txt` wins. */
export function parseSepoliaDeploymentAddresses(text: string): SepoliaDeploymentAddresses {
  const out: SepoliaDeploymentAddresses = { ...EMPTY_SEPOLIA }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const { key, re } of LINE_PARSERS) {
      const match = trimmed.match(re)
      if (!match?.[1]) continue
      const addr = parseAddress(match[1])
      if (addr) out[key] = addr
    }
  }
  return out
}

/** Committed Sepolia addresses from `contracts/deployments/sepolia.txt` (no env required). */
export const sepoliaDeploymentAddresses = parseSepoliaDeploymentAddresses(sepoliaTxt)
