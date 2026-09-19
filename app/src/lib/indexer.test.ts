import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  IndexerBehindError,
  indexerRequest,
  indexerRetry,
  parseIndexerHead,
  requireIndexerBlock,
} from './indexer'

const status = (number: number) => ({
  sepolia: { ready: true, block: { number, timestamp: 1788458532 } },
})

function mockIndexer(blockNumber: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data: { _meta: { status: status(blockNumber) } } }))),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseIndexerHead', () => {
  it('reads Ponder _meta.status block and ready flag', () => {
    expect(parseIndexerHead(status(11628179))).toEqual({
      number: 11628179n,
      timestamp: 1788458532n,
      ready: true,
    })
  })

  it('returns undefined before the first block is indexed', () => {
    expect(parseIndexerHead({ sepolia: { ready: false, block: null } })).toBeUndefined()
    expect(parseIndexerHead(undefined)).toBeUndefined()
  })
})

describe('indexerRequest freshness gate', () => {
  const chamber = '0x75FEFf5494b5825C43687Deee979e5CDdFCb8a08'

  it('throws IndexerBehindError until the indexer reaches the write block', async () => {
    requireIndexerBlock(chamber, 200n)
    mockIndexer(199)
    await expect(
      indexerRequest('{ _meta { status } }', {}, { url: 'http://indexer.test', chamber }),
    ).rejects.toBeInstanceOf(IndexerBehindError)

    mockIndexer(200)
    const { head } = await indexerRequest('{ _meta { status } }', {}, {
      url: 'http://indexer.test',
      chamber: chamber.toLowerCase(),
    })
    expect(head?.number).toBe(200n)
  })

  it('does not gate other chambers', async () => {
    mockIndexer(1)
    await expect(
      indexerRequest('{ _meta { status } }', {}, { url: 'http://indexer.test', chamber: '0x0000000000000000000000000000000000000001' }),
    ).resolves.toBeDefined()
  })

  it('keeps retrying while behind, but only twice on other errors', () => {
    expect(indexerRetry(10, new IndexerBehindError(1n, 2n))).toBe(true)
    expect(indexerRetry(2, new Error('Indexer HTTP 502'))).toBe(false)
  })
})
