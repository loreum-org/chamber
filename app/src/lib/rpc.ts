import { arbitrum, base, mainnet, sepolia } from 'wagmi/chains'
import localDeployments from '@/contracts/deployments.json'

const LOCAL_CHAIN_ID = localDeployments.chainId || 31337

/** Per-chain RPC URL from env (full HTTPS endpoint, not an API key). */
const RPC_URL_ENV: Record<number, string | undefined> = {
  [mainnet.id]: import.meta.env.VITE_MAINNET_RPC_URL,
  [sepolia.id]: import.meta.env.VITE_SEPOLIA_RPC_URL,
  [base.id]: import.meta.env.VITE_BASE_RPC_URL,
  [arbitrum.id]: import.meta.env.VITE_ARBITRUM_RPC_URL,
}

/**
 * Custom JSON-RPC URL for a chain when set in `.env`.
 * Takes precedence over Alchemy-derived RPC in wagmi transports.
 */
export function getCustomRpcUrlFromEnv(chainId: number): string | undefined {
  if (chainId === LOCAL_CHAIN_ID) {
    const local = import.meta.env.VITE_LOCALHOST_RPC_URL?.trim()
    if (local) return local
    return undefined
  }
  const url = RPC_URL_ENV[chainId]?.trim()
  return url || undefined
}

export function hasCustomRpcUrl(chainId: number): boolean {
  return getCustomRpcUrlFromEnv(chainId) != null
}
