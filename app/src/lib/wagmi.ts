import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, Chain } from 'wagmi/chains'

// Define localhost chain explicitly with correct chain ID
const localhost: Chain = {
  id: 31337,
  name: 'Localhost',
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
  chains: [mainnet, sepolia, localhost],
  ssr: false,
})

// Contract addresses - can be overridden with environment variables
// For localhost, update these after deploying contracts to Anvil
export const CONTRACT_ADDRESSES = {
  // Sepolia testnet addresses
  sepolia: {
    registry: (import.meta.env.VITE_SEPOLIA_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_SEPOLIA_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },
  // Mainnet addresses (when deployed)
  mainnet: {
    registry: (import.meta.env.VITE_MAINNET_REGISTRY || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_MAINNET_CHAMBER_IMPL || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  },
  // Localhost for development - update these after running `make deploy-anvil contract=Registry`
  localhost: {
    registry: (import.meta.env.VITE_LOCALHOST_REGISTRY || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as `0x${string}`,
    chamberImplementation: (import.meta.env.VITE_LOCALHOST_CHAMBER_IMPL || 'xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`,
  },
} as const

export function getContractAddresses(chainId: number) {
  switch (chainId) {
    case 1:
      return CONTRACT_ADDRESSES.mainnet
    case 11155111:
      return CONTRACT_ADDRESSES.sepolia
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
