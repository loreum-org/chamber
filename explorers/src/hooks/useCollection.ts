import { useChainId, useReadContracts } from 'wagmi'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'

export interface CollectionData {
  name: string | undefined
  symbol: string | undefined
  totalSupply: bigint | undefined
  mintCost: bigint | undefined
  maxSupply: bigint | undefined
  maxMint: bigint | undefined
}

/**
 * Read collection-level config via multicall.
 * Works disconnected (public RPC) — no wallet required.
 */
export function useCollection() {
  const chainId = useChainId()
  const address = getLoreumNftAddress(chainId)
  const enabled = address !== undefined

  const contracts = enabled
    ? ([
        { address, abi: loreumNftAbi, functionName: 'name' },
        { address, abi: loreumNftAbi, functionName: 'symbol' },
        { address, abi: loreumNftAbi, functionName: 'totalSupply' },
        { address, abi: loreumNftAbi, functionName: 'mintCost' },
        { address, abi: loreumNftAbi, functionName: 'MAX_SUPPLY' },
        { address, abi: loreumNftAbi, functionName: 'MAX_MINT' },
      ] as const)
    : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = useReadContracts({ contracts, query: { enabled } } as any)

  const results = (query.data ?? []) as Array<{ result?: unknown; status?: string }>

  const data: CollectionData = {
    name: results[0]?.result as string | undefined,
    symbol: results[1]?.result as string | undefined,
    totalSupply: results[2]?.result as bigint | undefined,
    mintCost: results[3]?.result as bigint | undefined,
    maxSupply: results[4]?.result as bigint | undefined,
    maxMint: results[5]?.result as bigint | undefined,
  }

  return { ...query, data }
}
