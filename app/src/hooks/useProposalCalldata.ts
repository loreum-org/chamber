import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { hasProposalCalldata } from '@/lib/utils'
import { proposalCalldataMatchesHash, resolveProposalCalldata } from '@/lib/proposalCalldata'

export function useProposalCalldata(
  chamberAddress: `0x${string}` | undefined,
  txId: number,
  dataHash: `0x${string}` | undefined,
  metadataCalldata?: string,
  /** Calldata from chamber-indexer; used without any RPC call when it matches `dataHash`. */
  indexedCalldata?: `0x${string}`,
) {
  const publicClient = usePublicClient()
  const needsCalldata = dataHash ? hasProposalCalldata(dataHash) : false
  const indexedMatch =
    !!indexedCalldata && !!dataHash && proposalCalldataMatchesHash(indexedCalldata, dataHash)

  return useQuery({
    queryKey: ['proposal-calldata', chamberAddress, txId, dataHash, metadataCalldata, indexedMatch],
    enabled: (indexedMatch || !!publicClient) && !!chamberAddress && needsCalldata && dataHash !== undefined,
    staleTime: 60_000,
    queryFn: async () => {
      if (indexedMatch && indexedCalldata) return { calldata: indexedCalldata, source: 'indexer' as const }
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
