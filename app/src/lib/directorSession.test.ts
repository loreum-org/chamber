import { describe, expect, it } from 'vitest'
import { isLiveSession } from './directorSession'

const KEY = '0x0000000000000000000000000000000000000B0b' as const
const ZERO = '0x0000000000000000000000000000000000000000' as const

describe('isLiveSession', () => {
  it('is live while the setting owner still holds the NFT', () => {
    expect(isLiveSession({ rawOperator: KEY, operatorAuthorized: true, sessionOwnerAuthorized: true })).toBe(true)
  })

  it('is not live after the NFT moves to the operator itself', () => {
    // The operator is now the owner (authorized), but the stored session owner is not.
    expect(isLiveSession({ rawOperator: KEY, operatorAuthorized: true, sessionOwnerAuthorized: false })).toBe(false)
  })

  it('is not live when the key is expired or unset', () => {
    expect(isLiveSession({ rawOperator: KEY, operatorAuthorized: false, sessionOwnerAuthorized: true })).toBe(false)
    expect(isLiveSession({ rawOperator: ZERO, operatorAuthorized: true, sessionOwnerAuthorized: true })).toBe(false)
    expect(isLiveSession({ rawOperator: undefined, operatorAuthorized: true, sessionOwnerAuthorized: true })).toBe(false)
  })
})
