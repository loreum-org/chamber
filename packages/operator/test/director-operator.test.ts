import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decodeFunctionData, encodeErrorResult, encodeFunctionData } from 'viem'
import { chamberAbi, directorOperatorAbi } from '../src/abi.ts'
import { ChamberOperator, SESSION_SCOPE_UNSCOPED } from '../src/client.ts'
import { formatChamberError } from '../src/errors.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZERO = '0x0000000000000000000000000000000000000000' as const

function abiNames(kind: 'function' | 'event' | 'error'): string[] {
  return chamberAbi.flatMap((item) =>
    item.type === kind && 'name' in item ? [item.name] : [],
  )
}

test('ChamberOperator exposes session-key read, set, and clear', () => {
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperatorScope, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperatorLiveAt, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorSession, 'function')
  assert.equal(typeof ChamberOperator.prototype.setDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.clearDirectorOperator, 'function')
})

test('generated-plus-IChamber ABI exposes session-key read/set/event', () => {
  const functions = abiNames('function')
  const events = abiNames('event')
  const errors = abiNames('error')
  assert.ok(functions.includes('getDirectorOperator'))
  assert.ok(functions.includes('getDirectorOperatorScope'))
  assert.ok(functions.includes('getDirectorOperatorLiveAt'))
  assert.ok(functions.includes('getDirectorSession'))
  assert.ok(functions.includes('setDirectorOperator'))
  assert.ok(events.includes('DirectorOperatorSet'))
  assert.ok(errors.includes('InvalidSessionExpiry'))
  assert.ok(errors.includes('InvalidSessionScope'))
  assert.equal(directorOperatorAbi.length, 8)
})

test('chamberAbi encodes setDirectorOperator(tokenId, operator, expiry, scope)', () => {
  const session = '0x0000000000000000000000000000000000000B0b' as const
  const expiry = 1_893_456_000n
  const setData = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [3n, session, expiry, SESSION_SCOPE_UNSCOPED],
  })
  const setDecoded = decodeFunctionData({ abi: chamberAbi, data: setData })
  assert.equal(setDecoded.functionName, 'setDirectorOperator')
  assert.equal(setDecoded.args[0], 3n)
  assert.equal((setDecoded.args[1] as string).toLowerCase(), session.toLowerCase())
  assert.equal(setDecoded.args[2], expiry)
  assert.equal(setDecoded.args[3], SESSION_SCOPE_UNSCOPED)

  const clearData = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [3n, ZERO, 0n, 0],
  })
  const clearDecoded = decodeFunctionData({ abi: chamberAbi, data: clearData })
  assert.equal(clearDecoded.functionName, 'setDirectorOperator')
  assert.equal(clearDecoded.args[1], ZERO)
  assert.equal(clearDecoded.args[2], 0n)
  assert.equal(clearDecoded.args[3], 0)

  const readData = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'getDirectorOperator',
    args: [3n],
  })
  const readDecoded = decodeFunctionData({ abi: chamberAbi, data: readData })
  assert.equal(readDecoded.functionName, 'getDirectorOperator')
  assert.deepEqual([...readDecoded.args], [3n])
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
  assert.match(cli, /set-operator\s+setDirectorOperator\(tokenId, operator, expiry, scope\)/)
  assert.match(cli, /clear-operator\s+setDirectorOperator\(tokenId, address\(0\), 0, 0\)/)
  assert.match(cli, /case 'operator':/)
  assert.match(cli, /case 'set-operator':/)
  assert.match(cli, /case 'clear-operator':/)
  assert.match(cli, /There is no\nERC-1271 fallback/)
  assert.match(cli, /--expiry/)
  assert.match(cli, /--scope/)
})

test('README documents session keys, EOA rejection, and no 1271 fallback', async () => {
  const readme = await readFile(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /getDirectorOperator/)
  assert.match(readme, /setDirectorOperator/)
  assert.match(readme, /clearDirectorOperator/)
  assert.match(readme, /SESSION_SCOPE_UNSCOPED/)
  assert.match(readme, /chamber-operator operator/)
  assert.match(readme, /chamber-operator set-operator/)
  assert.match(readme, /chamber-operator clear-operator/)
  assert.match(readme, /EOA-owned membership NFTs are rejected/)
  assert.match(readme, /no ERC-1271 fallback/)
})
