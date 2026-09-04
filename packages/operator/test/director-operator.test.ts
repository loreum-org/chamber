import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { encodeErrorResult } from 'viem'
import { chamberAbi, directorOperatorAbi } from '../src/abi.ts'
import { ChamberOperator } from '../src/client.ts'
import { formatChamberError } from '../src/errors.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function abiNames(kind: 'function' | 'event'): string[] {
  return chamberAbi.flatMap((item) =>
    item.type === kind && 'name' in item ? [item.name] : [],
  )
}

test('ChamberOperator exposes session-key read, set, and clear', () => {
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.setDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.clearDirectorOperator, 'function')
})

test('generated-plus-IChamber ABI exposes session-key read/set/event', () => {
  const functions = abiNames('function')
  const events = abiNames('event')
  assert.ok(functions.includes('getDirectorOperator'))
  assert.ok(functions.includes('setDirectorOperator'))
  assert.ok(events.includes('DirectorOperatorSet'))
  assert.equal(directorOperatorAbi.length, 3)
})

test('session-key writes decode NotDirector the same as other director calls', () => {
  const data = encodeErrorResult({ abi: chamberAbi, errorName: 'NotDirector' })
  const error = {
    message: 'The contract function "setDirectorOperator" reverted.',
    data,
  }
  assert.equal(formatChamberError(error), 'You are not a director')
})

test('CLI documents operator / set-operator / clear-operator in the existing style', async () => {
  const cli = await readFile(join(ROOT, 'src/cli.ts'), 'utf8')
  assert.match(cli, /operator\s+Read live session-key operator/)
  assert.match(cli, /set-operator\s+setDirectorOperator/)
  assert.match(cli, /clear-operator\s+setDirectorOperator\(tokenId, address\(0\)\)/)
  assert.match(cli, /case 'operator':/)
  assert.match(cli, /case 'set-operator':/)
  assert.match(cli, /case 'clear-operator':/)
  assert.match(cli, /There is no\nERC-1271 fallback/)
})

test('README documents session keys, EOA rejection, and no 1271 fallback', async () => {
  const readme = await readFile(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /getDirectorOperator/)
  assert.match(readme, /setDirectorOperator/)
  assert.match(readme, /clearDirectorOperator/)
  assert.match(readme, /chamber-operator operator/)
  assert.match(readme, /chamber-operator set-operator/)
  assert.match(readme, /chamber-operator clear-operator/)
  assert.match(readme, /EOA-owned membership NFTs are rejected/)
  assert.match(readme, /no ERC-1271 fallback/)
})
