import { describe, it, expect } from 'vitest'
import { isBeyondSupply } from './beyondSupply'

describe('isBeyondSupply', () => {
  it('treats the latest 1-indexed mint as minted (tokenId === totalSupply)', () => {
    expect(isBeyondSupply(5n, 5n)).toBe(false)
    expect(isBeyondSupply(1n, 1n)).toBe(false)
  })

  it('marks ids past totalSupply as beyond supply', () => {
    expect(isBeyondSupply(6n, 5n)).toBe(true)
    expect(isBeyondSupply(2n, 1n)).toBe(true)
  })

  it('treats earlier minted ids as in supply', () => {
    expect(isBeyondSupply(1n, 5n)).toBe(false)
    expect(isBeyondSupply(4n, 5n)).toBe(false)
  })

  it('is not beyond supply while totalSupply is unknown', () => {
    expect(isBeyondSupply(1n, undefined)).toBe(false)
  })
})
