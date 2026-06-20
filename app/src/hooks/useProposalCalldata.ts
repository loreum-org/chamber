import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { hasProposalCalldata } from '@/lib/utils'
import { resolveProposalCalldata } from '@/lib/proposalCalldata'

export function useProposalCalldata(
  chamberAddress: `0x${string}` | undefined,
  txId: number,
  dataHash: `0x${string}` | undefined,
  metadataCalldata?: string,
) {
  const publicClient = usePublicClient()
  const needsCalldata = dataHash ? hasProposalCalldata(dataHash) : false

  return useQuery({
    queryKey: ['proposal-calldata', chamberAddress, txId, dataHash, metadataCalldata],
    enabled: !!publicClient && !!chamberAddress && needsCalldata && dataHash !== undefined,
    staleTime: 60_000,
    queryFn: async () => {
      if (!publicClient || !chamberAddress || !dataHash) return null
      return resolveProposalCalldata(
        publicClient,
        chamberAddress,
        txId,
        dataHash,
        metadataCalldata,
      )
    },
  })
}
