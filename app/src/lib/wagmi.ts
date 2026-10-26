import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { fallback, http, webSocket } from 'wagmi'
import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
  optimismSepolia,
  Chain,
} from 'wagmi/chains'
import type { Transport } from 'viem'
import localDeployments from '@/contracts/deployments.json'
import { getAlchemyApiKeyFromEnv } from '@/lib/alchemy'
import {
  chainOffersWebsocketTransport,
  planLocalChainTransports,
  planRemoteChainTransports,
  type PlannedRpcTransport,
} from '@/lib/chamberLiveUpdates'
import { ZERO_ADDRESS, isNonZeroAddress } from '@/lib/address'
import { sepoliaDeploymentAddresses } from '@/lib/sepoliaDeployments'
import { baseSepoliaDeploymentAddresses } from '@/lib/baseSepoliaDeployments'
import { mainnetDeploymentAddresses } from '@/lib/mainnetDeployments'
import { TESTNET_DEPLOYMENTS } from '@/lib/testnetDeployments'
import {
  getNetworkName as networkNameFromId,
  pickPreferredSupportedChainId,
  TESTNET_CHAIN_IDS,
} from '@/lib/supportedChain'

export { isNonZeroAddress, ZERO_ADDRESS }

const productionApp = import.meta.env.PROD

function envAddress(raw: string | undefined): string {
  return raw?.trim() ?? ''
}

function isConfiguredAddress(raw: string): boolean {
  return raw !== '' && raw.toLowerCase() !== ZERO_ADDRESS
}

/**
 * Mainnet is offered when a Factory/Registry is set via env **or** a verified
 * address pasted into `deployments/mainnet.txt`. TBD / empty stays unset.
 * Chain id 1 never falls back to Sepolia Factory `0x43aA…40550`.
 */
const mainnetFactoryRaw = envAddress(import.meta.env.VITE_MAINNET_FACTORY)
const mainnetRegistryRaw = envAddress(import.meta.env.VITE_MAINNET_REGISTRY)
export const isMainnetConfigured =
  isConfiguredAddress(mainnetFactoryRaw) ||
  isConfiguredAddress(mainnetRegistryRaw) ||
  isConfiguredAddress(mainnetDeploymentAddresses.factory) ||
  isConfiguredAddress(mainnetDeploymentAddresses.registry)

// Use the chain ID from deployments.json so that localhost accurately matches Anvil forks (dev only)
/** Receipt/block polling cadence. One Ethereum slot; viem's 4s default quadrupled RPC load. */
const POLLING_INTERVAL_MS = 12_000

export const LOCAL_CHAIN_ID = localDeployments.chainId || 31337

const alchemyApiKey = getAlchemyApiKeyFromEnv()

/** Public RPC fallbacks when `VITE_ALCHEMY_API_KEY` is unset or rate-limited (CSP allowlisted). */
const PUBLIC_RPC: Record<number, string> = {
  [mainnet.id]: 'https://eth.llamarpc.com',
  // sepolia.drpc.org now rejects free-tier Sepolia ("chain is not available on free plan").
  [sepolia.id]: 'https://ethereum-sepolia-rpc.publicnode.com',
  [base.id]: 'https://mainnet.base.org',
  [baseSepolia.id]: 'https://sepolia.base.org',
  [arbitrum.id]: 'https://arb1.arbitrum.io/rpc',
  [arbitrumSepolia.id]: 'https://sepolia-rollup.arbitrum.io/rpc',
  [optimismSepolia.id]: 'https://sepolia.optimism.io',
}

function transportFromPlan(entry: PlannedRpcTransport): Transport {
  switch (entry.kind) {
    case 'http':
      return http(entry.url)
    case 'webSocket':
      return webSocket(entry.url)
    default: {
      const _exhaustive: never = entry.kind
      return _exhaustive
    }
  }
}

function transportsFromPlan(plan: PlannedRpcTransport[]): Transport {
  const transports = plan.map(transportFromPlan)
  if (transports.length === 1) return transports[0]!
  return fallback(transports)
}

function chainTransport(chainId: number, publicUrl: string) {
  return transportsFromPlan(
    planRemoteChainTransports({ chainId, publicUrl, alchemyApiKey }),
  )
}

