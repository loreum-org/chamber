import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { requireIndexerBlock } from '@/lib/indexer'
import { queryKeyIncludes } from '@/lib/queryKeyMatch'

/**
 * Invalidate every cached read that mentions this chamber. Called after a wallet
 * write's receipt lands (`useReceiptRefresh`, `useInvalidateOnReceipt`) and from
 * the single shared `useChamberLiveUpdates` hook (one WS subscribe, or a 60s
 * visible-tab poll — never per-component `eth_getLogs` watches).
 */
export function invalidateChamberQueries(
  queryClient: QueryClient,
  chamberAddress: `0x${string}` | undefined,
) {
  if (!chamberAddress) return

  const chamberAddrLower = chamberAddress.toLowerCase()

  queryClient.invalidateQueries({
    predicate: (query) => queryKeyIncludes(query.queryKey, chamberAddrLower),
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
  const chainId = useChainId()
  const handledRef = useRef<string | undefined>()

  useEffect(() => {
    if (!hash || !receipt || handledRef.current === hash) return
    handledRef.current = hash
    // Indexer reads for this chamber wait until the indexer has this block.
    if (chamberAddress) requireIndexerBlock(chamberAddress, receipt.blockNumber, chainId)
    invalidateChamberQueries(queryClient, chamberAddress)
    invalidateChamberQueries(queryClient, account)
    // Public RPCs can lag the receipt. A second invalidate catches a stale first read.
    // No cleanup: delegate/undelegate unmount when the user leaves that tab, and the
    // retry must still run so the Board tab sees the confirmed ranking.
    window.setTimeout(() => {
      invalidateChamberQueries(queryClient, chamberAddress)
      invalidateChamberQueries(queryClient, account)
    }, 2000)
  }, [hash, receipt, chamberAddress, account, chainId, queryClient])
}
