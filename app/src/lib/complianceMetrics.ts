/**
 * Compliance metric computations — pure functions, no RPC / React dependencies.
 *
 * All four governance-health metrics (#261) are computed from decoded on-chain
 * event history over a trailing window (30 days by default):
 *
 * - Delegation HHI: sum of squared seat shares of delegated voting weight.
 *   Perfectly even N seats → 1/N. Reading compares HHI to that floor.
 * - Seat stability: fraction of board seats with no director-token transfer
 *   (mint, burn, or sale) inside the window.
 * - Median time-to-execute: median seconds from TransactionSubmitted to
 *   TransactionExecuted for proposals executed in the window.
 * - Policy compliance rate: share of executed proposals that executed strictly
 *   before their set deadline (deadline == 0 proposals are excluded).
 *
 * Methodology notes for the dashboard tooltips and PDF export live in
 * `METHODOLOGY_NOTES`.
 */

export interface MetricPoint {
  /** Unix seconds (day bucket start). */
  timestamp: number
  /** Metric value; null when the day has no observable data. */
  value: number | null
}

export interface DelegationPair {
  holder: string
  tokenId: bigint
  /** Unix seconds of the DelegationUpdated log. */
  timestamp: number
  /** Absolute holder delegation to tokenId (DelegationUpdated emits totals). */
  amount: bigint
}

export interface BoardMemberAmounts {
  tokenId: bigint
  amount: bigint
}

export interface TxTimelineEntry {
  transactionId: bigint
  submittedAt: number
  executedAt?: number
  /** Exclusive-after unix timestamp; 0 / undefined = no deadline set. */
  deadline?: number
}

export interface ComplianceInputs {
  /** Unix seconds; series buckets end at `now`. */
  now: number
  windowDays: number
  /** Current board size (getSeats). */
  seats: number
  /** Current board delegation amounts per seat tokenId (getTop). */
  currentMembers: BoardMemberAmounts[]
  /** DelegationUpdated events inside the window (absolute amounts, time-ascending). */
  delegationEvents: DelegationPair[]
  /** Director-token transfer timestamps inside the window. */
  seatTransferTimestamps: number[]
  /** Proposals submitted before `now` (submitted and/or executed in the window). */
  txs: TxTimelineEntry[]
}

export interface ComplianceMetrics {
  windowDays: number
  seats: number
  hhi: number | null
  hhiReading: string
  seatStability: number | null
  medianTimeToExecuteSec: number | null
  policyComplianceRate: number | null
  hhiSeries: MetricPoint[]
  seatStabilitySeries: MetricPoint[]
  timeToExecuteSeries: MetricPoint[]
  policyComplianceSeries: MetricPoint[]
  executedCount: number
  submittedCount: number
  churnCount: number
}

/** Per-widget methodology copy, reused by dashboard tooltips and the PDF report. */
export const METHODOLOGY_NOTES: Record<string, string> = {
  hhi:
    'Delegation HHI is the sum of squared shares of delegated voting weight across board seats ' +
    '(Σ (seat share)²). A perfectly even N-seat board scores 1/N; the plain-English reading ' +
    'compares the score to that floor (≤1.25× = Low, ≤2× = Moderate, otherwise High). ' +
    'Computed from current board delegation (getTop) and DelegationUpdated events.',
  seatStability:
    'Seat stability is the fraction of board seats with no director-token transfer (mint, burn, ' +
    'or sale) during the trailing window, from ERC-721 Transfer events on the chamber NFT. ' +
    'A score of 100% means no seats changed hands; 90% with 10 seats means one seat changed.',
  timeToExecute:
    'Median seconds from TransactionSubmitted to TransactionExecuted for proposals executed in ' +
    'the trailing window. Measures governance throughput; days with no executions are omitted ' +
    'from the trend rather than counted as zero.',
  policyCompliance:
    'Share of proposals executed in the trailing window that executed strictly before their ' +
    'configured deadline (submitTransaction deadline parameter). Proposals submitted with no ' +
    'deadline (deadline = 0) are excluded from the rate and flagged in the export.',
  approximations:
    'Historical delegation amounts are approximated from events: DelegationUpdated emits ' +
    'absolute holder→seat balances, so a seat with no delegation event yet in the window ' +
    'carries its current total backwards. Seat count uses the current getSeats value across ' +
    'the window. Data is queried directly from RPC logs — no indexer is required.',
}

