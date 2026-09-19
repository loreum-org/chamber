import { describe, it, expect } from 'vitest'

/**
 * Extracted from Migrate.tsx for unit testing.
 * Maps Safe signers to Chamber board seats using a scoring heuristic.
 */
function recommendSignerToSeatMapping(
  signers: string[],
  seats: number,
  threshold: number,
): { signer: string; seatIndex: number; confidence: 'high' | 'medium' | 'low'; reason: string }[] {
  if (signers.length === 0) return []

  const effectiveSeats = Math.min(signers.length, seats)
  const sorted = [...signers].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const evenBucket = sorted.filter((s) => parseInt(s.slice(-2), 16) % 2 === 0)
  const oddBucket = sorted.filter((s) => parseInt(s.slice(-2), 16) % 2 !== 0)

  const ordered: string[] = []
  const maxLen = Math.max(evenBucket.length, oddBucket.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < evenBucket.length) ordered.push(evenBucket[i])
    if (i < oddBucket.length) ordered.push(oddBucket[i])
  }

  const thresholdRatio = threshold / signers.length
  const confidence: 'high' | 'medium' | 'low' =
    thresholdRatio >= 0.67 ? 'high' : thresholdRatio >= 0.34 ? 'medium' : 'low'

  return ordered.slice(0, effectiveSeats).map((signer, idx) => ({
    signer,
    seatIndex: idx,
    confidence,
    reason:
      confidence === 'high'
        ? `${Math.round(thresholdRatio * 100)}% threshold ratio — active governance`
        : confidence === 'medium'
          ? `${Math.round(thresholdRatio * 100)}% threshold — moderate activity`
          : `${Math.round(thresholdRatio * 100)}% threshold — low participation signal`,
  }))
}

describe('recommendSignerToSeatMapping', () => {
  const signers = [
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x0000000000000000000000000000000000000003',
    '0x0000000000000000000000000000000000000004',
    '0x0000000000000000000000000000000000000005',
  ]

  it('returns empty for no signers', () => {
    expect(recommendSignerToSeatMapping([], 5, 3)).toEqual([])
  })

  it('maps all signers when seats >= signers', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 3)
    expect(result).toHaveLength(5)
    expect(result.map((r) => r.seatIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('caps mapping at seat count when signers > seats', () => {
    const result = recommendSignerToSeatMapping(signers, 3, 2)
    expect(result).toHaveLength(3)
  })

  it('assigns unique seat indices', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 3)
    const seats = result.map((r) => r.seatIndex)
    expect(new Set(seats).size).toBe(seats.length)
  })

  it('assigns unique signers', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 3)
    const assigned = result.map((r) => r.signer)
    expect(new Set(assigned).size).toBe(assigned.length)
  })

  it('rates high confidence for 2/3+ threshold', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 4)
    expect(result[0].confidence).toBe('high')
  })

  it('rates medium confidence for 34-66% threshold', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 2)
    expect(result[0].confidence).toBe('medium')
  })

  it('rates low confidence for <34% threshold', () => {
    const result = recommendSignerToSeatMapping(signers, 5, 1)
    expect(result[0].confidence).toBe('low')
  })

  it('is deterministic across calls', () => {
    const a = recommendSignerToSeatMapping(signers, 5, 3)
    const b = recommendSignerToSeatMapping(signers, 5, 3)
    expect(a).toEqual(b)
  })

  it('produces balanced even/odd distribution', () => {
    // With addresses ending 01-05: odd=01,03,05 even=02,04
    // Interleaved: even[0], odd[0], even[1], odd[1], odd[2]
    const result = recommendSignerToSeatMapping(signers, 5, 3)
    const lastBytes = result.map((r) => parseInt(r.signer.slice(-2), 16))
    const evens = lastBytes.filter((b) => b % 2 === 0).length
    const odds = lastBytes.filter((b) => b % 2 !== 0).length
    // Should be roughly balanced (2 evens, 3 odds or 3 evens, 2 odds)
    expect(Math.abs(evens - odds)).toBeLessThanOrEqual(1)
  })
})
