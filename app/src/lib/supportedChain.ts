/** Ethereum mainnet — the default network when its Factory is configured. */
export const MAINNET_CHAIN_ID = 1
export const SEPOLIA_CHAIN_ID = 11_155_111
export const BASE_SEPOLIA_CHAIN_ID = 84_532
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421_614
export const OP_SEPOLIA_CHAIN_ID = 11_155_420

/**
 * Chains the wallet connector, network switcher, and chamber lookup offer, in that order.
 * The first id is the disconnected default. Mainnet is first now that its Factory is deployed.
 *
 * Temporary narrowing: Ethereum mainnet and Ethereum Sepolia only.
 * To offer another chain again, append its id (the deployment files and
 * `getContractAddresses` already know them):
 * Base Sepolia 84532, Arbitrum Sepolia 421614, OP Sepolia 11155420,
 * Base 8453, Arbitrum 42161, Anvil 31337.
 */
export const SUPPORTED_WALLET_CHAIN_IDS = [MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID] as const

/** Known testnets that have deployment files, in historical display order. */
export const TESTNET_CHAIN_IDS = [
  SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  OP_SEPOLIA_CHAIN_ID,
] as const

export function isSupportedWalletChain(chainId: number): boolean {
  return (SUPPORTED_WALLET_CHAIN_IDS as readonly number[]).includes(chainId)
}

/**
 * Chains the app may read: wallet chains only, in wallet order.
 * Lookup, factory scans, and indexer fan-out all go through this so a removed
 * chain cannot show up as "Chamber lookup failed on …".
 */
export function chainIdsToQuery(candidates: readonly number[]): number[] {
  const wanted = new Set(candidates)
  return SUPPORTED_WALLET_CHAIN_IDS.filter((id) => wanted.has(id))
}

/**
 * Wallet chains in `walletChainIds` order. Unknown ids are skipped so a stale
 * id cannot crash config setup. Pass a wider list to offer a catalog chain again.
 */
export function selectWalletChains<T extends { id: number }>(
  catalog: readonly T[],
  walletChainIds: readonly number[] = SUPPORTED_WALLET_CHAIN_IDS,
): T[] {
  const selected: T[] = []
  const seen = new Set<number>()
  for (const id of walletChainIds) {
    if (seen.has(id)) continue
    const chain = catalog.find((entry) => entry.id === id)
    if (!chain) continue
    seen.add(id)
    selected.push(chain)
  }
  return selected
}

/** Display name for wallet/config banners. Does not invent chain metadata. */
export function getNetworkName(chainId: number, configuredName?: string): string {
  switch (chainId) {
    case MAINNET_CHAIN_ID:
      return 'Mainnet'
    case SEPOLIA_CHAIN_ID:
      return 'Sepolia'
    case 8453:
      return 'Base'
    case BASE_SEPOLIA_CHAIN_ID:
      return 'Base Sepolia'
    case 42161:
      return 'Arbitrum'
    case ARBITRUM_SEPOLIA_CHAIN_ID:
      return 'Arbitrum Sepolia'
    case OP_SEPOLIA_CHAIN_ID:
      return 'OP Sepolia'
    case 31337:
      return 'Localhost'
    default:
      return configuredName ?? `Chain ${chainId}`
  }
}

/**
 * Prefer Ethereum mainnet when it is in the configured-and-supported list,
 * otherwise the first entry. Callers must pass only chains that already have a Factory or
 * Registry — this does not invent addresses.
 */
export function pickPreferredSupportedChainId(
  configuredSupportedIds: readonly number[],
  prefer: number = MAINNET_CHAIN_ID,
): number | undefined {
  if (configuredSupportedIds.includes(prefer)) return prefer
  return configuredSupportedIds[0]
}

export function showMainnetUnsupportedBanner(
  chainId: number,
  mainnetConfigured: boolean,
): boolean {
  return chainId === 1 && !mainnetConfigured
}

export function switchToSupportedChainLabel(chainId: number | undefined): string {
  return chainId == null ? 'Switch network' : `Switch to ${getNetworkName(chainId)}`
}

/** DEV-only `?simulateChainId=1` so the mainnet banner can be exercised without a mainnet wallet. */
export function readSimulatedChainId(search: string, enabled: boolean): number | undefined {
  if (!enabled) return undefined
  const raw = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('simulateChainId')
  if (!raw) return undefined
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}
