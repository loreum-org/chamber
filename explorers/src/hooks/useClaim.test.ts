import { describe, it, expect } from 'vitest'
import { classifyClaimError } from './useClaim'

describe('classifyClaimError', () => {
  it('classifies user rejected (User rejected)', () => {
    expect(classifyClaimError(new Error('User rejected the request'))).toBe('user_rejected')
  })

  it('classifies user denied', () => {
    expect(classifyClaimError(new Error('User denied transaction signature'))).toBe('user_rejected')
  })

  it('classifies action_rejected', () => {
    expect(classifyClaimError(new Error('action_rejected'))).toBe('user_rejected')
  })

  it('classifies insufficient funds as price_changed', () => {
    expect(classifyClaimError(new Error('Insufficient funds for gas'))).toBe('price_changed')
  })

  it('classifies value mismatch as price_changed', () => {
    expect(classifyClaimError(new Error('Incorrect value sent'))).toBe('price_changed')
  })

  it('classifies max mint exceeded as wallet_limit', () => {
    expect(classifyClaimError(new Error('Exceeds MAX_MINT per wallet'))).toBe('wallet_limit')
  })

  it('classifies allocation exceeded as wallet_limit', () => {
    expect(classifyClaimError(new Error('Allocation exceeded for this address'))).toBe('wallet_limit')
  })

  it('classifies sold out', () => {
    expect(classifyClaimError(new Error('Sold out — MAX_SUPPLY reached'))).toBe('sold_out')
  })

  it('classifies max supply exceeded as sold_out', () => {
    expect(classifyClaimError(new Error('Max supply exceeded'))).toBe('sold_out')
  })

  it('returns unknown for unrecognized errors', () => {
    expect(classifyClaimError(new Error('Something completely different'))).toBe('unknown')
  })

  it('returns unknown for null/undefined', () => {
    expect(classifyClaimError(null)).toBe('unknown')
    expect(classifyClaimError(undefined)).toBe('unknown')
  })

  it('handles string errors', () => {
    expect(classifyClaimError('User rejected the request')).toBe('user_rejected')
  })
})
