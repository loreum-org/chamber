import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChainId, usePublicClient } from 'wagmi'
import { invalidateChamberQueries } from './invalidateChamberQueries'
import { requireIndexerBlock } from '@/lib/indexer'
import {
  CHAMBER_LIVE_POLL_MS,
  resolveChamberLiveUpdateMode,
} from '@/lib/chamberLiveUpdates'
import { chainHasWebsocketTransport } from '@/lib/wagmi'

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  )

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return visible
}

/**
 * One shared live-update path for an open chamber (mounted from ChamberRouteGate).
 *
 * WebSocket: a single `watchEvent` / `eth_subscribe` on the chamber, then
 * `invalidateChamberQueries`. `poll: false` so a dropped socket cannot fall
 * back to per-block `eth_getLogs` (the #274 burn).
 *
 * No WS: one visible-tab invalidate every 60s. Hidden tabs stay idle.
 */
export function useChamberLiveUpdates(chamberAddress: `0x${string}` | undefined) {
  const queryClient = useQueryClient()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId })
  const tabVisible = useDocumentVisible()
  const [subscribeFailed, setSubscribeFailed] = useState(false)

  useEffect(() => {
    setSubscribeFailed(false)
  }, [chamberAddress, chainId])

  const mode = resolveChamberLiveUpdateMode({
    tabVisible,
    websocketAvailable: chainHasWebsocketTransport(chainId) && !subscribeFailed,
  })

  useEffect(() => {
    if (!chamberAddress || !publicClient || mode !== 'websocket') return

    const unwatch = publicClient.watchEvent({
      address: chamberAddress,
      poll: false,
      onLogs(logs) {
        let block: bigint | undefined
        for (const log of logs) {
          const n = log.blockNumber
          if (n === undefined || n === null) continue
          if (block === undefined || n > block) block = n
        }
        if (block !== undefined) requireIndexerBlock(chamberAddress, block)
        invalidateChamberQueries(queryClient, chamberAddress)
      },
      onError() {
        setSubscribeFailed(true)
      },
    })

    return () => {
      unwatch()
    }
  }, [chamberAddress, mode, publicClient, queryClient])

  useEffect(() => {
    if (!chamberAddress || mode !== 'poll') return

    const id = window.setInterval(() => {
      invalidateChamberQueries(queryClient, chamberAddress)
    }, CHAMBER_LIVE_POLL_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [chamberAddress, mode, queryClient])
}
