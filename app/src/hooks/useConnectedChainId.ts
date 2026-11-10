import { useAccount, useChainId } from 'wagmi'

/**
 * Chain the wallet is actually on.
 *
 * Wagmi's `useChainId` stays on the last *configured* chain when the connector
 * is on a chain this app no longer offers (`syncConnectedChain` ignores it).
 * Callers that decide whether to prompt for a switch must read the connector.
 */
export function useConnectedChainId(): number {
  const { chainId: accountChainId, isConnected } = useAccount()
  const configuredChainId = useChainId()
  if (isConnected && typeof accountChainId === 'number') return accountChainId
  return configuredChainId
}
