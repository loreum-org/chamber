/**
 * React hook for the compliance dashboard (#261): fetches the trailing-window
 * on-chain snapshot and computes the four governance-health metrics + daily
 * series client-side. Refreshes every ~5 minutes (spec: real-time dashboard,
 * Story 3.2) and on manual refetch.
 */

import { useChainId, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { chamberAbi } from '@/contracts/abis'
import {
  computeComplianceMetrics,
  type ComplianceMetrics,
} from '@/lib/complianceMetrics'
import { fetchComplianceSnapshot, type ComplianceSnapshot } from '@/lib/complianceQuery'

/** Story 3.2 — metrics updated ~every 5 minutes. */
export const COMPLIANCE_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export interface ComplianceQueryResult {
  metrics: ComplianceMetrics
  snapshot: ComplianceSnapshot
  computedAt: number
}

export function useComplianceMetrics(
  chamberAddress: `0x${string}` | undefined,
  windowDays = 30,
) {
  const publicClient = usePublicClient()
  const chainId = useChainId()

  const query = useQuery({
    queryKey: [
      'compliance-metrics',
      chainId,
      chamberAddress?.toLowerCase() ?? '',
      windowDays,
    ],
    enabled: !!publicClient && !!chamberAddress,
    staleTime: COMPLIANCE_REFRESH_INTERVAL_MS,
    refetchInterval: COMPLIANCE_REFRESH_INTERVAL_MS,
    retry: 1,
    queryFn: async () => {
      const client = publicClient as NonNullable<typeof publicClient>
      const chamber = chamberAddress as `0x${string}`
      // Director-seat churn is ERC-721 Transfer activity on the chamber's own
      // director NFT (chamber.nft()).
      const nftAddress = (await client.readContract({
        address: chamber,
        abi: chamberAbi,
        functionName: 'nft',
      })) as `0x${string}`
      const snapshot = await fetchComplianceSnapshot(client, chamber, nftAddress, windowDays)
      const metrics = computeComplianceMetrics({
        now: Math.floor(Date.now() / 1000),
        windowDays,
        seats: snapshot.seats,
        currentMembers: snapshot.members,
        delegationEvents: snapshot.events.delegationEvents,
        seatTransferTimestamps: snapshot.events.seatTransferTimestamps,
        txs: snapshot.txs,
      })
      return {
        metrics,
        snapshot,
        computedAt: Math.floor(Date.now() / 1000),
      }
    },
  })

  return {
    metrics: query.data?.metrics,
    snapshot: query.data?.snapshot,
    computedAt: query.data?.computedAt,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}