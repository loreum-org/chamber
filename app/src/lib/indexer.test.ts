import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  IndexerBehindError,
  fetchIndexerMyChambers,
  indexerRequest,
  indexerRetry,
  parseIndexerChainIds,
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

describe('parseIndexerChainIds', () => {
  it('defaults to Base Sepolia', () => {
    expect(parseIndexerChainIds(undefined, undefined)).toEqual([84532])
  })

  it('reads a comma-separated list and ignores junk', () => {
    expect(parseIndexerChainIds('84532, 421614, no, 11155420', '1')).toEqual([
      84532, 421614, 11155420,
    ])
  })

  it('keeps the single-id variable when the list is unset', () => {
    expect(parseIndexerChainIds(undefined, '11155111')).toEqual([11155111])
    expect(parseIndexerChainIds('   ', '421614')).toEqual([421614])
  })
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

  it('reads the network for the requested chain', () => {
    const status = {
      baseSepolia: { ready: true, block: { number: 10, timestamp: 1 } },
      arbitrumSepolia: { ready: true, block: { number: 20, timestamp: 2 } },
    }
    expect(parseIndexerHead(status, 421614)).toEqual({
      number: 20n,
      timestamp: 2n,
      ready: true,
    })
    expect(parseIndexerHead(status, 11155420)).toBeUndefined()
    expect(parseIndexerHead({ sepolia: { chainId: 11155111, ready: true, block: { number: 3, timestamp: 4 } } }, 11155111)?.number).toBe(3n)
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

  it('does not gate the same address on another chain', async () => {
    requireIndexerBlock(chamber, 500n, 84532)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              _meta: {
                status: {
                  baseSepolia: { ready: true, block: { number: 1, timestamp: 1 } },
                  arbitrumSepolia: { ready: true, block: { number: 20, timestamp: 2 } },
                },
              },
            },
          }),
        ),
      ),
    )
    const { head } = await indexerRequest('{ _meta { status } }', {}, {
      url: 'http://indexer.test',
      chamber,
      chainId: 421614,
    })
    expect(head?.number).toBe(20n)
    await expect(
      indexerRequest('{ _meta { status } }', {}, {
        url: 'http://indexer.test',
        chamber,
        chainId: 84532,
      }),
    ).rejects.toBeInstanceOf(IndexerBehindError)
  })

  it('sends chainId with MyChambers', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { created: { items: [] }, held: { items: [] } } })),
    )
    vi.stubGlobal('fetch', fetchMock)
    await fetchIndexerMyChambers(
      'http://indexer.test',
      '0x0000000000000000000000000000000000000001',
      84532,
    )
    const call = fetchMock.mock.calls[0] as unknown as [string, { body: string }] | undefined
    const body = JSON.parse(call?.[1].body ?? '{}')
    expect(body.variables).toEqual({
      account: '0x0000000000000000000000000000000000000001',
      chainId: 84532,
    })
    expect(body.query).toContain('chainId: $chainId')
  })

  it('keeps retrying while behind, but only twice on other errors', () => {
    expect(indexerRetry(10, new IndexerBehindError(1n, 2n))).toBe(true)
    expect(indexerRetry(2, new Error('Indexer HTTP 502'))).toBe(false)
  })
})
