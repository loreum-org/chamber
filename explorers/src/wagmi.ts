import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { fallback, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'

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

/** Public RPC fallbacks when env RPC URLs are unset. */
const PUBLIC_RPC: Record<number, string> = {
  [mainnet.id]: 'https://eth.llamarpc.com',
  [sepolia.id]: 'https://ethereum-sepolia-rpc.publicnode.com',
}

function chainTransport(chainId: number) {
  const envKey = chainId === mainnet.id ? 'VITE_MAINNET_RPC_URL' : 'VITE_SEPOLIA_RPC_URL'
  const envUrl = import.meta.env[envKey] as string | undefined
  const publicUrl = PUBLIC_RPC[chainId]

  if (envUrl?.trim()) {
    return fallback([http(envUrl.trim()), http(publicUrl)])
  }
  return http(publicUrl)
}

/** Receipt/block polling cadence. One Ethereum slot. */
const POLLING_INTERVAL_MS = 12_000

/** Explorers supports only Ethereum mainnet and Sepolia. */
export const config = getDefaultConfig({
  appName: 'Loreum Explorers',
  projectId: walletConnectProjectId,
  chains: [mainnet, sepolia],
  ssr: false,
  pollingInterval: POLLING_INTERVAL_MS,
  transports: {
    [mainnet.id]: chainTransport(mainnet.id),
    [sepolia.id]: chainTransport(sepolia.id),
  },
})

export { mainnet, sepolia }
