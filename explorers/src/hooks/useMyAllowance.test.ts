import { describe, it, expect } from 'vitest'
import { computeClaimable } from './useMyAllowance'

describe('computeClaimable', () => {
  it('full allowance when nothing minted', () => {
    // MAX_MINT=100, MAX_SUPPLY=10000, totalMinted=0, totalSupply=0
    const { claimable, reason } = computeClaimable(0n, 0n, 10000n, 100n)
    expect(claimable).toBe(100n)
    expect(reason).toBe('ok')
  })

  it('reduces by wallet usage', () => {
    // Already minted 3, MAX_MINT=100 → 97 remaining
    const { claimable, reason } = computeClaimable(3n, 50n, 10000n, 100n)
    expect(claimable).toBe(97n)
    expect(reason).toBe('ok')
  })

  it('global remaining is the bottleneck', () => {
    // MAX_SUPPLY=10000, totalSupply=9995, MAX_MINT=100, totalMinted=0
    // walletRemaining=100, globalRemaining=5 → min=5
    const { claimable, reason } = computeClaimable(0n, 9995n, 10000n, 100n)
    expect(claimable).toBe(5n)
    expect(reason).toBe('ok')
  })

  it('wallet_limit when wallet cap reached but supply remains', () => {
    // totalMinted=100, MAX_MINT=100 → walletRemaining=0, globalRemaining=5000
    const { claimable, reason } = computeClaimable(100n, 5000n, 10000n, 100n)
    expect(claimable).toBe(0n)
    expect(reason).toBe('wallet_limit')
  })

  it('sold_out when supply exhausted', () => {
    // totalSupply=10000, MAX_SUPPLY=10000 → globalRemaining=0
    const { claimable, reason } = computeClaimable(0n, 10000n, 10000n, 100n)
    expect(claimable).toBe(0n)
    expect(reason).toBe('sold_out')
  })

  it('sold_out takes priority when both limits hit', () => {
    // Both at max: totalMinted=100, totalSupply=10000
    const { claimable, reason } = computeClaimable(100n, 10000n, 10000n, 100n)
    expect(claimable).toBe(0n)
    expect(reason).toBe('sold_out')
  })

  it('floors at zero (never negative)', () => {
    // Over-allocated wallet: totalMinted=150, MAX_MINT=100
    const { claimable } = computeClaimable(150n, 5000n, 10000n, 100n)
    expect(claimable).toBe(0n)
  })

  it('works with large numbers', () => {
    // Simulating mainnet: MAX_SUPPLY=10000, MAX_MINT=100
    const { claimable, reason } = computeClaimable(50n, 5000n, 10000n, 100n)
    expect(claimable).toBe(50n)
    expect(reason).toBe('ok')
  })
})
