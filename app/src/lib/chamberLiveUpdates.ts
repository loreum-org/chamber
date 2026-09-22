import { alchemySupportsChain, getAlchemyV2RpcUrl, getAlchemyWssUrl } from '@/lib/alchemy'

/** Visible-tab fallback when the active chain has no WebSocket transport. */
export const CHAMBER_LIVE_POLL_MS = 60_000

export const LOCAL_WS_URL = 'ws://127.0.0.1:8545'

export type ChamberLiveUpdateMode = 'websocket' | 'poll' | 'idle'

export type RpcTransportKind = 'http' | 'webSocket'

export type PlannedRpcTransport = {
  kind: RpcTransportKind
  url: string
}

/**
 * HTTP first (same Alchemy → public fallback as #274), WebSocket last so
 * `eth_call` stays on HTTP. viem's fallback uses the WS only for subscribe
 * (`eth_subscribe`); HTTP transports have no subscribe method.
 */
export function planRemoteChainTransports(input: {
  chainId: number
  publicUrl: string
  alchemyApiKey: string | undefined
}): PlannedRpcTransport[] {
  const plan: PlannedRpcTransport[] = []
  if (input.alchemyApiKey && alchemySupportsChain(input.chainId)) {
    const alchemyHttp = getAlchemyV2RpcUrl(input.chainId, input.alchemyApiKey)
    if (alchemyHttp) plan.push({ kind: 'http', url: alchemyHttp })
  }
  plan.push({ kind: 'http', url: input.publicUrl })
  if (input.alchemyApiKey && alchemySupportsChain(input.chainId)) {
    const alchemyWss = getAlchemyWssUrl(input.chainId, input.alchemyApiKey)
    if (alchemyWss) plan.push({ kind: 'webSocket', url: alchemyWss })
  }
  return plan
}

export function planLocalChainTransports(httpUrl: string): PlannedRpcTransport[] {
  return [
    { kind: 'http', url: httpUrl },
    { kind: 'webSocket', url: LOCAL_WS_URL },
  ]
}

export function getChamberWebsocketUrl(input: {
  chainId: number
  alchemyApiKey: string | undefined
  localChainId: number
}): string | undefined {
  if (input.chainId === input.localChainId) return LOCAL_WS_URL
  if (!input.alchemyApiKey) return undefined
  return getAlchemyWssUrl(input.chainId, input.alchemyApiKey) ?? undefined
}

export function chainOffersWebsocketTransport(input: {
  chainId: number
  alchemyApiKey: string | undefined
  localChainId: number
}): boolean {
  return getChamberWebsocketUrl(input) !== undefined
}

export function resolveChamberLiveUpdateMode(input: {
  tabVisible: boolean
  websocketAvailable: boolean
}): ChamberLiveUpdateMode {
  if (!input.tabVisible) return 'idle'
  return input.websocketAvailable ? 'websocket' : 'poll'
}
