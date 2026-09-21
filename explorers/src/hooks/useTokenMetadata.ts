import { useChainId, useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'
import { fetchIpfsJson, type TokenMetadata } from '@/lib/ipfs'

export type MetadataStatus = 'loading' | 'resolved' | 'unresolved'

export interface TokenMetadataResult {
  status: MetadataStatus
  name: string | undefined
  image: string | undefined
  attributes: TokenMetadata['attributes'] | undefined
}

/**
 * Fetch token metadata: tokenURI → IPFS JSON.
 * Caches per (chainId, address, tokenId). Never synthesizes attributes.
 */
export function useTokenMetadata(tokenId: bigint | undefined) {
  const chainId = useChainId()
  const address = getLoreumNftAddress(chainId)
  const enabled = address !== undefined && tokenId !== undefined

  // Step 1: read tokenURI from contract
  const uriQuery = useReadContract({
    address: address!,
    abi: loreumNftAbi,
    functionName: 'tokenURI',
    args: enabled ? [tokenId!] : undefined,
    query: { enabled },
  })

  const tokenUri = uriQuery.data as string | undefined

  // Step 2: fetch IPFS JSON
  const metadataQuery = useQuery<TokenMetadata>({
    queryKey: ['tokenMetadata', chainId, address, tokenId?.toString()],
    queryFn: () => fetchIpfsJson<TokenMetadata>(tokenUri!),
    enabled: tokenUri !== undefined,
    staleTime: Infinity, // metadata is immutable per (chain, address, id)
  })

  const status: MetadataStatus =
    uriQuery.isLoading || metadataQuery.isPending
      ? 'loading'
      : metadataQuery.isSuccess
        ? 'resolved'
        : 'unresolved'

  const data: TokenMetadataResult = {
    status,
    name: metadataQuery.data?.name,
    image: metadataQuery.data?.image,
    attributes: metadataQuery.data?.attributes,
  }

  return {
    ...metadataQuery,
    data,
    tokenUri,
    isLoading: uriQuery.isLoading || metadataQuery.isPending,
    isError: uriQuery.isError || metadataQuery.isError,
    error: uriQuery.error ?? metadataQuery.error,
  }
}
