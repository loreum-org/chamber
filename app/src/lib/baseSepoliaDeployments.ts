import { getAddress, isAddress } from 'viem'
import baseSepoliaTxt from '../../contracts/deployments/base-sepolia.txt?raw'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export type BaseSepoliaDeploymentAddresses = {
  factory: `0x${string}`
  chamberImplementation: `0x${string}`
}

const EMPTY: BaseSepoliaDeploymentAddresses = {
  factory: ZERO_ADDRESS,
  chamberImplementation: ZERO_ADDRESS,
}

const LINE_PARSERS: Array<{ key: keyof BaseSepoliaDeploymentAddresses; re: RegExp }> = [
  { key: 'factory', re: /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'chamberImplementation', re: /^Chamber implementation\s+(0x[a-fA-F0-9]{40})\s*$/i },
]

function parseAddress(raw: string): `0x${string}` | undefined {
  if (!isAddress(raw)) return undefined
  return getAddress(raw)
}

/** Last matching label in `contracts/deployments/base-sepolia.txt` wins. */
export function parseBaseSepoliaDeploymentAddresses(text: string): BaseSepoliaDeploymentAddresses {
  const out: BaseSepoliaDeploymentAddresses = { ...EMPTY }
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

/** Committed Base Sepolia (chain 84532) Factory from `base-sepolia.txt`. */
export const baseSepoliaDeploymentAddresses = parseBaseSepoliaDeploymentAddresses(baseSepoliaTxt)
