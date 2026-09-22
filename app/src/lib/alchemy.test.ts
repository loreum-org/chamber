import { describe, expect, it } from 'vitest'
import { alchemySupportsChain, getAlchemyV2RpcUrl, getAlchemyWssUrl } from './alchemy'

describe('Alchemy RPC URLs', () => {
  it('maps supported chains to the v2 HTTP and WSS hosts', () => {
    expect(alchemySupportsChain(11155111)).toBe(true)
    expect(getAlchemyV2RpcUrl(11155111, 'key')).toBe('https://eth-sepolia.g.alchemy.com/v2/key')
    expect(getAlchemyWssUrl(11155111, 'key')).toBe('wss://eth-sepolia.g.alchemy.com/v2/key')
    expect(getAlchemyWssUrl(1, 'key')).toBe('wss://eth-mainnet.g.alchemy.com/v2/key')
  })

  it('returns null for an unsupported chain or empty key', () => {
    expect(getAlchemyWssUrl(10, 'key')).toBeNull()
    expect(getAlchemyWssUrl(11155111, '')).toBeNull()
  })
})