/** True when this chain's wagmi transport includes a WebSocket for `eth_subscribe`. */
export function chainHasWebsocketTransport(chainId: number): boolean {
  return chainOffersWebsocketTransport({
    chainId,
    alchemyApiKey,
    localChainId: LOCAL_CHAIN_ID,
  })
}

// Define localhost chain explicitly with correct chain ID (not offered in production builds)
const localhost: Chain = {
  id: LOCAL_CHAIN_ID,
  name: LOCAL_CHAIN_ID === 11155111 ? 'Local Sepolia Fork' : 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
}

// Get WalletConnect project ID from environment variable
// For local development, you can use a placeholder or get a free project ID from cloud.walletconnect.com
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

if (!walletConnectProjectId) {
  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_WALLETCONNECT_PROJECT_ID is required in production. ' +
      'Get a free project ID at https://cloud.walletconnect.com'
    )
  } else {
    console.warn(
      '⚠️ WalletConnect Project ID not configured. Wallet connections may not work properly.\n' +
      'Get a free project ID at https://cloud.walletconnect.com and add it to your .env file:\n' +
      'VITE_WALLETCONNECT_PROJECT_ID=your_project_id'
    )
  }
}

if (import.meta.env.DEV && alchemyApiKey) {
  console.info('[wagmi] Alchemy RPC enabled for every supported chain except local RPC')
}

/**
 * Production: the four testnets (Base Sepolia first, the default), plus
 * Mainnet when configured. Dev adds Base, Arbitrum and local.
 */
const appChains: Chain[] = [
  baseSepolia,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  ...(isMainnetConfigured ? [mainnet] : []),
  ...(productionApp ? [] : [base, arbitrum, localhost]),
]

const appTransports: Record<number, Transport> = {}
for (const chain of appChains) {
  appTransports[chain.id] =
    chain.id === localhost.id
      ? transportsFromPlan(planLocalChainTransports(localhost.rpcUrls.default.http[0]))
      : chainTransport(chain.id, PUBLIC_RPC[chain.id]!)
}

export const config = getDefaultConfig({
  appName: 'Chamber',
  projectId: walletConnectProjectId,
  chains: appChains as [Chain, ...Chain[]],
  ssr: false,
  pollingInterval: POLLING_INTERVAL_MS,
  transports: appTransports,
})

// Sepolia Factory path — 26 Aug 2026 (`contracts/deployments/sepolia.txt`).
// Env still wins when set (`VITE_SEPOLIA_FACTORY`, `VITE_SEPOLIA_CHAMBER_IMPL`).
export const SEPOLIA_FACTORY = '0x43aA92c8A26392f21F63cdA88B6BaB5031C40550' as `0x${string}`
export const SEPOLIA_CHAMBER_IMPLEMENTATION =
  '0xd441f1FDad2d3a447d2621DE4DE8b5738e02d39c' as `0x${string}`

// Contract addresses - localhost uses auto-generated deployments.json from `make deploy-anvil-all`
// Sepolia reads committed `contracts/deployments/sepolia.txt`; env vars override.
function addressFromEnv(...candidates: (string | undefined)[]): `0x${string}` {
  for (const raw of candidates) {
    const value = envAddress(raw)
    if (isConfiguredAddress(value)) return value as `0x${string}`
  }
  return ZERO_ADDRESS
}

