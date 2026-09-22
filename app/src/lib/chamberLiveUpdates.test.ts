import { describe, expect, it } from 'vitest'
import {
  CHAMBER_LIVE_POLL_MS,
  LOCAL_WS_URL,
  chainOffersWebsocketTransport,
  planLocalChainTransports,
  planRemoteChainTransports,
  resolveChamberLiveUpdateMode,
} from './chamberLiveUpdates'

const SEPOLIA = 11155111
const MAINNET = 1
const LOCAL = 31337
const KEY = 'test-alchemy-key'

describe('planRemoteChainTransports', () => {
  it('keeps Alchemy HTTP then public HTTP, with WSS last for subscribe', () => {
    const plan = planRemoteChainTransports({
      chainId: SEPOLIA,
      publicUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
      alchemyApiKey: KEY,
    })
    expect(plan).toEqual([
      { kind: 'http', url: `https://eth-sepolia.g.alchemy.com/v2/${KEY}` },
      { kind: 'http', url: 'https://ethereum-sepolia-rpc.publicnode.com' },
      { kind: 'webSocket', url: `wss://eth-sepolia.g.alchemy.com/v2/${KEY}` },
    ])
  })

  it('does not add a WebSocket when Alchemy is unset', () => {
    const plan = planRemoteChainTransports({
      chainId: MAINNET,
      publicUrl: 'https://eth.llamarpc.com',
      alchemyApiKey: undefined,
    })
    expect(plan).toEqual([{ kind: 'http', url: 'https://eth.llamarpc.com' }])
  })
})

describe('planLocalChainTransports', () => {
  it('pairs Anvil HTTP with the local WS endpoint', () => {
    expect(planLocalChainTransports('http://127.0.0.1:8545')).toEqual([
      { kind: 'http', url: 'http://127.0.0.1:8545' },
      { kind: 'webSocket', url: LOCAL_WS_URL },
    ])
  })
})

describe('chainOffersWebsocketTransport', () => {
  it('is true for the local chain and Alchemy-backed remote chains', () => {
    expect(
      chainOffersWebsocketTransport({
        chainId: LOCAL,
        alchemyApiKey: undefined,
        localChainId: LOCAL,
      }),
    ).toBe(true)
    expect(
      chainOffersWebsocketTransport({
        chainId: SEPOLIA,
        alchemyApiKey: KEY,
        localChainId: LOCAL,
      }),
    ).toBe(true)
  })

  it('is false for public-HTTP-only remote chains', () => {
    expect(
      chainOffersWebsocketTransport({
        chainId: SEPOLIA,
        alchemyApiKey: undefined,
        localChainId: LOCAL,
      }),
    ).toBe(false)
  })
})

describe('resolveChamberLiveUpdateMode', () => {
  it('stays idle while the tab is hidden', () => {
    expect(resolveChamberLiveUpdateMode({ tabVisible: false, websocketAvailable: true })).toBe(
      'idle',
    )
    expect(resolveChamberLiveUpdateMode({ tabVisible: false, websocketAvailable: false })).toBe(
      'idle',
    )
  })

  it('prefers a single WS subscribe, else a 60s visible poll', () => {
    expect(resolveChamberLiveUpdateMode({ tabVisible: true, websocketAvailable: true })).toBe(
      'websocket',
    )
    expect(resolveChamberLiveUpdateMode({ tabVisible: true, websocketAvailable: false })).toBe(
      'poll',
    )
    expect(CHAMBER_LIVE_POLL_MS).toBe(60_000)
  })
})
