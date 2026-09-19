import { describe, expect, it } from 'vitest'
import {
  computeHhi,
  hhiReading,
  computeSeatStability,
  computePolicyCompliance,
  computeComplianceMetrics,
  dailyBuckets,
  delegationAmountsAt,
  median,
  formatDuration,
  csvEscape,
  csvRow,
  windowStart,
  type DelegationPair,
  type TxTimelineEntry,
} from './complianceMetrics'
import { sparklineGeometry } from './sparklineSvg'
import { buildComplianceCsv } from './complianceExport'
import type { ComplianceSnapshot } from './complianceQuery'

const DAY = 86_400

describe('computeHhi', () => {
  it('is 1/N for a perfectly even board', () => {
    expect(computeHhi([10n, 10n, 10n, 10n])).toBeCloseTo(0.25, 10)
    expect(computeHhi([5n, 5n])).toBeCloseTo(0.5, 10)
  })

  it('is 1 for a single holder holding everything', () => {
    expect(computeHhi([100n])).toBeCloseTo(1, 10)
    expect(computeHhi([100n, 0n])).toBeCloseTo(1, 10)
  })

  it('squares shares: [3,1] → 0.625', () => {
    expect(computeHhi([3n, 1n])).toBeCloseTo((0.75) ** 2 + (0.25) ** 2, 10)
  })

  it('returns null with no delegated weight', () => {
    expect(computeHhi([])).toBeNull()
    expect(computeHhi([0n, 0n])).toBeNull()
  })
})

describe('hhiReading', () => {
  it('reads low near the even-split floor', () => {
    expect(hhiReading(0.25, 4)).toBe('Low concentration') // ratio 1.0
    expect(hhiReading(0.3, 4)).toBe('Low concentration') // ratio 1.2
  })
  it('reads moderate then high', () => {
    expect(hhiReading(0.6, 4)).toBe('High concentration') // ratio 2.4
    expect(hhiReading(0.4, 4)).toBe('Moderate concentration') // ratio 1.6
  })
})

describe('computeSeatStability', () => {
  it('is 1 with no churn', () => {
    expect(computeSeatStability(0, 10)).toBe(1)
  })
  it('scales with churn count and floors at zero', () => {
    expect(computeSeatStability(1, 10)).toBeCloseTo(0.9)
    expect(computeSeatStability(20, 10)).toBe(0)
  })
  it('is null without seats', () => {
    expect(computeSeatStability(1, 0)).toBeNull()
  })
})

describe('computePolicyCompliance', () => {
  it('counts executions before deadline only', () => {
    const txs: TxTimelineEntry[] = [
      { transactionId: 1n, submittedAt: 0, executedAt: 100, deadline: 200 },
      { transactionId: 2n, submittedAt: 0, executedAt: 300, deadline: 200 },
      { transactionId: 3n, submittedAt: 0, executedAt: 50 }, // no deadline → excluded
    ]
    expect(computePolicyCompliance(txs)).toBeCloseTo(0.5, 10)
  })

  it('is null when nothing had a deadline', () => {
    expect(computePolicyCompliance([{ transactionId: 1n, submittedAt: 0, executedAt: 1 }])).toBeNull()
    expect(computePolicyCompliance([{ transactionId: 1n, submittedAt: 0 }])).toBeNull()
  })
})

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats human durations', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(600)).toBe('10m')
    expect(formatDuration(4.2 * 3600)).toBe('4.2h')
    expect(formatDuration(3 * 86_400 + 4 * 3600)).toBe('3d 4h')
  })
})

describe('delegationAmountsAt', () => {
  const now = 10_000
  const makeEvents = (
    pairs: Array<[string, bigint, bigint, number]>,
  ): DelegationPair[] =>
    pairs.map(([holder, tokenId, amount, timestamp]) => ({ holder, tokenId, amount, timestamp }))

  it('sums latest per-pair values and carries current totals backwards', () => {
    const currentMembers = [
      { tokenId: 1n, amount: 100n },
      { tokenId: 2n, amount: 100n },
    ]
    const pairs = makeEvents([
      ['0xaaa', 1n, 60n, 5_000],
      ['0xaaa', 1n, 80n, 9_000], // latest for pair at t ≥ 9_000
      ['0xbbb', 2n, 20n, 9_500],
    ])
    // At t=4_000 nothing has happened yet → current totals carried back.
    expect(delegationAmountsAt(pairs, currentMembers, 4_000)).toEqual([100n, 100n])
    // At t=12_000: token1 = 80 (latest), token2 = 20 (latest).
    expect(delegationAmountsAt(pairs, currentMembers, now)).toEqual([80n, 20n])
    // At t=6_000: token1's pair event at 5_000 → 60; token2 has no event yet,
    // so its current total (100) is carried backwards.
    expect(delegationAmountsAt(pairs, currentMembers, 6_000)).toEqual([60n, 100n])
  })
})

describe('dailyBuckets / windowStart', () => {
  function dayStamp(days: number): number {
    return days * DAY
  }
  it('produces windowDays inclusive buckets ending today', () => {
    const now = dayStamp(100)
    const buckets = dailyBuckets(now, 30)
    expect(buckets).toHaveLength(30)
    expect(buckets[0]).toBe(windowStart(now, 30))
    expect(buckets[buckets.length - 1]).toBe(now)
  })
})

