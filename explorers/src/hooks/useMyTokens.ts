import { useAccount, useChainId, useReadContract, useReadContracts } from 'wagmi'
import { getLoreumNftAddress } from '@/lib/addresses'
import { loreumNftAbi } from '@/abi'

export interface MyTokensData {
  tokens: bigint[] | undefined
}

/**
 * Read all token IDs owned by the connected wallet.
 * Step 1: balanceOf(me) → count
 * Step 2: batched tokenOfOwnerByIndex(me, 0..n−1)
 */
export function useMyTokens() {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const contractAddress = getLoreumNftAddress(chainId)
  const enabled = contractAddress !== undefined && account !== undefined

  // Step 1: get balance
  const balanceQuery = useReadContract({
    address: contractAddress!,
    abi: loreumNftAbi,
    functionName: 'balanceOf',
    args: enabled ? [account!] : undefined,
    query: { enabled },
  })

  const balance = balanceQuery.data as bigint | undefined
  const count = balance !== undefined ? Number(balance) : 0

  // Step 2: batched tokenOfOwnerByIndex
  const tokenContracts =
    enabled && count > 0
      ? Array.from({ length: count }, (_, i) => ({
          address: contractAddress!,
          abi: loreumNftAbi,
          functionName: 'tokenOfOwnerByIndex' as const,
          args: [account!, BigInt(i)] as const,
        }))
      : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokensQuery = useReadContracts({ contracts: tokenContracts, query: { enabled: enabled && count > 0 } } as any)
  const results = (tokensQuery.data ?? []) as Array<{ result?: unknown; status?: string }>

  const tokens =
    enabled && count > 0 && results.length === count
      ? results.map((r) => r.result as bigint)
      : undefined

  const data: MyTokensData = { tokens }

  return {
    ...tokensQuery,
    data,
    balance,
    isLoading: balanceQuery.isLoading || tokensQuery.isLoading,
    isError: balanceQuery.isError || tokensQuery.isError,
    error: balanceQuery.error ?? tokensQuery.error,
  }
}
