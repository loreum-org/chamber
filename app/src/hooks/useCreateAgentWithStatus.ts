import { useWriteContract } from 'wagmi'
import { chamberRegistryAbi } from '@/contracts/abis'
import { useTransactionStatus, type UseTransactionStatusOptions } from './useTransactionStatus'

/**
 * Enhanced hook for creating agents with status tracking
 */
export function useCreateAgentWithStatus(
  registryAddress: `0x${string}` | undefined,
  options?: UseTransactionStatusOptions
) {
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const transactionStatus = useTransactionStatus({
    hash,
    ...options,
  })

  const createAgent = async (
    owner: `0x${string}`,
    policy: `0x${string}`,
    metadataURI: string
  ) => {
    if (!registryAddress) return
    try {
      transactionStatus.reset()
      const txHash = await writeContract({
        address: registryAddress,
        abi: chamberRegistryAbi,
        functionName: 'createAgent',
        args: [owner, policy, metadataURI],
      })
      return txHash
    } catch (err) {
      transactionStatus.reset()
      throw err
    }
  }

  return {
    createAgent,
    ...transactionStatus,
    writeError,
    isPending: isPending || transactionStatus.isPending,
  }
}
