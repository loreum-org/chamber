import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useAccount,
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useReadContracts,
} from 'wagmi'
import { decodeEventLog, zeroAddress } from 'viem'
import { chamberAbi } from '@/contracts/abis'
import { useBoardMembers, useChamberInfo, useMembershipTokenOwners } from './useChamber'
import { asUint32 } from '@/lib/directorSession'

/**
 * Operator console + wizard data plumbing (P0 Feature 1 / issue #259).
 * Reads stay on the contract (`getDirectorSession`, `getTransaction`, logs);
 * writes go through the wallet via `useSetDirectorOperator` (see useChamber.ts).
 */

export type OperatorSeatView = {
  tokenId: bigint
  /** Rank in the current top-seat order (1-based). */
  rank: number
  /** Delegation weight backing the seat. */
  delegation: bigint
  /** Membership NFT owner (director wallet the operator acts for). */
  owner: `0x${string}` | undefined
  /** Live operator, or zero when unset / stale / expired. */
  operator: `0x${string}` | undefined
  rawOperator: `0x${string}` | undefined
  expiry: bigint
  scope: number
  liveAt: bigint
  isLive: boolean
}

/**
 * Every seated membership token in a chamber with its live operator session.
 * Mirrors the seat-management read path used by `useDirectorActionGate`:
 * `getDirectors` + `getTop(seats)` + per-seat operator getters.
 */
export function useOperatorSeats(chamberAddress: `0x${string}` | undefined) {
  const { seats: seatCount, directors, nftToken } = useChamberInfo(chamberAddress)

  const directorCount = directors?.length ?? 0
  const { members } = useBoardMembers(chamberAddress, seatCount ?? 20)
  const seatedMembers = useMemo(
    () => members.slice(0, directorCount),
    [members, directorCount],
  )
  const memberTokenKey = seatedMembers.map((m) => m.tokenId.toString()).join(',')
  const seatedTokenIds = useMemo(
    () => (memberTokenKey ? memberTokenKey.split(',').map((id) => BigInt(id)) : []),
    [memberTokenKey],
  )

  const { owners } = useMembershipTokenOwners(nftToken, seatedTokenIds)

  const { data: sessionResults, refetch } = useReadContracts({
    contracts: seatedTokenIds.flatMap((tokenId) => [
      {
        address: chamberAddress,
        abi: chamberAbi,
        functionName: 'getDirectorOperator' as const,
        args: [tokenId] as const,
      },
      {
        address: chamberAddress,
        abi: chamberAbi,
        functionName: 'getDirectorSession' as const,
        args: [tokenId] as const,
      },
    ]),
    query: {
      enabled: !!chamberAddress && seatedTokenIds.length > 0,
      staleTime: 0,
      retry: false,
    },
  })

  const seats: OperatorSeatView[] = useMemo(() => {
    if (sessionResults === undefined || sessionResults.length !== seatedTokenIds.length * 2) {
      return []
    }
    return seatedTokenIds.map((tokenId, index) => {
      const liveResult = sessionResults[index * 2]
      const rawResult = sessionResults[index * 2 + 1]
      const operator =
        liveResult?.status === 'success' ? (liveResult.result as `0x${string}`) : undefined
      const raw = rawResult?.status === 'success'
        ? (rawResult.result as readonly [`0x${string}`, `0x${string}`, bigint, number | bigint, bigint])
        : undefined
      const member = seatedMembers[index]
      return {
        tokenId,
        rank: member?.rank ?? index + 1,
        delegation: member?.amount ?? 0n,
        owner: owners[index],
        operator,
        rawOperator: (raw?.[1] ?? zeroAddress) as `0x${string}`,
        expiry: raw?.[2] ?? 0n,
        scope: asUint32(raw?.[3]),
        liveAt: raw?.[4] ?? 0n,
        isLive: !!operator && operator !== zeroAddress,
      }
    })
  }, [sessionResults, seatedTokenIds, seatedMembers, owners])

  return {
    seats,
    seatCount,
    directorCount,
    nftToken,
    refetch,
    isFetched: seatCount !== undefined && (seatedTokenIds.length === 0 || sessionResults !== undefined),
  }
}

