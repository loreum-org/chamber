import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract, useAccount } from 'wagmi'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import type { Transaction, BoardMember, SeatUpdate } from '@/types'

// ERC20 Allowance hook
export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  ownerAddress: `0x${string}` | undefined,
  spenderAddress: `0x${string}` | undefined
) {
  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    query: { enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress },
  })

  return { allowance: allowance as bigint | undefined, refetch }
}

// ERC20 Approve hook
export function useTokenApprove(tokenAddress: `0x${string}` | undefined) {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = async (spender: `0x${string}`, amount: bigint) => {
    if (!tokenAddress) return
    return writeContractAsync({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return { approve, isPending, isConfirming, isSuccess, error, hash }
}

// ERC20 Balance hook
export function useTokenBalance(tokenAddress: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  const { data: balance, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!tokenAddress && !!account },
  })

  return { balance: balance as bigint | undefined, refetch }
}

export function useChamberInfo(chamberAddress: `0x${string}` | undefined) {
  // Validate address before making queries
  const isValidAddress = chamberAddress && 
    chamberAddress !== '0x0000000000000000000000000000000000000000' &&
    chamberAddress.startsWith('0x') &&
    chamberAddress.length === 42

  const { data: name } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'name',
    query: { 
      enabled: !!isValidAddress,
      retry: 1, // Reduce retries to avoid stack overflow
      retryDelay: 1000,
    },
  })

  const { data: symbol } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'symbol',
    query: { 
      enabled: !!isValidAddress,
      retry: 1, // Reduce retries to avoid stack overflow
      retryDelay: 1000,
    },
  })

  const { data: totalAssets } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'totalAssets',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: totalSupply } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'totalSupply',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: seats } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'getSeats',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: quorum } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'getQuorum',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: directors } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'getDirectors',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: transactionCount } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'getTransactionCount',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: assetToken } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'asset',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: nftToken } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'nft',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  const { data: version } = useReadContract({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    functionName: 'version',
    query: { 
      enabled: !!isValidAddress,
      retry: 1,
      retryDelay: 1000,
    },
  })

  return {
    name: name as string | undefined,
    symbol: symbol as string | undefined,
    totalAssets: totalAssets as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    seats: seats ? Number(seats) : undefined,
    quorum: quorum ? Number(quorum) : undefined,
    directors: directors as `0x${string}`[] | undefined,
    transactionCount: transactionCount ? Number(transactionCount) : undefined,
    assetToken: assetToken as `0x${string}` | undefined,
    nftToken: nftToken as `0x${string}` | undefined,
    version: version as string | undefined,
  }
}

export function useChamberBalance(chamberAddress: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  const { data: balance, refetch } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!chamberAddress && !!account },
  })

  return { balance: balance as bigint | undefined, refetch }
}

export function useBoardMembers(chamberAddress: `0x${string}` | undefined, count: number = 20) {
  const { data, refetch } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'getTop',
    args: [BigInt(count)],
    query: { enabled: !!chamberAddress },
  })

  const members: BoardMember[] = []
  if (data) {
    const [tokenIds, amounts] = data as [bigint[], bigint[]]
    for (let i = 0; i < tokenIds.length; i++) {
      members.push({
        tokenId: tokenIds[i],
        amount: amounts[i],
        next: 0n,
        prev: 0n,
        rank: i + 1,
      })
    }
  }

  return { members, refetch }
}

export function useTransaction(chamberAddress: `0x${string}` | undefined, transactionId: number) {
  const { data, refetch } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'getTransaction',
    args: [BigInt(transactionId)],
    query: { enabled: !!chamberAddress && transactionId >= 0 },
  })

  let transaction: Transaction | undefined
  if (data) {
    const [executed, confirmations, target, value, txData] = data as [boolean, number, `0x${string}`, bigint, `0x${string}`]
    transaction = {
      id: transactionId,
      executed,
      confirmations,
      target,
      value,
      data: txData,
    }
  }

  return { transaction, refetch }
}

export function useSeatUpdate(chamberAddress: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'getSeatUpdate',
    query: { enabled: !!chamberAddress },
  })

  let seatUpdate: SeatUpdate | undefined
  if (data) {
    const [proposedSeats, timestamp, requiredQuorum, supporters] = data as [bigint, bigint, bigint, bigint[]]
    seatUpdate = {
      proposedSeats,
      timestamp,
      requiredQuorum,
      supporters,
    }
  }

  return { seatUpdate, refetch }
}

export function useDelegations(chamberAddress: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  const { data, refetch } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'getDelegations',
    args: account ? [account] : undefined,
    query: { enabled: !!chamberAddress && !!account },
  })

  const delegations: { tokenId: bigint; amount: bigint }[] = []
  if (data) {
    const [tokenIds, amounts] = data as [bigint[], bigint[]]
    for (let i = 0; i < tokenIds.length; i++) {
      delegations.push({
        tokenId: tokenIds[i],
        amount: amounts[i],
      })
    }
  }

  return { delegations, refetch }
}

// Write hooks
export function useSubmitTransaction(chamberAddress: `0x${string}` | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const submit = async (tokenId: bigint, target: `0x${string}`, value: bigint, data: `0x${string}`) => {
    if (!chamberAddress) return
    writeContract({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'submitTransaction',
      args: [tokenId, target, value, data],
    })
  }

  return { submit, isPending, isConfirming, isSuccess, error, hash }
}