export const CONTRACT_ADDRESSES = {
  // Sepolia testnet — committed defaults from sepolia.txt, env overrides
  sepolia: {
    registry: addressFromEnv(import.meta.env.VITE_SEPOLIA_REGISTRY, sepoliaDeploymentAddresses.registry),
    factory: addressFromEnv(
      import.meta.env.VITE_SEPOLIA_FACTORY,
      sepoliaDeploymentAddresses.factory,
      SEPOLIA_FACTORY,
    ),
    chamberImplementation: addressFromEnv(
      import.meta.env.VITE_SEPOLIA_CHAMBER_IMPL,
      sepoliaDeploymentAddresses.chamberImplementation,
      SEPOLIA_CHAMBER_IMPLEMENTATION,
    ),
    mockERC20: addressFromEnv(import.meta.env.VITE_SEPOLIA_MOCK_ERC20, sepoliaDeploymentAddresses.mockERC20),
    mockERC721: addressFromEnv(import.meta.env.VITE_SEPOLIA_MOCK_ERC721, sepoliaDeploymentAddresses.mockERC721),
  },
  // Ethereum — env overrides, then mainnet.txt. TBD parses to zero (unset).
  // Do not invent Factory/Chamber addresses; do not copy Sepolia onto chain 1.
  mainnet: {
    registry: addressFromEnv(import.meta.env.VITE_MAINNET_REGISTRY, mainnetDeploymentAddresses.registry),
    factory: addressFromEnv(import.meta.env.VITE_MAINNET_FACTORY, mainnetDeploymentAddresses.factory),
    chamberImplementation: addressFromEnv(
      import.meta.env.VITE_MAINNET_CHAMBER_IMPL,
      mainnetDeploymentAddresses.chamberImplementation,
    ),
    mockERC20: ZERO_ADDRESS as `0x${string}`,
    mockERC721: ZERO_ADDRESS as `0x${string}`,
  },
  base: {
    registry: addressFromEnv(import.meta.env.VITE_BASE_REGISTRY),
    factory: addressFromEnv(import.meta.env.VITE_BASE_FACTORY),
    chamberImplementation: addressFromEnv(import.meta.env.VITE_BASE_CHAMBER_IMPL),
    mockERC20: ZERO_ADDRESS as `0x${string}`,
    mockERC721: ZERO_ADDRESS as `0x${string}`,
  },
  // Base Sepolia (84532) — committed defaults from base-sepolia.txt. Env overrides.
  // Ethereum Sepolia stays on `sepolia` / sepolia.txt.
  baseSepolia: {
    registry: ZERO_ADDRESS as `0x${string}`,
    factory: addressFromEnv(
      import.meta.env.VITE_BASE_SEPOLIA_FACTORY,
      baseSepoliaDeploymentAddresses.factory,
    ),
    chamberImplementation: addressFromEnv(
      import.meta.env.VITE_BASE_SEPOLIA_CHAMBER_IMPL,
      baseSepoliaDeploymentAddresses.chamberImplementation,
    ),
    mockERC20: TESTNET_DEPLOYMENTS[baseSepolia.id]!.mockERC20,
    mockERC721: TESTNET_DEPLOYMENTS[baseSepolia.id]!.mockERC721,
  },
  // Arbitrum Sepolia (421614) and OP Sepolia (11155420) — committed defaults
  // from arbitrum-sepolia.txt / op-sepolia.txt (`make deploy-testnet`). Env overrides.
  arbitrumSepolia: {
    registry: ZERO_ADDRESS as `0x${string}`,
    factory: addressFromEnv(
      import.meta.env.VITE_ARBITRUM_SEPOLIA_FACTORY,
      TESTNET_DEPLOYMENTS[arbitrumSepolia.id]!.factory,
    ),
    chamberImplementation: addressFromEnv(
      import.meta.env.VITE_ARBITRUM_SEPOLIA_CHAMBER_IMPL,
      TESTNET_DEPLOYMENTS[arbitrumSepolia.id]!.chamberImplementation,
    ),
    mockERC20: TESTNET_DEPLOYMENTS[arbitrumSepolia.id]!.mockERC20,
    mockERC721: TESTNET_DEPLOYMENTS[arbitrumSepolia.id]!.mockERC721,
  },
  opSepolia: {
    registry: ZERO_ADDRESS as `0x${string}`,
    factory: addressFromEnv(
      import.meta.env.VITE_OP_SEPOLIA_FACTORY,
      TESTNET_DEPLOYMENTS[optimismSepolia.id]!.factory,
    ),
    chamberImplementation: addressFromEnv(
      import.meta.env.VITE_OP_SEPOLIA_CHAMBER_IMPL,
      TESTNET_DEPLOYMENTS[optimismSepolia.id]!.chamberImplementation,
    ),
    mockERC20: TESTNET_DEPLOYMENTS[optimismSepolia.id]!.mockERC20,
    mockERC721: TESTNET_DEPLOYMENTS[optimismSepolia.id]!.mockERC721,
  },
  arbitrum: {
    registry: addressFromEnv(import.meta.env.VITE_ARBITRUM_REGISTRY),
    factory: addressFromEnv(import.meta.env.VITE_ARBITRUM_FACTORY),
    chamberImplementation: addressFromEnv(import.meta.env.VITE_ARBITRUM_CHAMBER_IMPL),
    mockERC20: ZERO_ADDRESS as `0x${string}`,
    mockERC721: ZERO_ADDRESS as `0x${string}`,
  },
  // Localhost - auto-populated from deployments.json via `make deploy-anvil-all`
  localhost: {
    registry: addressFromEnv(localDeployments.registry, import.meta.env.VITE_LOCALHOST_REGISTRY),
    factory: addressFromEnv(
      (localDeployments as { factory?: string }).factory,
      import.meta.env.VITE_LOCALHOST_FACTORY,
    ),
    chamberImplementation: addressFromEnv(localDeployments.chamberImplementation),
    mockERC20: addressFromEnv(localDeployments.mockERC20),
    mockERC721: addressFromEnv(localDeployments.mockERC721),
  },
} as const