const DAY_SECONDS = 86_400
/** Trailing churn window for the daily seat-stability series. */
export const CHURN_TRAIL_DAYS = 7

export function dayStart(timestamp: number): number {
  return Math.floor(timestamp / DAY_SECONDS) * DAY_SECONDS
}

/** Inclusive start of the trailing `windowDays` window ending at `now`. */
export function windowStart(now: number, windowDays: number): number {
  return dayStart(now) - (windowDays - 1) * DAY_SECONDS
}

/** Daily bucket starts for the trailing window (oldest first). */
export function dailyBuckets(now: number, windowDays: number): number[] {
  const buckets: number[] = []
  const start = windowStart(now, windowDays)
  for (let ts = start; ts <= dayStart(now); ts += DAY_SECONDS) {
    buckets.push(ts)
  }
  return buckets
}

/**
 * HHI over board seat shares: Σ (amount_i / total)². Returns null when there is
 * no delegated weight (nothing to concentrate).
 */
export function computeHhi(amounts: bigint[]): number | null {
  const live = amounts.filter((a) => a > 0n)
  if (live.length === 0) return null
  let total = 0n
  for (const amount of live) total += amount
  if (total === 0n) return null
  let hhi = 0
  for (const amount of live) {
    const share = Number(amount) / Number(total)
    hhi += share * share
  }
  return hhi
}

/**
 * Plain-English concentration reading. The even-split floor is 1/N, so the
 * ratio hhi × seats is 1.0 for a perfectly even board.
 */
export function hhiReading(hhi: number, seats: number): string {
  if (seats <= 0) return 'No seats'
  const ratio = hhi * seats
  if (ratio <= 1.25) return 'Low concentration'
  if (ratio <= 2) return 'Moderate concentration'
  return 'High concentration'
}

/**
 * Per-seat delegation totals at `timestamp`, reconstructed from events.
 *
 * Approximation (documented in METHODOLOGY_NOTES.approximations): for each seat
 * tokenId, use the sum of the latest known holder→seat amounts with events at
 * or before `timestamp`; seats with no in-window event carry their current
 * getTop total backwards. Requires `events` sorted by timestamp ascending.
 */
export function delegationAmountsAt(
  events: DelegationPair[],
  currentMembers: BoardMemberAmounts[],
  timestamp: number,
): bigint[] {
  const currentByToken = new Map<string, bigint>()
  for (const member of currentMembers) {
    if (member.amount <= 0n) continue
    currentByToken.set(member.tokenId.toString(), member.amount)
  }

  const tokensWithEvents = new Set<string>()
  // Latest value per (holder, tokenId) pair at or before `timestamp` —
  // DelegationUpdated emits absolute balances, so last write wins per pair.
  const perPairLatest = new Map<string, bigint>()
  const pairTokens = new Map<string, string>()
  for (const event of events) {
    if (event.timestamp > timestamp) break
    const pairKey = `${event.holder.toLowerCase()}:${event.tokenId.toString()}`
    perPairLatest.set(pairKey, event.amount)
    pairTokens.set(pairKey, event.tokenId.toString())
  }
  const totals = new Map<string, bigint>()
  for (const [pairKey, amount] of perPairLatest) {
    const tokenIdKey = pairTokens.get(pairKey) as string
    tokensWithEvents.add(tokenIdKey)
    totals.set(tokenIdKey, (totals.get(tokenIdKey) ?? 0n) + amount)
  }
  for (const [tokenIdKey, amount] of currentByToken) {
    if (!tokensWithEvents.has(tokenIdKey)) totals.set(tokenIdKey, amount)
  }
  return [...totals.values()]
}

/** Median of a numeric list (average of the two middle values for even length). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Share of executed proposals that met their deadline. Proposals without a
 * deadline are excluded (they had no policy to violate).
 */
export function computePolicyCompliance(txs: TxTimelineEntry[]): number | null {
  let compliant = 0
  let withDeadline = 0
  for (const tx of txs) {
    if (tx.executedAt === undefined) continue
    if (!tx.deadline || tx.deadline <= 0) continue
    withDeadline += 1
    if (tx.executedAt <= tx.deadline) compliant += 1
  }
  if (withDeadline === 0) return null
  return compliant / withDeadline
}

/** Seat stability: 1 − churn/seats, floored at 0. */
export function computeSeatStability(churnCount: number, seats: number): number | null {
  if (seats <= 0) return null
  return Math.max(0, 1 - churnCount / seats)
}

