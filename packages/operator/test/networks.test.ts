import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NETWORKS, resolveNetwork } from '../src/networks.ts'
import { ChamberOperatorError } from '../src/errors.ts'

test('resolveNetwork maps the four testnets to their chain ids', () => {
  assert.equal(resolveNetwork('sepolia').chain.id, 11155111)
  assert.equal(resolveNetwork('base-sepolia').chain.id, 84532)
  assert.equal(resolveNetwork('arbitrum-sepolia').chain.id, 421614)
  assert.equal(resolveNetwork('op-sepolia').chain.id, 11155420)
  assert.equal(Object.keys(NETWORKS).length, 4)
})

test('resolveNetwork rejects an unknown name with the valid list', () => {
  assert.throws(
    () => resolveNetwork('optimism'),
    (err: unknown) => err instanceof ChamberOperatorError && /op-sepolia/.test(err.message),
  )
})