describe('computeComplianceMetrics', () => {
  const now = 30 * DAY
  const base = {
    now,
    windowDays: 30,
    seats: 4,
    currentMembers: [
      { tokenId: 1n, amount: 30n },
      { tokenId: 2n, amount: 30n },
      { tokenId: 3n, amount: 20n },
      { tokenId: 4n, amount: 20n },
    ],
    delegationEvents: [] as DelegationPair[],
    seatTransferTimestamps: [] as number[],
    txs: [] as TxTimelineEntry[],
  }

  it('computes current values and full-length series', () => {
    const metrics = computeComplianceMetrics(base)
    expect(metrics.hhi).toBeCloseTo(0.09 + 0.09 + 0.04 + 0.04, 6) // shares .3/.3/.2/.2
    expect(metrics.seatStability).toBe(1)
    expect(metrics.hhiSeries).toHaveLength(30)
    expect(metrics.seatStabilitySeries).toHaveLength(30)
    expect(metrics.timeToExecuteSeries).toHaveLength(30)
    expect(metrics.policyComplianceSeries).toHaveLength(30)
    expect(metrics.hhiReading).toBe('Low concentration')
    expect(metrics.medianTimeToExecuteSec).toBeNull()
    expect(metrics.policyComplianceRate).toBeNull()
  })

  it('computes median time-to-execute and window-scoped counts', () => {
    const txs: TxTimelineEntry[] = [
      { transactionId: 1n, submittedAt: 5 * DAY, executedAt: 10 * DAY }, // 5d
      { transactionId: 2n, submittedAt: 20 * DAY, executedAt: 20 * DAY + 3_600 }, // 1h
      { transactionId: 3n, submittedAt: 20 * DAY, executedAt: 20 * DAY + 1_800 }, // 30m
      { transactionId: 4n, submittedAt: 40 * DAY, executedAt: 41 * DAY }, // outside window
    ]
    const metrics = computeComplianceMetrics({ ...base, txs })
    expect(metrics.medianTimeToExecuteSec).toBe(3_600)
    expect(metrics.executedCount).toBe(3)
    expect(metrics.submittedCount).toBe(3)
    // Day-20 bucket holds tx 2 and 3 → median 45m.
    const day20 = metrics.timeToExecuteSeries.find((p) => p.timestamp === 20 * DAY)
    expect(day20?.value).toBe((3_600 + 1_800) / 2)
  })

  it('tracks policy compliance per executed day', () => {
    const txs: TxTimelineEntry[] = [
      { transactionId: 1n, submittedAt: 10 * DAY, executedAt: 11 * DAY, deadline: 11 * DAY + 100 },
      { transactionId: 2n, submittedAt: 10 * DAY, executedAt: 11 * DAY, deadline: 10 * DAY + 100 },
      { transactionId: 3n, submittedAt: 10 * DAY, executedAt: 12 * DAY }, // no deadline
    ]
    const metrics = computeComplianceMetrics({ ...base, txs })
    expect(metrics.policyComplianceRate).toBeCloseTo(0.5, 10)
    const day11 = metrics.policyComplianceSeries.find((p) => p.timestamp === 11 * DAY)
    expect(day11?.value).toBeCloseTo(0.5, 10)
  })

  it('counts seat churn from transfer timestamps', () => {
    const metrics = computeComplianceMetrics({
      ...base,
      seatTransferTimestamps: [10 * DAY, 29 * DAY],
    })
    expect(metrics.churnCount).toBe(2)
    expect(metrics.seatStability).toBeCloseTo(0.5, 10)
  })
})

describe('sparklineGeometry', () => {
  it('maps values across the box and tolerates nulls', () => {
    const { polyline, points } = sparklineGeometry([1, null, 3], 100, 40, 2)
    expect(points).toHaveLength(2)
    expect(points[0].x).toBe(2)
    expect(points[points.length - 1].x).toBe(98)
    expect(polyline).toContain('98.0')
  })
  it('returns null geometry for empty input', () => {
    expect(sparklineGeometry([], 100, 40).polyline).toBeNull()
  })
})

describe('CSV export', () => {
  it('builds summary, series and transaction sections with escaped values', () => {
    const now = 30 * DAY
    const metrics = computeComplianceMetrics({
      now,
      windowDays: 30,
      seats: 3,
      currentMembers: [{ tokenId: 1n, amount: 5n }, { tokenId: 2n, amount: 5n }],
      delegationEvents: [],
      seatTransferTimestamps: [],
      txs: [
        { transactionId: 1n, submittedAt: 20 * DAY, executedAt: 21 * DAY, deadline: 21 * DAY + 60 },
      ],
    })
    const snapshot = {
      seats: 3,
      members: [{ tokenId: 1n, amount: 5n }],
      txs: [
        { transactionId: 1n, submittedAt: 20 * DAY, executedAt: 21 * DAY, deadline: 21 * DAY + 60 },
      ],
      events: {
        delegationEvents: [],
        submitted: [],
        executed: [],
        cancelled: [],
        seatTransferTimestamps: [],
        seatSizeChanges: [],
        windowFromTs: 0,
        windowToTs: now,
      },
      fromBlock: 0n,
      toBlock: 100n,
    } satisfies ComplianceSnapshot
    const csv = buildComplianceCsv({
      chamberAddress: '0x0000000000000000000000000000000000000001',
      chamberLabel: 'Chamber 0x0000…01',
      networkLabel: 'Sepolia',
      chainId: 11155111,
      explorerAddressUrl: '',
      generatedBy: '0xabc',
      generatedAt: now,
      windowDays: 30,
      metrics,
      snapshot,
      exportSequence: 1,
    })
    expect(csv).toContain('delegation_hhi')
    expect(csv).toContain('Daily metric series')
    expect(csv).toContain('Transaction log')
    expect(csv).toContain('21')
    expect(csv).toContain('yes')
    expect(csv.split('\n').length).toBeGreaterThan(40)
  })
})

describe('csvEscape', () => {
  it('quotes values containing separators', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvRow(['a', 'b,c'])).toBe('a,"b,c"')
  })
})