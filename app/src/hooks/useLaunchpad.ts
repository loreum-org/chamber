import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { liquidityLauncherAbi, lbpStrategyAbi, ccaAbi } from '@/contracts/abis'
import { useState, useEffect } from 'react'

export function useChamberAuction(chamberAddress: `0x${string}` | undefined, tokenAddress: `0x${string}` | undefined) {
  const [strategyAddress, setStrategyAddress] = useState<`0x${string}` | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const publicClient = usePublicClient()

  useEffect(() => {
    async function fetchAuction() {
      if (!chamberAddress || !tokenAddress || !publicClient) return
      setIsLoading(true)
      try {
        // Find StrategyDeployed events where token matches our token
        // Without indexed fields or knowing the exact Liquidity Launcher address, 
        // we assume a known launcher address or we scan logs across the network.
        // For this demo/feature, we will assume a dummy address or the user will input it.
        // Actually, LiquidityLauncher address needs to be known. 
        // Let's assume there is a deployment config for it, but if not we can just leave it to be configured.
        
        // For the sake of the UX, we might just store the deployed strategy in a local state 
        // or check recent transactions from the chamber.
        // As a fallback, we'll try to find any StrategyDeployed event for the token.
        
        const logs = await publicClient.getLogs({
          event: {
            type: 'event',
            name: 'TokenDistributed',
            inputs: [
              { type: 'address', name: 'tokenAddress', indexed: true },
              { type: 'address', name: 'distributionContract', indexed: true },
              { type: 'uint256', name: 'amount', indexed: false }
            ]
          },
          args: {
            tokenAddress: tokenAddress
          },
          fromBlock: 'earliest'
        })
        
        if (logs && logs.length > 0) {
          // Get the most recent one
          const latestLog = logs[logs.length - 1]
          if (latestLog.args.distributionContract) {
            setStrategyAddress(latestLog.args.distributionContract as `0x${string}`)
          }
        }
      } catch (err) {
        console.error('Error fetching auction logs', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAuction()
  }, [chamberAddress, tokenAddress, publicClient])

  return { strategyAddress, isLoading }
}

export function useAuctionStatus(strategyAddress: `0x${string}` | undefined) {
  // Read the auction address from the LBP strategy
  const { data: auctionAddress } = useReadContract({
    address: strategyAddress,
    abi: lbpStrategyAbi,
    functionName: 'auction',
    query: { enabled: !!strategyAddress },
  })

  const { data: clearingPrice, refetch: refetchPrice } = useReadContract({
    address: auctionAddress,
    abi: ccaAbi,
    functionName: 'clearingPrice',
    query: { enabled: !!auctionAddress },
  })

  const { data: tokensRemaining, refetch: refetchTokens } = useReadContract({
    address: auctionAddress,
    abi: ccaAbi,
    functionName: 'tokensRemaining',
    query: { enabled: !!auctionAddress },
  })

  const { data: fundsRaised, refetch: refetchFunds } = useReadContract({
    address: auctionAddress,
    abi: ccaAbi,
    functionName: 'fundsRaised',
    query: { enabled: !!auctionAddress },
  })

  const { data: claimBlock } = useReadContract({
    address: auctionAddress,
    abi: ccaAbi,
    functionName: 'claimBlock',
    query: { enabled: !!auctionAddress },
  })

  return {
    auctionAddress,
    clearingPrice,
    tokensRemaining,
    fundsRaised,
    claimBlock,
    refetch: () => {
      refetchPrice()
      refetchTokens()
      refetchFunds()
    }
  }
}

export function useBuyTokens(auctionAddress: `0x${string}` | undefined) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const bid = async (amountEth: bigint) => {
    if (!auctionAddress) return
    return writeContractAsync({
      address: auctionAddress,
      abi: ccaAbi,
      functionName: 'bid',
      args: [amountEth],
      value: amountEth,
    })
  }

  return { bid, isPending, isConfirming, isSuccess, error, hash }
}

export function useMigrateLiquidity(strategyAddress: `0x${string}` | undefined) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const migrate = async () => {
    if (!strategyAddress) return
    return writeContractAsync({
      address: strategyAddress,
      abi: lbpStrategyAbi,
      functionName: 'migrate',
    })
  }

  return { migrate, isPending, isConfirming, isSuccess, error, hash }
}

export function useClaimTokens(auctionAddress: `0x${string}` | undefined) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claim = async () => {
    if (!auctionAddress) return
    return writeContractAsync({
      address: auctionAddress,
      abi: ccaAbi,
      functionName: 'claim',
    })
  }

  return { claim, isPending, isConfirming, isSuccess, error, hash }
}
