import { describe, expect, it } from 'vitest'
import { create } from 'cuer/QrCode'

describe('WalletConnect QR encoding', () => {
  it('encodes a URI after the cuer border patch', () => {
    const qr = create('wc:example@2?relay-protocol=irn&symKey=aa')
    expect(qr.edgeLength).toBeGreaterThan(20)
    expect(qr.grid).toHaveLength(qr.edgeLength)
    expect(qr.grid.every((row) => row.length === qr.edgeLength)).toBe(true)
  })
})
