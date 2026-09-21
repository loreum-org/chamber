import { describe, it, expect } from 'vitest'
import { loreumNftAbi } from './loreumNft'

describe('loreumNftAbi', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(loreumNftAbi)).toBe(true)
    expect(loreumNftAbi.length).toBeGreaterThan(0)
  })

  it('contains expected read functions', () => {
    const fnNames = loreumNftAbi
      .filter((item) => item.type === 'function')
      .map((item) => item.name)
    expect(fnNames).toContain('name')
    expect(fnNames).toContain('symbol')
    expect(fnNames).toContain('totalSupply')
    expect(fnNames).toContain('ownerOf')
    expect(fnNames).toContain('tokenURI')
    expect(fnNames).toContain('balanceOf')
  })

  it('contains Transfer event', () => {
    const events = loreumNftAbi.filter((item) => item.type === 'event')
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].name).toBe('Transfer')
  })
})
