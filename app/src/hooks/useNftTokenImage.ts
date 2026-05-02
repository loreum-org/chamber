import { useMemo, useEffect } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { zeroAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { erc721Abi } from '@/contracts/abis'
import { fetchErc721MetadataWithRetry, resolveErc721ImageFromMetadata } from '@/lib/ipfs'

/** Keep fresh: partial maps were cached 1h and never refetched; chamber events must invalidate. */
const NFT_IMAGE_STALE_MS = 0

export type UseNftImageOpts = {
  enabled?: boolean
  /**
   * Include in the React Query key so `invalidateQueries` for this chamber refetches images
   * after delegations/board updates (keys without this never matched chamber invalidation).
   */
  chamberAddress?: `0x${string}`
}

/**
 * Resolved HTTPS image URL for an ERC721 token via tokenURI → JSON metadata `image`.
 */
export function useNftTokenImage(
  nftAddress: `0x${string}` | undefined,
  tokenId: bigint | undefined,
  opts?: Pick<UseNftImageOpts, 'chamberAddress'>
) {
  const enabledAddr = !!nftAddress && nftAddress !== zeroAddress
  const scope = (opts?.chamberAddress ?? '').toLowerCase()

  const {
    data: tokenURI,
    isPending: tokenUriPending,
    isFetching: tokenUriFetching,
  } = useReadContract({
    address: enabledAddr ? nftAddress : undefined,
    abi: erc721Abi,
    functionName: 'tokenURI',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: enabledAddr && tokenId !== undefined && tokenId > 0n,
    },
  })

  const uri = typeof tokenURI === 'string' ? tokenURI : undefined

  const imageQuery = useQuery({
    queryKey: ['nft-token-image', nftAddress?.toLowerCase() ?? '', scope, tokenId?.toString(), uri],
    enabled: !!enabledAddr && tokenId !== undefined && tokenId > 0n && !!uri?.length,
    staleTime: NFT_IMAGE_STALE_MS,
    queryFn: async (): Promise<string | undefined> => {
      if (!uri) return undefined
      const pack = await fetchErc721MetadataWithRetry(uri)
      return resolveErc721ImageFromMetadata(pack?.meta, pack?.documentUrl)
    },
  })

  const resolvingImages =
    !!enabledAddr && tokenId !== undefined && tokenId > 0n
      ? tokenUriPending || tokenUriFetching || imageQuery.isFetching
      : false

  return { ...imageQuery, resolvingImages }
}

/**
 * Batch-resolve images for many token IDs (multicall tokenURI + one metadata fetch per token).
 */
export function useNftImageMap(
  nftAddress: `0x${string}` | undefined,
  tokenIds: bigint[],
  opts?: UseNftImageOpts
) {
  const enabledAddr = !!nftAddress && nftAddress !== zeroAddress
  const scope = (opts?.chamberAddress ?? '').toLowerCase()
  // Value-based key: parents often pass new `tokenIds` arrays each render; stable `ids` keeps multicall config stable.
  const idsKey = [...new Set(tokenIds.map((id) => id.toString()))].join(',')
  const ids = useMemo(
    () => (idsKey ? idsKey.split(',').filter(Boolean).map(BigInt) : []),
    [idsKey]
  )

  const contracts = useMemo(
    (): {
      address: `0x${string}`
      abi: typeof erc721Abi
      functionName: 'tokenURI'
      args: readonly [bigint]
    }[] =>
      !nftAddress || !enabledAddr || ids.length === 0
        ? []
        : ids.map((id) => ({
            address: nftAddress,
            abi: erc721Abi,
            functionName: 'tokenURI' as const,
            args: [id],
          })),
    [nftAddress, ids, enabledAddr]
  )

  const { data: uriResults, isPending: uriReadsPending, isFetching: uriReadsFetching } =
    useReadContracts({
      contracts,
      query: {
        enabled: (opts?.enabled ?? true) && !!enabledAddr && contracts.length > 0,
      },
    })

  const uriDigest = useMemo(() => {
    if (!uriResults || ids.length === 0) return ''
    return ids
      .map((id, i) => {
        const r = uriResults[i]
        if (r?.status !== 'success' || typeof r.result !== 'string') return ''
        return `${id.toString()}:${r.result}`
      })
      .filter(Boolean)
      .join('|')
  }, [uriResults, ids])

  /** Token ids that have a successful tokenURI read — image map should eventually cover all of these. */
  const tokenIdsWithSuccessfulUri = useMemo(() => {
    if (!uriResults || ids.length === 0) return [] as string[]
    return ids.flatMap((id, i) => {
      const r = uriResults[i]
      return r?.status === 'success' && typeof r.result === 'string' && r.result ? [id.toString()] : []
    })
  }, [uriResults, ids])

  const imageQuery = useQuery({
    queryKey: ['nft-image-map', nftAddress?.toLowerCase() ?? '', scope, uriDigest],
    enabled:
      (opts?.enabled ?? true) && !!enabledAddr && ids.length > 0 && !!uriDigest.length,
    staleTime: NFT_IMAGE_STALE_MS,
    queryFn: async (): Promise<Map<string, string>> => {
      const out = new Map<string, string>()
      await Promise.all(
        ids.map(async (id, i) => {
          const r = uriResults?.[i]
          if (r?.status !== 'success' || typeof r.result !== 'string' || !r.result) return
          const pack = await fetchErc721MetadataWithRetry(r.result)
          const img = resolveErc721ImageFromMetadata(pack?.meta, pack?.documentUrl)
          if (img) out.set(id.toString(), img)
        })
      )
      return out
    },
  })

  const mapIncomplete =
    imageQuery.isSuccess &&
    !!imageQuery.data &&
    tokenIdsWithSuccessfulUri.length > 0 &&
    tokenIdsWithSuccessfulUri.some((id) => !imageQuery.data!.has(id))

  useEffect(() => {
    if (!mapIncomplete) return
    const t = window.setInterval(() => {
      void imageQuery.refetch()
    }, 28_000)
    return () => window.clearInterval(t)
  }, [mapIncomplete, imageQuery.refetch])

  const resolvingImages =
    !!enabledAddr &&
    ids.length > 0 &&
    (uriReadsPending || uriReadsFetching || imageQuery.isFetching)

  return { ...imageQuery, resolvingImages }
}
