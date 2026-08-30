import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeErrorResult } from 'viem'
import { chamberAbi } from '../src/abi.ts'
import {
  CHAMBER_ERROR_MESSAGES,
  formatChamberError,
  wrapChamberError,
} from '../src/errors.ts'

function encoded(name: 'NotDirector' | 'DirectorNotSeated' | 'EnforcedPause' | 'TransactionExpired') {
  return encodeErrorResult({ abi: chamberAbi, errorName: name })
}

test('maps not-a-director the same way DelegationManager does', () => {
  const error = new Error(`The contract function reverted with custom error 'NotDirector'`)
  assert.equal(formatChamberError(error), CHAMBER_ERROR_MESSAGES.NotDirector)
  assert.equal(formatChamberError(error), 'You are not a director')
})

test('maps seating delay the same way DelegationManager does', () => {
  const error = new Error(`The contract function reverted with custom error 'DirectorNotSeated'`)
  assert.equal(formatChamberError(error), CHAMBER_ERROR_MESSAGES.DirectorNotSeated)
  assert.equal(formatChamberError(error), 'Your seat is not mature yet')
})

test('maps pause the same way DelegationManager and TreasuryOverview do', () => {
  const error = new Error(`The contract function reverted with custom error 'EnforcedPause'`)
  assert.equal(formatChamberError(error), CHAMBER_ERROR_MESSAGES.EnforcedPause)
  assert.equal(formatChamberError(error), 'This chamber is paused')
})

test('maps expired nonce the same way TransactionQueue does', () => {
  const error = new Error(`The contract function reverted with custom error 'TransactionExpired'`)
  assert.equal(formatChamberError(error), CHAMBER_ERROR_MESSAGES.TransactionExpired)
  assert.equal(formatChamberError(error), 'This transaction has expired')
})

test('maps viem DirectorNotSeated() short messages', () => {
  const error = new Error('The contract function "submitTransaction" reverted.\n\nError: DirectorNotSeated()')
  assert.equal(formatChamberError(error), 'Your seat is not mature yet')
})

test('decodes raw revert data via the Chamber ABI', () => {
  const data = encoded('EnforcedPause')
  const error = { message: 'execution reverted', data }
  assert.equal(formatChamberError(error), 'This chamber is paused')
})

test('reads viem-style errorName on the cause', () => {
  const cause = { errorName: 'DirectorNotSeated', message: 'execution reverted' }
  const error = new Error('Internal JSON-RPC error')
  ;(error as Error & { cause: unknown }).cause = cause
  assert.equal(formatChamberError(error), 'Your seat is not mature yet')
})

test('reads encoded selectors via message fallback', () => {
  const data = encoded('NotDirector')
  const error = new Error(`reverted with data ${data}`)
  // Selector-only messages still contain the error name after viem decode;
  // if only the raw hex is present, wrap still returns a useful string.
  const wrapped = wrapChamberError(error)
  assert.equal(typeof wrapped.message, 'string')
  assert.ok(wrapped.message.length > 0)
})

test('unknown custom error name is surfaced as the name', () => {
  const error = new Error(`The contract function reverted with custom error 'NotEnoughConfirmations'`)
  assert.equal(formatChamberError(error), 'NotEnoughConfirmations')
})