export function useConfirmTransaction(chamberAddress: `0x${string}` | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const confirm = async (tokenId: bigint, transactionId: bigint) => {
    if (!chamberAddress) return
    writeContract({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'confirmTransaction',
      args: [tokenId, transactionId],
    })
  }

  return { confirm, isPending, isConfirming, isSuccess, error, hash }
}

export function useExecuteTransaction(chamberAddress: `0x${string}` | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const execute = async (tokenId: bigint, transactionId: bigint) => {
    if (!chamberAddress) return
    writeContract({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'executeTransaction',
      args: [tokenId, transactionId],
    })
  }

  return { execute, isPending, isConfirming, isSuccess, error, hash }
}

/**
 * Hook for delegating shares to an NFT token ID.
 * Uses simulation to validate the transaction before sending.
 */
export function useDelegate(chamberAddress: `0x${string}` | undefined) {
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const delegate = async (tokenId: bigint, amount: bigint) => {
    if (!chamberAddress || !userAddress) {
      throw new Error('Chamber address or user address not available')
    }
    
    // The writeContractAsync will automatically simulate before sending
    return writeContractAsync({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'delegate',
      args: [tokenId, amount],
    })
  }

  return { delegate, isPending, isConfirming, isSuccess, error: writeError, hash }
}

/**
 * Hook for simulating a delegate call to check if it will succeed.
 * Use this to show validation errors before the user clicks submit.
 */
export function useSimulateDelegate(
  chamberAddress: `0x${string}` | undefined,
  tokenId: bigint | undefined,
  amount: bigint | undefined
) {
  const { address: userAddress } = useAccount()
  
  const { data, error, isLoading, refetch } = useSimulateContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'delegate',
    args: tokenId !== undefined && amount !== undefined ? [tokenId, amount] : undefined,
    query: {
      enabled: !!chamberAddress && !!userAddress && tokenId !== undefined && amount !== undefined && amount > 0n,
    },
  })

  return {
    isValid: !!data && !error,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for undelegating shares from an NFT token ID.
 * Uses simulation to validate the transaction before sending.
 */
export function useUndelegate(chamberAddress: `0x${string}` | undefined) {
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const undelegate = async (tokenId: bigint, amount: bigint) => {
    if (!chamberAddress || !userAddress) {
      throw new Error('Chamber address or user address not available')
    }
    
    return writeContractAsync({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'undelegate',
      args: [tokenId, amount],
    })
  }

  return { undelegate, isPending, isConfirming, isSuccess, error: writeError, hash }
}

/**
 * Hook for simulating an undelegate call to check if it will succeed.
 */
export function useSimulateUndelegate(
  chamberAddress: `0x${string}` | undefined,
  tokenId: bigint | undefined,
  amount: bigint | undefined
) {
  const { address: userAddress } = useAccount()
  
  const { data, error, isLoading, refetch } = useSimulateContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'undelegate',
    args: tokenId !== undefined && amount !== undefined ? [tokenId, amount] : undefined,
    query: {
      enabled: !!chamberAddress && !!userAddress && tokenId !== undefined && amount !== undefined && amount > 0n,
    },
  })

  return {
    isValid: !!data && !error,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for depositing assets into the chamber.
 * Uses simulation to validate the transaction before sending.
 */
export function useDeposit(chamberAddress: `0x${string}` | undefined) {
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const deposit = async (assets: bigint, receiver: `0x${string}`) => {
    if (!chamberAddress || !userAddress) {
      throw new Error('Chamber address or user address not available')
    }
    
    return writeContractAsync({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    })
  }

  return { deposit, isPending, isConfirming, isSuccess, error: writeError, hash }
}

/**
 * Hook for simulating a deposit call to check if it will succeed.
 */
export function useSimulateDeposit(
  chamberAddress: `0x${string}` | undefined,
  assets: bigint | undefined,
  receiver: `0x${string}` | undefined
) {
  const { address: userAddress } = useAccount()
  
  const { data, error, isLoading, refetch } = useSimulateContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'deposit',
    args: assets !== undefined && receiver ? [assets, receiver] : undefined,
    query: {
      enabled: !!chamberAddress && !!userAddress && assets !== undefined && assets > 0n && !!receiver,
    },
  })

  return {
    isValid: !!data && !error,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for withdrawing assets from the chamber.
 * Uses simulation to validate the transaction before sending.
 */
export function useWithdraw(chamberAddress: `0x${string}` | undefined) {
  const { address: userAddress } = useAccount()
  const { writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdraw = async (assets: bigint, receiver: `0x${string}`, owner: `0x${string}`) => {
    if (!chamberAddress || !userAddress) {
      throw new Error('Chamber address or user address not available')
    }
    
    return writeContractAsync({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'withdraw',
      args: [assets, receiver, owner],
    })
  }

  return { withdraw, isPending, isConfirming, isSuccess, error: writeError, hash }
}

/**
 * Hook for simulating a withdraw call to check if it will succeed.
 */
export function useSimulateWithdraw(
  chamberAddress: `0x${string}` | undefined,
  assets: bigint | undefined,
  receiver: `0x${string}` | undefined,
  owner: `0x${string}` | undefined
) {
  const { address: userAddress } = useAccount()
  
  const { data, error, isLoading, refetch } = useSimulateContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'withdraw',
    args: assets !== undefined && receiver && owner ? [assets, receiver, owner] : undefined,
    query: {
      enabled: !!chamberAddress && !!userAddress && assets !== undefined && assets > 0n && !!receiver && !!owner,
    },
  })

  return {
    isValid: !!data && !error,
    error,
    isLoading,
    refetch,
  }
}
