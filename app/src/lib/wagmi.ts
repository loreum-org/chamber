import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { mainnet, sepolia, base, arbitrum, Chain } from 'wagmi/chains'
import localDeployments from '@/contracts/deployments.json'
import { alchemySupportsChain, getAlchemyApiKeyFromEnv, getAlchemyV2RpcUrl } from '@/lib/alchemy'
import { getCustomRpcUrlFromEnv, hasCustomRpcUrl } from '@/lib/rpc'

const productionApp = import.meta.env.PROD

const ZERO_REGISTRY = '0x0000000000000000000000000000000000000000'

/** Mainnet is only offered when `VITE_MAINNET_REGISTRY` is set (same rule as `hasValidAddresses(1)`). */
const mainnetRegistryRaw = import.meta.env.VITE_MAINNET_REGISTRY?.trim() ?? ''
export const isMainnetConfigured =
  mainnetRegistryRaw !== '' &&
  mainnetRegistryRaw.toLowerCase() !== ZERO_REGISTRY

// Use the chain ID from deployments.json so that localhost accurately matches Anvil forks (dev only)
export const LOCAL_CHAIN_ID = localDeployments.chainId || 31337

const alchemyApiKey = getAlchemyApiKeyFromEnv()

/** Public RPC fallbacks when no custom URL or Alchemy key is set (CSP allowlisted). */
const PUBLIC_RPC: Record<number, string> = {
  [mainnet.id]: 'https://eth.llamarpc.com',
  [sepolia.id]: 'https://rpc.sepolia.org',
  [base.id]: 'https://mainnet.base.org',
  [arbitrum.id]: 'https://arb1.arbitrum.io/rpc',
}

function rpcHttpUrl(chainId: number, publicUrl: string): string {
  const custom = getCustomRpcUrlFromEnv(chainId)
  if (custom) return custom
  if (alchemyApiKey && alchemySupportsChain(chainId)) {
    return getAlchemyV2RpcUrl(chainId, alchemyApiKey) ?? publicUrl
  }
  return publicUrl
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

if (import.meta.env.DEV) {
  if (hasCustomRpcUrl(mainnet.id) || hasCustomRpcUrl(sepolia.id)) {
    console.info('[wagmi] Using VITE_*_RPC_URL for configured chains')
  } else if (alchemyApiKey) {
    console.info('[wagmi] Alchemy RPC enabled for Ethereum, Sepolia, Base, Arbitrum')
  }
}

/** Production: Sepolia, plus Mainnet only when `VITE_MAINNET_REGISTRY` is set. Dev adds Base, Arbitrum, local. */
export const config = productionApp
  ? isMainnetConfigured
    ? getDefaultConfig({
        appName: 'Chamber',
        projectId: walletConnectProjectId,
        chains: [mainnet, sepolia],
        ssr: false,
        transports: {
          [mainnet.id]: http(rpcHttpUrl(mainnet.id, PUBLIC_RPC[mainnet.id])),
          [sepolia.id]: http(rpcHttpUrl(sepolia.id, PUBLIC_RPC[sepolia.id])),
        },
      })
    : getDefaultConfig({
        appName: 'Chamber',
        projectId: walletConnectProjectId,
        chains: [sepolia],
        ssr: false,
        transports: {
          [sepolia.id]: http(rpcHttpUrl(sepolia.id, PUBLIC_RPC[sepolia.id])),
        },
      })
  : isMainnetConfigured
    ? getDefaultConfig({
        appName: 'Chamber',
        projectId: walletConnectProjectId,
        chains: [mainnet, sepolia, base, arbitrum, localhost],
        ssr: false,
        transports: {
          [mainnet.id]: http(rpcHttpUrl(mainnet.id, PUBLIC_RPC[mainnet.id])),
          [sepolia.id]: http(rpcHttpUrl(sepolia.id, PUBLIC_RPC[sepolia.id])),
          [base.id]: http(rpcHttpUrl(base.id, PUBLIC_RPC[base.id])),
          [arbitrum.id]: http(rpcHttpUrl(arbitrum.id, PUBLIC_RPC[arbitrum.id])),
          [localhost.id]: http(localhost.rpcUrls.default.http[0]),
        },
      })
    : getDefaultConfig({
        appName: 'Chamber',
        projectId: walletConnectProjectId,
        chains: [sepolia, base, arbitrum, localhost],
        ssr: false,
        transports: {
          [sepolia.id]: http(rpcHttpUrl(sepolia.id, PUBLIC_RPC[sepolia.id])),
          [base.id]: http(rpcHttpUrl(base.id, PUBLIC_RPC[base.id])),
          [arbitrum.id]: http(rpcHttpUrl(arbitrum.id, PUBLIC_RPC[arbitrum.id])),
          [localhost.id]: http(localhost.rpcUrls.default.http[0]),
        },
      })

// Contract addresses - localhost uses auto-generated deployments.json from `make deploy-anvil-all`
// Testnet/mainnet addresses can be overridden with environment variables
export const CONTRACT_ADDRESSES = {
  // Sepolia testnet addresses
  sepolia: {
    registry: (import.meta.env.VITE_SEPOLIA_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_SEPOLIA_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC20: (import.meta.env.VITE_SEPOLIA_MOCK_ERC20 ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC721: (import.meta.env.VITE_SEPOLIA_MOCK_ERC721 ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },
  mainnet: {
    registry: (import.meta.env.VITE_MAINNET_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_MAINNET_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC20: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    mockERC721: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  base: {
    registry: (import.meta.env.VITE_BASE_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_BASE_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC20: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    mockERC721: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  arbitrum: {
    registry: (import.meta.env.VITE_ARBITRUM_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_ARBITRUM_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC20: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    mockERC721: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  // Localhost - auto-populated from deployments.json via `make deploy-anvil-all`
  localhost: {
    registry: localDeployments.registry as `0x${string}`,
    chamberImplementation: localDeployments.chamberImplementation as `0x${string}`,
    mockERC20: localDeployments.mockERC20 as `0x${string}`,
    mockERC721: localDeployments.mockERC721 as `0x${string}`,
  },
} as const

// Export localhost deployment info for convenience
export const localhostDeployment = {
  ...localDeployments,
  registry: localDeployments.registry as `0x${string}`,
  chamberImplementation: localDeployments.chamberImplementation as `0x${string}`,
  mockERC20: localDeployments.mockERC20 as `0x${string}`,
  mockERC721: localDeployments.mockERC721 as `0x${string}`,
}

export function getContractAddresses(chainId: number) {
  // If the active chain matches the local deployments chain, prioritize local addresses
  // This allows overriding Sepolia testnet with local Sepolia fork addresses
  if (chainId === localDeployments.chainId) {
    return CONTRACT_ADDRESSES.localhost
  }

  switch (chainId) {
    case 1:
      return CONTRACT_ADDRESSES.mainnet
    case 11155111:
      return CONTRACT_ADDRESSES.sepolia
    case 8453:
      return CONTRACT_ADDRESSES.base
    case 42161:
      return CONTRACT_ADDRESSES.arbitrum
    case 31337:
      return CONTRACT_ADDRESSES.localhost
    default:
      return null
  }
}

// Helper to check if we have valid addresses configured
export function hasValidAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId)
  if (!addresses) return false
  return addresses.registry !== '0x0000000000000000000000000000000000000000'
}
