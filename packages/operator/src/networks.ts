import type { Chain } from 'viem'
import { arbitrumSepolia, baseSepolia, optimismSepolia, sepolia } from 'viem/chains'
import { ChamberOperatorError } from './errors.ts'

export type NetworkName = 'sepolia' | 'base-sepolia' | 'arbitrum-sepolia' | 'op-sepolia'

/** Testnets with a Chamber Factory, with the same public RPCs the app falls back to. */
export const NETWORKS: Record<NetworkName, { chain: Chain; rpcUrl: string }> = {
  sepolia: { chain: sepolia, rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com' },
  'base-sepolia': { chain: baseSepolia, rpcUrl: 'https://sepolia.base.org' },
  'arbitrum-sepolia': { chain: arbitrumSepolia, rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc' },
  'op-sepolia': { chain: optimismSepolia, rpcUrl: 'https://sepolia.optimism.io' },
}

export function resolveNetwork(name: string): { chain: Chain; rpcUrl: string } {
  const network = NETWORKS[name as NetworkName]
  if (!network) {
    throw new ChamberOperatorError(
      `Unknown network: ${name}. Use one of ${Object.keys(NETWORKS).join(', ')}.`,
    )
  }
  return network
}
