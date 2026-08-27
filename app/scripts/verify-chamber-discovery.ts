/**
 * Offline checks for indexer parsing + chunked getLogs (no live Ponder host).
 * Run: npx tsx scripts/verify-chamber-discovery.ts
 */
import assert from 'node:assert/strict'
import { parseIndexerMyChambers } from '../src/lib/indexer.ts'
import {
  INDEXER_CATCHUP_BLOCKS,
  UNBOUNDED_LOOKBACK_BLOCKS,
  clampDiscoveryFromBlock,
  getEventLogsPaged,
  parseStartBlock,
  SEPOLIA_DISCOVERY_START_BLOCK,
  factoryCreatedEvent,
} from '../src/lib/chamberDiscovery.ts'
import type { PublicClient } from 'viem'

function testParseIndexer() {
  const parsed = parseIndexerMyChambers({
    data: {
      created: {
        items: [
          {
            id: '0x1111111111111111111111111111111111111111',
            address: '0x1111111111111111111111111111111111111111',
            creator: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            source: 'factory',
          },
        ],
      },
      held: {
        items: [
          {
            shares: '1',
            chamber: {
              id: '0x2222222222222222222222222222222222222222',
              creator: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              source: 'registry',
            },
          },
          { chamber: { address: '0x0' } },
        ],
      },
    },
  })
  assert.equal(parsed.created.length, 1)
  assert.equal(parsed.created[0]?.address, '0x1111111111111111111111111111111111111111')
  assert.equal(parsed.created[0]?.creator, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  assert.equal(parsed.held.length, 1)
  assert.equal(parsed.held[0]?.address, '0x2222222222222222222222222222222222222222')
}

function testStartBlocks() {
  assert.equal(parseStartBlock('7453704'), 7453704n)
  assert.equal(parseStartBlock(''), undefined)
  assert.equal(parseStartBlock('nope'), undefined)
  assert.equal(SEPOLIA_DISCOVERY_START_BLOCK, 7453704n)

  const latest = 8_000_000n
  assert.equal(clampDiscoveryFromBlock(7453704n, latest, false), 7453704n)
  const catchup = clampDiscoveryFromBlock(7453704n, latest, true)
  assert.equal(catchup, latest - INDEXER_CATCHUP_BLOCKS)
  assert.ok(latest - catchup > 14_400n, 'catch-up window exceeds ~48h of 12s blocks')

  const unbounded = clampDiscoveryFromBlock(0n, 5_000_000n, false)
  assert.equal(unbounded, 5_000_000n - UNBOUNDED_LOOKBACK_BLOCKS)
}

async function testPagedLogs() {
  const calls: Array<{ from: bigint; to: bigint }> = []
  const client = {
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      calls.push({ from: fromBlock, to: toBlock })
      if (toBlock - fromBlock + 1n > 2_000n) {
        throw new Error('block range too large')
      }
      if (fromBlock <= 3_500n && toBlock >= 3_500n) {
        return [
          {
            args: {
              chamber: '0x3333333333333333333333333333333333333333',
              creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          },
        ]
      }
      return []
    },
  } as unknown as PublicClient

  const logs = await getEventLogsPaged(client, {
    address: '0x43aa92c8a26392f21f63cda88b6bab5031c40550',
    event: factoryCreatedEvent,
    fromBlock: 0n,
    toBlock: 10_000n,
  })

  assert.ok(
    calls[0] && calls[0].to - calls[0].from + 1n > 2_000n,
    'first attempt is the full range (not getLogs-from-0-only success path)',
  )
  assert.ok(
    calls.some((c) => c.to - c.from + 1n <= 2_000n),
    'fallback pages into RPC-legal chunks',
  )
  assert.equal(logs.length, 1)
  assert.equal(
    (logs[0] as { args: { chamber: string } }).args.chamber,
    '0x3333333333333333333333333333333333333333',
  )
}

testParseIndexer()
testStartBlocks()
await testPagedLogs()
console.log('verify-chamber-discovery: ok')
