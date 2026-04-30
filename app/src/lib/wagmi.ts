import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, base, arbitrum, Chain } from 'wagmi/chains'
import localDeployments from '@/contracts/deployments.json'

// Use the chain ID from deployments.json so that localhost accurately matches Anvil forks
const localChainId = localDeployments.chainId || 31337

// Define localhost chain explicitly with correct chain ID
const localhost: Chain = {
  id: localChainId,
  name: localChainId === 11155111 ? 'Local Sepolia Fork' : 'Localhost',
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
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000000000000000'

// Warn if using placeholder project ID (will cause WalletConnect API errors but won't break the app)
if (!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || walletConnectProjectId === '00000000000000000000000000000000000000000000') {
  console.warn(
    '⚠️ WalletConnect Project ID not configured. Wallet connections may not work properly.\n' +
    'Get a free project ID at https://cloud.walletconnect.com and add it to your .env file:\n' +
    'VITE_WALLETCONNECT_PROJECT_ID=your_project_id'
  )
}

export const config = getDefaultConfig({
  appName: 'Chamber',
  projectId: walletConnectProjectId,
  chains: [mainnet, sepolia, base, arbitrum, localhost],
  ssr: false,
})

// Contract addresses - localhost uses auto-generated deployments.json from `make deploy-anvil-all`
// Testnet/mainnet addresses can be overridden with environment variables
export const CONTRACT_ADDRESSES = {
  // Sepolia testnet addresses
  sepolia: {
    registry: (import.meta.env.VITE_SEPOLIA_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_SEPOLIA_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    mockERC20: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    mockERC721: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  // Mainnet addresses (when deployed)
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
      // Default to localhost for development
      return CONTRACT_ADDRESSES.localhost
  }
}

// Helper to check if we have valid addresses configured
export function hasValidAddresses(chainId: number): boolean {
  const addresses = getContractAddresses(chainId)
  return addresses.registry !== '0x0000000000000000000000000000000000000000'
}
