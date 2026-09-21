import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { requireIndexerBlock } from '@/lib/indexer'

/**
 * Invalidate every cached read that mentions this chamber. Called after a wallet
 * write's receipt lands (`useReceiptRefresh`, `useInvalidateOnReceipt`). There are no live event watches:
 * they polled RPC filters every block per open tab and exhausted the Alchemy quota.
 */
export function invalidateChamberQueries(
  queryClient: QueryClient,
  chamberAddress: `0x${string}` | undefined,
) {
  if (!chamberAddress) return

  const chamberAddrLower = chamberAddress.toLowerCase()

  queryClient.invalidateQueries({
    predicate: (query) => {
      try {
        const keyStr = JSON.stringify(query.queryKey).toLowerCase()
        return keyStr.includes(chamberAddrLower)
      } catch {
        return false
      }
    },
  })
}

/**
 * Once a write's receipt lands, invalidate reads that mention the chamber or the
 * account (asset balances are keyed by token + account, not by chamber).
 */
export function useInvalidateOnReceipt(
  hash: `0x${string}` | undefined,
  receipt: { blockNumber: bigint } | undefined,
  chamberAddress: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
) {
  const queryClient = useQueryClient()
  const handledRef = useRef<string | undefined>()

  useEffect(() => {
    if (!hash || !receipt || handledRef.current === hash) return
    handledRef.current = hash
    // Indexer reads for this chamber wait until the indexer has this block.
    if (chamberAddress) requireIndexerBlock(chamberAddress, receipt.blockNumber)
    invalidateChamberQueries(queryClient, chamberAddress)
    invalidateChamberQueries(queryClient, account)
  }, [hash, receipt, chamberAddress, account, queryClient])
}