/** Live operator sessions for `operatorAddress`, across the chamber's seats. */
export function useOperatorSeatsForWallet(
  seats: OperatorSeatView[],
  operatorAddress: `0x${string}` | undefined,
): OperatorSeatView[] {
  return useMemo(() => {
    if (!operatorAddress) return []
    const lower = operatorAddress.toLowerCase()
    return seats.filter((seat) => seat.operator?.toLowerCase() === lower)
  }, [seats, operatorAddress])
}

export type OperatorTxStats = {
  total: number
  executed: number
  pending: number
  /** Sum of executed call values (native wei). ERC-20 transfer values are not represented here. */
  valueMovedWei: bigint
  isLoading: boolean
}

/**
 * Queue-level analytics for the operator console. Failed executions are not
 * recorded on-chain (no revert log), so "failed" is surfaced as a footnote
 * rather than a fabricated counter.
 */
export function useOperatorTxStats(chamberAddress: `0x${string}` | undefined): OperatorTxStats {
  const { data: transactionCount } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'getTransactionCount',
    query: { enabled: !!chamberAddress, retry: 1 },
  })

  const count = transactionCount ? Number(transactionCount) : 0
  const capped = Math.min(count, 200)

  const { data: results, isPending } = useReadContracts({
    contracts: Array.from({ length: capped }, (_, i) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction' as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: !!chamberAddress && capped > 0, retry: false },
  })

  return useMemo(() => {
    const stats: OperatorTxStats = {
      total: count,
      executed: 0,
      pending: 0,
      valueMovedWei: 0n,
      isLoading: count > 0 ? isPending || results === undefined : false,
    }
    if (!results || results.length !== capped) return stats
    for (const result of results) {
      if (result.status !== 'success') continue
      const [executed, , , value] = result.result as [boolean, number, `0x${string}`, bigint, `0x${string}`]
      if (executed) {
        stats.executed += 1
        stats.valueMovedWei += value
      } else {
        stats.pending += 1
      }
    }
    return stats
  }, [results, capped, count, isPending])
}

export type OperatorActivityKind =
  | 'operator-assigned'
  | 'operator-cleared'
  | 'tx-submitted'
  | 'tx-executed'
  | 'tx-cancelled'

export type OperatorActivityItem = {
  id: string
  kind: OperatorActivityKind
  blockNumber: bigint
  timestamp: number | undefined
  summary: string
  actor?: `0x${string}`
  tokenId?: bigint
}

const ACTIVITY_LOOKBACK_BLOCKS = 40_000n
const ACTIVITY_MAX_ITEMS = 40
const ACTIVITY_MAX_TIMESTAMPS = 24

/**
 * Recent chamber activity feed, decoded from logs (the console's audit
 * surface). Reads one window of logs and decodes against the hand-maintained
 * `chamberAbi`; unknown events are skipped so ABI drift cannot break the page.
 */
