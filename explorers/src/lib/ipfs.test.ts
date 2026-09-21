import { describe, it, expect } from 'vitest'
import { ipfsToGatewayUrl } from './ipfs'

describe('ipfsToGatewayUrl', () => {
  it('converts ipfs:// URI to gateway URL', () => {
    const url = ipfsToGatewayUrl('ipfs://QmTest123/metadata.json')
    expect(url).toBe('https://cloudflare-ipfs.com/ipfs/QmTest123/metadata.json')
  })

  it('passes through https:// URLs unchanged', () => {
    const url = ipfsToGatewayUrl('https://example.com/metadata.json')
    expect(url).toBe('https://example.com/metadata.json')
  })

  it('wraps bare CID with gateway prefix', () => {
    const url = ipfsToGatewayUrl('QmTest123/metadata.json')
    expect(url).toBe('https://cloudflare-ipfs.com/ipfs/QmTest123/metadata.json')
  })

  it('uses specified gateway index', () => {
    const url = ipfsToGatewayUrl('ipfs://QmTest123', 1)
    expect(url).toBe('https://ipfs.io/ipfs/QmTest123')
  })

  it('falls back to first gateway for out-of-range index', () => {
    const url = ipfsToGatewayUrl('ipfs://QmTest123', 99)
    expect(url).toBe('https://cloudflare-ipfs.com/ipfs/QmTest123')
  })
})
