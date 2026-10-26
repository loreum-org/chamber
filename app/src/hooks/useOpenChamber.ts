import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useSwitchChain } from 'wagmi'

/**
 * Open a chamber page, switching the wallet to the chamber's chain first.
 * If the switch is refused the page still opens and its gate offers the switch.
 */
export function useOpenChamber() {
  const navigate = useNavigate()
  const { chainId: walletChainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  return useCallback(
    async (address: `0x${string}`, chainId: number, path = '') => {
      if (isConnected && walletChainId !== chainId) {
        try {
          await switchChainAsync({ chainId })
        } catch {
          // Wallet refused or does not know the chain; the route gate explains.
        }
      }
      navigate(`/chamber/${address}${path}`)
    },
    [isConnected, walletChainId, switchChainAsync, navigate],
  )
}
