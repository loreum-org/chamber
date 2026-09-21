/**
 * LoreumNFT (Explorers) contract addresses.
 * Parsed at build time from contracts/deployments/{mainnet,sepolia}.txt
 * using Vite's ?raw import (same pattern as app/src/lib/sepoliaDeployments.ts).
 *
 * Env vars override parsed values:
 *   VITE_LOREUM_NFT_MAINNET — mainnet address
 *   VITE_LOREUM_NFT_SEPOLIA — sepolia address
 */

import { getAddress, isAddress } from 'viem'
import mainnetTxt from '../../../app/contracts/deployments/mainnet.txt?raw'
import sepoliaTxt from '../../../app/contracts/deployments/sepolia.txt?raw'

/** Chain IDs — kept local to avoid importing wagmi in pure-data modules. */
export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
} as const

const LOREUM_NFT_LABEL = /^LoreumNFT\s*\(Explorers\)\s+(0x[a-fA-F0-9]{40})\s*$/i

/** Extract the LoreumNFT (Explorers) address from a deployment .txt file. Last match wins. */
export function parseLoreumNftAddress(text: string): `0x${string}` | undefined {
  let found: `0x${string}` | undefined
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(LOREUM_NFT_LABEL)
    if (!match?.[1]) continue
    if (!isAddress(match[1])) continue
    found = getAddress(match[1])
  }
  return found
}

const PARSED_MAINNET = parseLoreumNftAddress(mainnetTxt)
const PARSED_SEPOLIA = parseLoreumNftAddress(sepoliaTxt)

/**
 * chainId → LoreumNFT address.
 * Env vars override parsed values; undefined for unsupported chains.
 */
export const LOREUM_NFT_ADDRESS: Record<number, `0x${string}` | undefined> = {
  [CHAIN_IDS.MAINNET]:
    (import.meta.env.VITE_LOREUM_NFT_MAINNET as `0x${string}` | undefined) || PARSED_MAINNET,
  [CHAIN_IDS.SEPOLIA]:
    (import.meta.env.VITE_LOREUM_NFT_SEPOLIA as `0x${string}` | undefined) || PARSED_SEPOLIA,
}

export function getLoreumNftAddress(chainId: number): `0x${string}` | undefined {
  return LOREUM_NFT_ADDRESS[chainId]
}