// Export localhost deployment info for convenience
export const localhostDeployment = {
  ...localDeployments,
  registry: CONTRACT_ADDRESSES.localhost.registry,
  factory: CONTRACT_ADDRESSES.localhost.factory,
  chamberImplementation: CONTRACT_ADDRESSES.localhost.chamberImplementation,
  mockERC20: CONTRACT_ADDRESSES.localhost.mockERC20,
  mockERC721: CONTRACT_ADDRESSES.localhost.mockERC721,
}

export function getContractAddresses(chainId: number) {
  // If the active chain matches the local deployments chain, prioritize local addresses
  // This allows overriding Sepolia testnet with local Sepolia fork addresses
  if (chainId === localDeployments.chainId) {
    return CONTRACT_ADDRESSES.localhost
  }

  switch (chainId) {
    case 1:
      // Unset / TBD → zero addresses. Never Sepolia. See deployments/mainnet.txt.
      return CONTRACT_ADDRESSES.mainnet
    case 11155111:
      return CONTRACT_ADDRESSES.sepolia
    case 8453:
      return CONTRACT_ADDRESSES.base
    case 84532:
      return CONTRACT_ADDRESSES.baseSepolia
    case 42161:
      return CONTRACT_ADDRESSES.arbitrum
    case 421614:
      return CONTRACT_ADDRESSES.arbitrumSepolia
    case 11155420:
      return CONTRACT_ADDRESSES.opSepolia
    case 31337:
      return CONTRACT_ADDRESSES.localhost
    default:
      return null
  }
}

// Helper to check if we have valid addresses configured (factory or registry)
export function hasValidAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId)
  if (!addresses) return false
  return isNonZeroAddress(addresses.factory) || isNonZeroAddress(addresses.registry)
}

/** Display name for wallet/config banners. Matches Dashboard copy. */
export function getNetworkName(chainId: number): string {
  return networkNameFromId(chainId, config.chains.find((chain) => chain.id === chainId)?.name)
}

/** RainbowKit/wagmi chains that already have a Factory or Registry address. */
export function getConfiguredChainIds(): number[] {
  const seen = new Set<number>()
  const ids: number[] = []
  for (const chain of config.chains) {
    if (seen.has(chain.id) || !hasValidAddresses(chain.id)) continue
    seen.add(chain.id)
    ids.push(chain.id)
  }
  return ids
}

/**
 * Prefer Base Sepolia when that Factory is configured, otherwise the first
 * wagmi chain that has a Factory or Registry.
 */
export function getPreferredSupportedChainId(): number | undefined {
  return pickPreferredSupportedChainId(getConfiguredChainIds(), baseSepolia.id)
}

/** Supported testnets in display order, whether or not a Factory is deployed yet. */
export function getTestnetChainIds(): number[] {
  return TESTNET_CHAIN_IDS.filter((id) => config.chains.some((chain) => chain.id === id))
}

/**
 * Every Factory to scan for `ChamberCreated` on this chain: the current one
 * plus older ones still listed in the chain's deployments file, so chambers
 * made before a Factory redeploy stay visible.
 */
export function getDiscoveryFactoryAddresses(chainId: number): `0x${string}`[] {
  const current = getContractAddresses(chainId)?.factory
  const older = chainId === localDeployments.chainId ? [] : (TESTNET_DEPLOYMENTS[chainId]?.factories ?? [])
  const out: `0x${string}`[] = []
  const seen = new Set<string>()
  for (const addr of [current, ...older]) {
    if (!addr || !isNonZeroAddress(addr)) continue
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(addr)
  }
  return out
}
