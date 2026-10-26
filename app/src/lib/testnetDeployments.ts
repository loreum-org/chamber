import { getAddress, isAddress } from 'viem'
import sepoliaTxt from '../../contracts/deployments/sepolia.txt?raw'
import baseSepoliaTxt from '../../contracts/deployments/base-sepolia.txt?raw'
import arbitrumSepoliaTxt from '../../contracts/deployments/arbitrum-sepolia.txt?raw'
import opSepoliaTxt from '../../contracts/deployments/op-sepolia.txt?raw'
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  OP_SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from '@/lib/supportedChain'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/**
 * One `contracts/deployments/<network>.txt`, as written by
 * `make deploy-testnet`. The last entry for each label wins, except
 * `factories`, which keeps every Factory so chambers made by an older
 * Factory on the same chain are still found.
 */
export type TestnetDeployment = {
  registry: `0x${string}`
  factory: `0x${string}`
  chamberImplementation: `0x${string}`
  mockERC20: `0x${string}`
  mockERC721: `0x${string}`
  /** Every Factory in the file, oldest first. */
  factories: `0x${string}`[]
  /** Block of the oldest Factory with a recorded start block. */
  factoryStartBlock?: bigint
}

type AddressKey = 'registry' | 'factory' | 'chamberImplementation' | 'mockERC20' | 'mockERC721'

const LINE_PARSERS: Array<{ key: AddressKey; re: RegExp }> = [
  { key: 'registry', re: /^Registry \(proxy\)\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'factory', re: /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'chamberImplementation', re: /^Chamber implementation\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'mockERC20', re: /^MockERC20(?:\s*\([^)]*\))?\s+(0x[a-fA-F0-9]{40})\s*$/i },
  { key: 'mockERC721', re: /^MockERC721(?:\s*\([^)]*\))?\s+(0x[a-fA-F0-9]{40})\s*$/i },
]

const START_BLOCK_RE = /^Factory start block\s+(\d+)\s*$/i

export function parseTestnetDeployment(text: string): TestnetDeployment {
  const out: TestnetDeployment = {
    registry: ZERO_ADDRESS,
    factory: ZERO_ADDRESS,
    chamberImplementation: ZERO_ADDRESS,
    mockERC20: ZERO_ADDRESS,
    mockERC721: ZERO_ADDRESS,
    factories: [],
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const start = trimmed.match(START_BLOCK_RE)
    if (start?.[1]) {
      const block = BigInt(start[1])
      if (out.factoryStartBlock === undefined || block < out.factoryStartBlock) {
        out.factoryStartBlock = block
      }
      continue
    }
    for (const { key, re } of LINE_PARSERS) {
      const match = trimmed.match(re)
      if (!match?.[1] || !isAddress(match[1])) continue
      const addr = getAddress(match[1])
      out[key] = addr
      if (key === 'factory' && !out.factories.includes(addr)) out.factories.push(addr)
    }
  }
  return out
}

/** Committed deployments for every supported testnet, by chain id. */
export const TESTNET_DEPLOYMENTS: Record<number, TestnetDeployment> = {
  [SEPOLIA_CHAIN_ID]: parseTestnetDeployment(sepoliaTxt),
  [BASE_SEPOLIA_CHAIN_ID]: parseTestnetDeployment(baseSepoliaTxt),
  [ARBITRUM_SEPOLIA_CHAIN_ID]: parseTestnetDeployment(arbitrumSepoliaTxt),
  [OP_SEPOLIA_CHAIN_ID]: parseTestnetDeployment(opSepoliaTxt),
}