function executedInBucket(tx: TxTimelineEntry, bucketStart: number): boolean {
  if (tx.executedAt === undefined) return false
  return tx.executedAt >= bucketStart && tx.executedAt < bucketStart + DAY_SECONDS
}

/** Core computation: current values + daily series for all four metrics. */
export function computeComplianceMetrics(inputs: ComplianceInputs): ComplianceMetrics {
  const buckets = dailyBuckets(inputs.now, inputs.windowDays)
  const startTs = windowStart(inputs.now, inputs.windowDays)

  const hhiSeries: MetricPoint[] = buckets.map((bucketStart) => {
    const bucketEnd = bucketStart + DAY_SECONDS
    const amounts = delegationAmountsAt(
      inputs.delegationEvents,
      inputs.currentMembers,
      Math.min(bucketEnd, inputs.now),
    )
    return { timestamp: bucketStart, value: computeHhi(amounts) }
  })

  const seatStabilitySeries: MetricPoint[] = buckets.map((bucketStart) => {
    const trailStart = bucketStart - (CHURN_TRAIL_DAYS - 1) * DAY_SECONDS
    const churn = inputs.seatTransferTimestamps.filter(
      (ts) => ts >= trailStart && ts < bucketStart + DAY_SECONDS,
    ).length
    return { timestamp: bucketStart, value: computeSeatStability(churn, inputs.seats) }
  })

  const allExecutionTimes: number[] = []
  const timeToExecuteSeries: MetricPoint[] = []
  const policyComplianceSeries: MetricPoint[] = []
  for (const bucketStart of buckets) {
    const dayTxs = inputs.txs.filter((tx) => executedInBucket(tx, bucketStart))
    const times = dayTxs
      .filter((tx) => tx.executedAt !== undefined)
      .map((tx) => (tx.executedAt as number) - tx.submittedAt)
      .filter((seconds) => seconds >= 0)
    timeToExecuteSeries.push({ timestamp: bucketStart, value: median(times) })
    policyComplianceSeries.push({
      timestamp: bucketStart,
      value: computePolicyCompliance(dayTxs),
    })
    allExecutionTimes.push(...times)
  }

  const executed = inputs.txs.filter(
    (tx) =>
      tx.executedAt !== undefined &&
      tx.executedAt >= startTs &&
      tx.executedAt <= inputs.now,
  )
  const churnCount = inputs.seatTransferTimestamps.filter((ts) => ts >= startTs).length

  const hhi = computeHhi(inputs.currentMembers.map((member) => member.amount))

  return {
    windowDays: inputs.windowDays,
    seats: inputs.seats,
    hhi,
    hhiReading: hhi === null ? 'No delegated weight' : hhiReading(hhi, inputs.seats),
    seatStability: computeSeatStability(churnCount, inputs.seats),
    medianTimeToExecuteSec: median(allExecutionTimes),
    policyComplianceRate: computePolicyCompliance(executed),
    hhiSeries,
    seatStabilitySeries,
    timeToExecuteSeries,
    policyComplianceSeries,
    executedCount: executed.length,
    submittedCount: inputs.txs.filter(
      (tx) => tx.submittedAt >= startTs && tx.submittedAt <= inputs.now,
    ).length,
    churnCount,
  }
}

/** Human duration: "4.2h", "3d 4h", "12m", "45s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${(seconds / 3_600).toFixed(1)}h`
  const days = Math.floor(seconds / 86_400)
  const hours = Math.round((seconds % 86_400) / 3_600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

/** Health band for color coding: green / yellow / red. */
export type HealthBand = 'ok' | 'warn' | 'bad'

export function hhiBand(hhi: number, seats: number): HealthBand {
  const ratio = seats > 0 ? hhi * seats : Infinity
  if (ratio <= 1.25) return 'ok'
  if (ratio <= 2) return 'warn'
  return 'bad'
}

export function seatStabilityBand(stability: number): HealthBand {
  if (stability >= 0.9) return 'ok'
  if (stability >= 0.7) return 'warn'
  return 'bad'
}

export function timeToExecuteBand(seconds: number): HealthBand {
  if (seconds <= 6 * 3_600) return 'ok'
  if (seconds <= 86_400) return 'warn'
  return 'bad'
}

export function policyComplianceBand(rate: number): HealthBand {
  if (rate >= 0.95) return 'ok'
  if (rate >= 0.8) return 'warn'
  return 'bad'
}

/** CSV escape: quote when the value contains a comma, quote, or newline. */
export function csvEscape(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',')
}