export function useOperatorActivity(chamberAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient()
  const { data: blockNumber } = useBlockNumber({ query: { enabled: !!chamberAddress } })

  const query = useQuery({
    queryKey: [
      'operator-activity',
      chamberAddress?.toLowerCase() ?? '',
      blockNumber?.toString() ?? '',
    ],
    enabled: !!publicClient && !!chamberAddress && blockNumber !== undefined,
    staleTime: 15_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 20_000),
    queryFn: async () => {
      const client = publicClient!
      const chamber = chamberAddress!
      const fromBlock = blockNumber! > ACTIVITY_LOOKBACK_BLOCKS ? blockNumber! - ACTIVITY_LOOKBACK_BLOCKS : 0n
      const logs = await client.getLogs({ address: chamber, fromBlock, toBlock: 'latest' })

      const items: OperatorActivityItem[] = []
      for (const log of logs) {
        let decoded: { eventName: string; args: Record<string, unknown> }
        try {
          const result = decodeEventLog({
            abi: chamberAbi,
            data: log.data,
            topics: log.topics,
            strict: false,
          })
          decoded = { eventName: result.eventName, args: result.args as Record<string, unknown> }
        } catch {
          continue
        }

        const base = {
          id: `${log.blockNumber}-${log.logIndex}`,
          blockNumber: log.blockNumber,
          timestamp: undefined as number | undefined,
        }

        switch (decoded.eventName) {
          case 'DirectorOperatorSet': {
            const tokenId = decoded.args.tokenId as bigint
            const operator = decoded.args.operator as `0x${string}`
            const owner = decoded.args.owner as `0x${string}`
            const cleared = operator === zeroAddress
            items.push({
              ...base,
              kind: cleared ? 'operator-cleared' : 'operator-assigned',
              tokenId,
              actor: owner,
              summary: cleared
                ? `Operator revoked on seat #${tokenId.toString()} (owner ${owner})`
                : `Operator ${operator} assigned to seat #${tokenId.toString()} (owner ${owner})`,
            })
            break
          }
          case 'TransactionSubmitted': {
            const transactionId = decoded.args.transactionId as bigint
            const target = decoded.args.target as `0x${string}`
            items.push({
              ...base,
              kind: 'tx-submitted',
              tokenId: decoded.args.tokenId as bigint | undefined,
              summary: `Transaction #${transactionId.toString()} submitted to ${target}`,
            })
            break
          }
          case 'TransactionExecuted': {
            const transactionId = decoded.args.transactionId as bigint
            items.push({
              ...base,
              kind: 'tx-executed',
              tokenId: decoded.args.tokenId as bigint | undefined,
              actor: decoded.args.executor as `0x${string}` | undefined,
              summary: `Transaction #${transactionId.toString()} executed`,
            })
            break
          }
          case 'TransactionCancelled': {
            const nonce = decoded.args.nonce as bigint
            items.push({
              ...base,
              kind: 'tx-cancelled',
              summary: `Transaction #${nonce.toString()} cancelled`,
            })
            break
          }
          default:
            break
        }
        if (items.length >= ACTIVITY_MAX_ITEMS * 4) break
      }

      items.sort((a, b) =>
        a.blockNumber === b.blockNumber ? 0 : a.blockNumber < b.blockNumber ? 1 : -1,
      )
      const feed = items.slice(0, ACTIVITY_MAX_ITEMS)

      const uniqueBlocks = [...new Set(feed.map((item) => item.blockNumber))].slice(
        0,
        ACTIVITY_MAX_TIMESTAMPS,
      )
      const timestamps = await Promise.all(
        uniqueBlocks.map(async (block) => {
          try {
            const blockData = await client.getBlock({ blockNumber: block })
            return [block, Number(blockData.timestamp)] as const
          } catch {
            return [block, undefined] as const
          }
        }),
      )
      const byBlock = new Map(timestamps)
      for (const item of feed) item.timestamp = byBlock.get(item.blockNumber)

      return feed
    },
  })

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    lookbackBlocks: ACTIVITY_LOOKBACK_BLOCKS,
  }
}

/** Real-time gas estimate for `setDirectorOperator` (review step, spec 1.1). */
export function useSetDirectorOperatorGasEstimate(args: {
  chamberAddress: `0x${string}` | undefined
  tokenId: bigint | undefined
  operator: `0x${string}` | undefined
  expiry: bigint | undefined
  scope: number | undefined
}) {
  const publicClient = usePublicClient()
  const { address: userAddress } = useAccount()
  const enabled =
    !!publicClient &&
    !!args.chamberAddress &&
    args.tokenId !== undefined &&
    !!args.operator &&
    args.expiry !== undefined &&
    args.scope !== undefined &&
    args.scope > 0 &&
    !!userAddress

  const query = useQuery({
    queryKey: [
      'set-operator-gas',
      args.chamberAddress?.toLowerCase() ?? '',
      args.tokenId?.toString() ?? '',
      args.operator?.toLowerCase() ?? '',
      args.expiry?.toString() ?? '',
      args.scope?.toString() ?? '',
      userAddress?.toLowerCase() ?? '',
    ],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      publicClient!.estimateContractGas({
        address: args.chamberAddress!,
        abi: chamberAbi,
        functionName: 'setDirectorOperator',
        args: [args.tokenId!, args.operator!, args.expiry!, args.scope!],
        account: userAddress!,
      }),
  })

  return {
    gas: query.data,
    isEstimating: query.isFetching,
    estimateUnavailable: enabled && query.isError,
  }
}
