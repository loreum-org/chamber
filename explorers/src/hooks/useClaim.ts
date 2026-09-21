import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'

export type ClaimError = 'user_rejected' | 'price_changed' | 'wallet_limit' | 'sold_out' | 'unknown'

export interface ClaimResult {
  hash: `0x${string}` | undefined
  receipt: unknown
  claim: (amount: number) => Promise<void>
  claimError: ClaimError | undefined
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
}

/**
 * Write path: re-read mintCost → value = amount × mintCost → writeContract → wait → invalidate.
 * Classifies errors: user_rejected, price_changed, wallet_limit, sold_out, unknown.
 */
export function useClaim(): ClaimResult {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const contractAddress = getLoreumNftAddress(chainId)
  const queryClient = useQueryClient()

  // Fresh mintCost read (avoids stale value)
  const { data: mintCost } = useReadContract({
    address: contractAddress!,
    abi: loreumNftAbi,
    functionName: 'mintCost',
    query: { enabled: contractAddress !== undefined },
  })

  const write = useWriteContract()
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    query: { enabled: write.data !== undefined },
  })

  // Invalidate all LoreumNFT reads after confirmed tx
  if (receipt.isSuccess && receipt.data) {
    queryClient.invalidateQueries({ queryKey: ['tokenMetadata'] })
    // Invalidate all readContracts queries for this chain/address
    queryClient.invalidateQueries()
  }

  async function claim(amount: number) {
    if (!contractAddress || !account || mintCost === undefined) {
      throw new Error('Not ready to claim')
    }

    const value = (mintCost as bigint) * BigInt(amount)

    try {
      await write.writeContractAsync({
        address: contractAddress,
        abi: loreumNftAbi,
        functionName: 'mint',
        args: [account, BigInt(amount)],
        value,
      })
    } catch (err) {
      throw classifyClaimError(err)
    }
  }

  return {
    hash: write.data,
    receipt: receipt.data,
    claim,
    claimError: write.isError ? classifyClaimError(write.error) : undefined,
    isPending: write.isPending,
    isConfirming: receipt.isPending,
    isSuccess: receipt.isSuccess,
  }
}

export function classifyClaimError(err: unknown): ClaimError {
  if (err === null || err === undefined) return 'unknown'

  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  // User rejected in wallet
  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('action_rejected') ||
    lower.includes('rejected by user')
  ) {
    return 'user_rejected'
  }

  // Price changed (value mismatch)
  if (
    lower.includes('insufficient funds') ||
    lower.includes('value') ||
    lower.includes('price')
  ) {
    return 'price_changed'
  }

  // Wallet limit exceeded
  if (
    lower.includes('max mint') ||
    lower.includes('wallet limit') ||
    lower.includes('exceeds max') ||
    lower.includes('allocation')
  ) {
    return 'wallet_limit'
  }

  // Sold out
  if (
    lower.includes('sold out') ||
    lower.includes('max supply') ||
    lower.includes('supply exceeded')
  ) {
    return 'sold_out'
  }

  return 'unknown'
}
