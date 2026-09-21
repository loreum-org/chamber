/**
 * On-chain data layer for the compliance dashboard (#261).
 *
 * Pulls the trailing-window event history for one chamber (Chamber contract +
 * its director NFT) over plain RPC `eth_getLogs` — the same access pattern as
 * `chamberDiscovery.ts` (chunked windows, no indexer required), then decodes
 * with the app's ABI fragments. Timestamps come from the blocks that emitted
 * each log. Deadlines are read from `getTransactionDeadline` via multicall
 * (authoritative) with the `TransactionDeadlineSet` event as fallback.
 */

import { decodeEventLog, type PublicClient } from 'viem'
import { chamberAbi } from '@/contracts/abis'
import type { DelegationPair, TxTimelineEntry } from './complianceMetrics'

/** Minimal ERC-721 Transfer (tokenId is indexed → 4 topics, empty data). */
const erc721TransferEvent = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const

export interface SubmittedEvent {
  transactionId: bigint
  timestamp: number
}

export interface ExecutedEvent {
  transactionId: bigint
  timestamp: number
}

export interface CancelledEvent {
  transactionId: bigint
  timestamp: number
}

export interface SeatChange {
  numOfSeats: bigint
  timestamp: number
}

export interface DecodedComplianceEvents {
  delegationEvents: DelegationPair[]
  submitted: SubmittedEvent[]
  executed: ExecutedEvent[]
  cancelled: CancelledEvent[]
  seatTransferTimestamps: number[]
  seatSizeChanges: SeatChange[]
  /** Start / end of the queried range (unix seconds), for the export header. */
  windowFromTs: number
  windowToTs: number
}

export interface ComplianceSnapshot {
  /** Current board size (getSeats). */
  seats: number
  /** Current board delegation per seat tokenId (getTop). */
  members: { tokenId: bigint; amount: bigint }[]
  /** Proposal timeline for the window (deadline from contract read). */
  txs: TxTimelineEntry[]
  events: DecodedComplianceEvents
  fromBlock: bigint
  toBlock: bigint
}

const DAY_SECONDS = 86_400
/** Sepolia + mainnet post-merge block cadence; only used as a binary-search seed. */
const SECONDS_PER_BLOCK = 12

/**
 * Block whose timestamp is the largest ≤ `timestamp` (binary search over the
 * chain head). Returns 0n when the chain is younger than the requested age.
 */
export async function getBlockAtOrBefore(
  client: PublicClient,
  timestamp: number,
): Promise<bigint> {
  const latest = await client.getBlock()
  if (Number(latest.timestamp) <= timestamp) return latest.number ?? 0n
  // Seed the search with the expected cadence to skip most iterations.
  const blockAge = Number(latest.timestamp) - timestamp
  const estimate = latest.number - BigInt(Math.ceil(blockAge / SECONDS_PER_BLOCK))
  let lo = estimate > 0n ? estimate : 0n
  if (lo > 0n) {
    const seeded = await client.getBlock({ blockNumber: lo })
    if (Number(seeded.timestamp) > timestamp) {
      // Estimate overshot (variable cadence) — fall back to a full search.
      lo = 0n
    }
  }
  let hi = latest.number
  while (lo < hi) {
    const mid = (lo + hi) / 2n
    const block = await client.getBlock({ blockNumber: mid })
    if (Number(block.timestamp) <= timestamp) lo = mid + 1n
    else hi = mid
  }
  return lo > 0n ? lo - 1n : 0n
}

export async function getBlockAtAge(client: PublicClient, ageSeconds: number): Promise<bigint> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return getBlockAtOrBefore(client, nowSeconds - ageSeconds)
}

/** Block timestamps for a set of block numbers (deduped, chunked). */
export async function fetchBlockTimestamps(
  client: PublicClient,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers.map((n) => n.toString()))].map(BigInt)
  const map = new Map<bigint, number>()
  const CHUNK = 20
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const blocks = await Promise.all(
      chunk.map((n) => client.getBlock({ blockNumber: n }).catch(() => null)),
    )
    for (let j = 0; j < chunk.length; j++) {
      const block = blocks[j]
      if (block) map.set(chunk[j], Number(block.timestamp))
    }
  }
  return map
}

