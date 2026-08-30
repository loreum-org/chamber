import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSeatingMature } from '../src/seating.ts'

test('grandfathered seats (seatedAt == 0) are mature', () => {
  assert.equal(isSeatingMature(0n, 1n), true)
})

test('undefined seatedAt is not mature', () => {
  assert.equal(isSeatingMature(undefined, 10n), false)
})

test('seat is pending until block.number >= seatedAt', () => {
  assert.equal(isSeatingMature(10n, 9n), false)
  assert.equal(isSeatingMature(10n, 10n), true)
  assert.equal(isSeatingMature(10n, 11n), true)
})
