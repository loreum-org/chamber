import { QueryClient } from '@tanstack/react-query'
import { hashFn } from '@wagmi/core/query'
import { describe, expect, it } from 'vitest'
import { invalidateChamberQueries } from '@/hooks/invalidateChamberQueries'
import { queryKeyIncludes } from './queryKeyMatch'

const chamber = '0x1111111111111111111111111111111111111111'
const other = '0x2222222222222222222222222222222222222222'

/** Shape of wagmi `readContractQueryKey` for `getTop(uint256)`. */
function getTopKey(address: string) {
  return ['readContract', { address, functionName: 'getTop', args: [20n], chainId: 1 }] as const
}

/** The previous predicate. `JSON.stringify` throws on bigint and the catch skipped the query. */
function legacyQueryKeyMatch(queryKey: readonly unknown[], needle: string): boolean {
  try {
    return JSON.stringify(queryKey).toLowerCase().includes(needle.toLowerCase())
  } catch {
    return false
  }
}

describe('queryKeyIncludes', () => {
  it('matches getTop even though JSON.stringify throws on the bigint arg', () => {
    const key = getTopKey(chamber)
    expect(() => JSON.stringify(key)).toThrow(TypeError)
    expect(legacyQueryKeyMatch(key, chamber)).toBe(false)
    expect(queryKeyIncludes(key, chamber)).toBe(true)
    expect(queryKeyIncludes(key, other)).toBe(false)
  })

  it('still matches string keys used by balance and delegation reads', () => {
    const key = ['readContract', { address: chamber, functionName: 'getDelegations', args: [other] }]
    expect(queryKeyIncludes(key, chamber)).toBe(true)
    expect(queryKeyIncludes(key, other)).toBe(true)
    expect(queryKeyIncludes(key, '0x3333333333333333333333333333333333333333')).toBe(false)
  })

  it('matches a checksummed address case-insensitively', () => {
    const key = ['readContract', { address: '0xAbCdEf0000000000000000000000000000000001', args: [1n] }]
    expect(queryKeyIncludes(key, '0xabcdef0000000000000000000000000000000001')).toBe(true)
  })
})

describe('invalidateChamberQueries', () => {
  it('invalidates a cached getTop read whose key contains bigint args', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { queryKeyHashFn: hashFn, retry: false } },
    })
    const key = getTopKey(chamber)
    const unrelated = getTopKey(other)
    await queryClient.prefetchQuery({ queryKey: key, queryFn: () => Promise.resolve('empty-board') })
    await queryClient.prefetchQuery({ queryKey: unrelated, queryFn: () => Promise.resolve('other-board') })

    await invalidateChamberQueries(queryClient, chamber as `0x${string}`)

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(unrelated)?.isInvalidated).toBe(false)
  })
})
