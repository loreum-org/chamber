import { describe, expect, it } from 'vitest'
import { isLiveSession, isSelfSession } from './directorSession'

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

describe('isLiveSession: self-registered key (operator == sessionOwner == owner)', () => {
  // Both isTokenAuthorized reads pass via the owner branch, so liveness must mirror
  // Chamber._isLiveSessionKey: owner has code and expiry != 0 && now <= expiry.
  const SELF = '0x00000000000000000000000000000000000000A1' as const
  const base = { rawOperator: SELF, operatorAuthorized: true, sessionOwnerAuthorized: true, sessionOwner: SELF }

  it('detects self sessions case-insensitively', () => {
    expect(isSelfSession(SELF, SELF.replace('A1', 'a1'))).toBe(true)
    expect(isSelfSession(KEY, SELF)).toBe(false)
    expect(isSelfSession(undefined, SELF)).toBe(false)
  })

  it('is live while unexpired and the owner has code', () => {
    expect(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 200n, ownerHasCode: true })).toBe(true)
  })

  it('is NOT live once expired, even though both isTokenAuthorized reads pass', () => {
    expect(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 201n, ownerHasCode: true })).toBe(false)
    expect(isLiveSession({ ...base, rawExpiry: 0n, nowSec: 1n, ownerHasCode: true })).toBe(false)
  })

  it('is NOT live when the owner lost its code (revoked EIP-7702 delegation)', () => {
    expect(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 100n, ownerHasCode: false })).toBe(false)
  })

  it('fails closed while block timestamp or bytecode is not loaded', () => {
    expect(isLiveSession({ ...base, rawExpiry: 200n, ownerHasCode: true })).toBe(false)
    expect(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 100n })).toBe(false)
  })

  it('does not need the extra inputs for a normal key (operator != sessionOwner)', () => {
    expect(
      isLiveSession({ rawOperator: KEY, operatorAuthorized: true, sessionOwnerAuthorized: true, sessionOwner: SELF }),
    ).toBe(true)
  })
})
