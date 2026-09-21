/**
 * LoreumNFT (Explorers) contract addresses.
 * Source: contracts/deployments/mainnet.txt and contracts/deployments/sepolia.txt
 *
 * Env vars override defaults:
 *   VITE_LOREUM_NFT_MAINNET — mainnet address
 *   VITE_LOREUM_NFT_SEPOLIA — sepolia address
 */

const DEFAULT_MAINNET = '0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15' as const
const DEFAULT_SEPOLIA = '0x69e41faF363A6Be4Cde76268315F48Ef0034C8b8' as const

/** Chain IDs — kept local to avoid importing wagmi in pure-data modules. */
export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
} as const

export const LOREUM_NFT_ADDRESS: Record<number, `0x${string}`> = {
  [CHAIN_IDS.MAINNET]: (import.meta.env.VITE_LOREUM_NFT_MAINNET || DEFAULT_MAINNET) as `0x${string}`,
  [CHAIN_IDS.SEPOLIA]: (import.meta.env.VITE_LOREUM_NFT_SEPOLIA || DEFAULT_SEPOLIA) as `0x${string}`,
}

export function getLoreumNftAddress(chainId: number): `0x${string}` | undefined {
  return LOREUM_NFT_ADDRESS[chainId]
}