type RawLog = {
  blockNumber: bigint
  topics: readonly `0x${string}`[]
  data: `0x${string}`
}

/** getLogs over `[fromBlock, toBlock]`, halving the window when the RPC balks. */
async function getLogsChunked(
  client: PublicClient,
  params: { address: `0x${string}`; event?: unknown; fromBlock: bigint; toBlock: bigint },
): Promise<RawLog[]> {
  const { fromBlock, toBlock } = params
  if (fromBlock > toBlock) return []
  try {
    const logs = params.event
      ? await client.getLogs({
          address: params.address,
          event: params.event as never,
          fromBlock,
          toBlock,
        })
      : await client.getLogs({ address: params.address, fromBlock, toBlock })
    return logs as unknown as RawLog[]
  } catch {
    const mid = fromBlock + (toBlock - fromBlock) / 2n
    if (mid === fromBlock || mid === toBlock) return []
    const lower = await getLogsChunked(client, { ...params, toBlock: mid })
    const upper = await getLogsChunked(client, { ...params, fromBlock: mid + 1n })
    return [...lower, ...upper]
  }
}

/** One RPC pass over the chamber + director NFT for the requested block range. */
export async function fetchComplianceEvents(
  client: PublicClient,
  chamber: `0x${string}`,
  nft: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<DecodedComplianceEvents> {
  const chamberLogs = await getLogsChunked(client, {
    address: chamber,
    fromBlock,
    toBlock,
  })
  const nftLogs = await getLogsChunked(client, {
    address: nft,
    event: erc721TransferEvent,
    fromBlock,
    toBlock,
  })

  const timestamps = await fetchBlockTimestamps(client, [
    ...chamberLogs.map((log) => log.blockNumber),
    ...nftLogs.map((log) => log.blockNumber),
  ])
  const tsOf = (blockNumber: bigint): number => timestamps.get(blockNumber) ?? 0

  const result: DecodedComplianceEvents = {
    delegationEvents: [],
    submitted: [],
    executed: [],
    cancelled: [],
    seatTransferTimestamps: [],
    seatSizeChanges: [],
    windowFromTs: tsOf(fromBlock),
    windowToTs: tsOf(toBlock),
  }

  for (const log of chamberLogs) {
    const timestamp = tsOf(log.blockNumber)
    let eventName: string
    let args: Record<string, unknown>
    try {
      const decoded = decodeEventLog({
        abi: chamberAbi,
        data: log.data,
        topics: log.topics as [signature: `0x${string}`, ...`0x${string}`[]],
      })
      eventName = decoded.eventName
      args = decoded.args as Record<string, unknown>
    } catch {
      continue
    }
    switch (eventName) {
      case 'DelegationUpdated':
        result.delegationEvents.push({
          holder: String(args.holder),
          tokenId: args.tokenId as bigint,
          timestamp,
          amount: args.amount as bigint,
        })
        break
      case 'TransactionSubmitted':
        result.submitted.push({ transactionId: args.transactionId as bigint, timestamp })
        break
      case 'TransactionExecuted':
        result.executed.push({ transactionId: args.transactionId as bigint, timestamp })
        break
      case 'TransactionCancelled':
        result.cancelled.push({ transactionId: args.nonce as bigint, timestamp })
        break
      case 'SetSeats':
        result.seatSizeChanges.push({ numOfSeats: args.numOfSeats as bigint, timestamp })
        break
      default:
        break
    }
  }

  for (const log of nftLogs) {
    // Every director-token mint / burn / sale is a seat change.
    result.seatTransferTimestamps.push(tsOf(log.blockNumber))
  }

  result.delegationEvents.sort((a, b) => a.timestamp - b.timestamp)
  result.seatTransferTimestamps.sort((a, b) => a - b)
  return result
}

/**
 * Authoritative deadlines for the given proposal ids via multicall, falling
 * back to sequential reads when the chain has no multicall3.
 */
export async function fetchTransactionDeadlines(
  client: PublicClient,
  chamber: `0x${string}`,
  transactionIds: bigint[],
): Promise<Map<bigint, bigint>> {
  const deadlines = new Map<bigint, bigint>()
  if (transactionIds.length === 0) return deadlines
  try {
    const results = await client.multicall({
      contracts: transactionIds.map(
        (transactionId) =>
          ({
            address: chamber,
            abi: chamberAbi,
            functionName: 'getTransactionDeadline',
            args: [transactionId],
          }) as const,
      ),
    })
    for (let i = 0; i < transactionIds.length; i++) {
      const result = results[i]
      if (result.status === 'success') deadlines.set(transactionIds[i], result.result as bigint)
    }
    return deadlines
  } catch {
    const FALLBACK_LIMIT = 200
    for (const transactionId of transactionIds.slice(0, FALLBACK_LIMIT)) {
      try {
        const deadline = await client.readContract({
          address: chamber,
          abi: chamberAbi,
          functionName: 'getTransactionDeadline',
          args: [transactionId],
        })
        deadlines.set(transactionId, deadline as bigint)
      } catch {
        // Leave unset — treated as "no deadline" downstream.
      }
    }
    return deadlines
  }
}

/** Assemble the full snapshot: current board state + decoded event history. */
export async function fetchComplianceSnapshot(
  client: PublicClient,
  chamber: `0x${string}`,
  nft: `0x${string}`,
  windowDays: number,
): Promise<ComplianceSnapshot> {
  const [seatsResult, topResult] = await Promise.all([
    client.readContract({ address: chamber, abi: chamberAbi, functionName: 'getSeats' }),
    client.readContract({
      address: chamber,
      abi: chamberAbi,
      functionName: 'getTop',
      args: [50n],
    }),
  ])
  const seatCount = Number(seatsResult as bigint)
  const [tokenIds, amounts] = topResult as [bigint[], bigint[]]
  const members = tokenIds
    .map((tokenId, i) => ({ tokenId, amount: amounts[i] ?? 0n }))
    .filter((member) => member.amount > 0n)

  const ageSeconds = windowDays * DAY_SECONDS
  const fromBlock = await getBlockAtAge(client, ageSeconds)
  const toBlock = await client.getBlockNumber()
  const events = await fetchComplianceEvents(client, chamber, nft, fromBlock, toBlock)

  const executedById = new Map<bigint, number>()
  for (const event of events.executed) {
    // Keep the earliest execution per proposal.
    const existing = executedById.get(event.transactionId)
    if (existing === undefined || event.timestamp < existing) {
      executedById.set(event.transactionId, event.timestamp)
    }
  }
  const cancelledIds = new Set(events.cancelled.map((event) => event.transactionId))

  const txIds = new Set<bigint>([
    ...events.submitted.map((event) => event.transactionId),
    ...executedById.keys(),
  ])
  const deadlines = await fetchTransactionDeadlines(client, chamber, [...txIds])

  const txs: TxTimelineEntry[] = []
  for (const transactionId of txIds) {
    const submitted = events.submitted.find((event) => event.transactionId === transactionId)
    const executedAt = executedById.get(transactionId)
    if (!submitted && executedAt === undefined) continue
    const deadline = deadlines.get(transactionId) ?? 0n
    txs.push({
      transactionId,
      submittedAt: submitted?.timestamp ?? executedAt ?? 0,
      executedAt,
      deadline: Number(deadline),
    })
  }

  return {
    seats: seatCount,
    members,
    txs: txs.filter(
      (tx) => !cancelledIds.has(tx.transactionId) || tx.executedAt !== undefined,
    ),
    events,
    fromBlock,
    toBlock,
  }
}
