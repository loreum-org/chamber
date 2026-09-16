import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decodeFunctionData, encodeErrorResult, encodeFunctionData, toFunctionSelector } from 'viem'
import { chamberAbi, directorOperatorAbi } from '../src/abi.ts'
import { ChamberOperator } from '../src/client.ts'
import { formatChamberError } from '../src/errors.ts'
import {
  DEFAULT_SESSION_EXPIRY_DAYS,
  SESSION_SCOPE_CONFIRM,
  SESSION_SCOPE_UNSCOPED,
  defaultSessionExpiry,
  describeSessionScope,
  directorSessionStatus,
  directorSessionStatusLabel,
  isValidSessionExpiry,
} from '../src/session.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZERO = '0x0000000000000000000000000000000000000000' as const
const SESSION = '0x0000000000000000000000000000000000000B0b' as const

function abiItem(kind: 'function' | 'event' | 'error', name: string) {
  return chamberAbi.find((item) => item.type === kind && 'name' in item && item.name === name)
}

test('ChamberOperator exposes M04 session-key read, set, and clear', () => {
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperatorScope, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperatorLiveAt, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorSession, 'function')
  assert.equal(typeof ChamberOperator.prototype.getDirectorOperatorState, 'function')
  assert.equal(typeof ChamberOperator.prototype.setDirectorOperator, 'function')
  assert.equal(typeof ChamberOperator.prototype.clearDirectorOperator, 'function')
})

test('generated-plus-IChamber ABI exposes the M04 4-arg session-key surface', () => {
  const setFn = abiItem('function', 'setDirectorOperator')
  assert.ok(setFn && 'inputs' in setFn)
  assert.deepEqual(
    setFn.inputs.map((input) => input.type),
    ['uint256', 'address', 'uint256', 'uint32'],
  )
  assert.ok(abiItem('function', 'getDirectorOperator'))
  assert.ok(abiItem('function', 'getDirectorOperatorScope'))
  assert.ok(abiItem('function', 'getDirectorOperatorLiveAt'))
  assert.ok(abiItem('function', 'getDirectorSession'))
  const event = abiItem('event', 'DirectorOperatorSet')
  assert.ok(event && 'inputs' in event)
  assert.deepEqual(
    event.inputs.map((input) => input.name),
    ['tokenId', 'owner', 'operator', 'expiry', 'scope'],
  )
  assert.ok(abiItem('error', 'InvalidSessionExpiry'))
  assert.ok(abiItem('error', 'InvalidSessionScope'))
  assert.equal(directorOperatorAbi.length, 8)
})

test('chamberAbi encodes 4-arg setDirectorOperator and live readers', () => {
  const expiry = 1_893_456_000n
  const setData = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [3n, SESSION, expiry, SESSION_SCOPE_UNSCOPED],
  })
  const setDecoded = decodeFunctionData({ abi: chamberAbi, data: setData })
  assert.equal(setDecoded.functionName, 'setDirectorOperator')
  assert.equal(setDecoded.args[0], 3n)
  assert.equal((setDecoded.args[1] as string).toLowerCase(), SESSION.toLowerCase())
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

  for (const [functionName, expected] of [
    ['getDirectorOperator', [3n]],
    ['getDirectorOperatorScope', [3n]],
    ['getDirectorOperatorLiveAt', [3n]],
    ['getDirectorSession', [3n]],
  ] as const) {
    const data = encodeFunctionData({ abi: chamberAbi, functionName, args: [3n] })
    const decoded = decodeFunctionData({ abi: chamberAbi, data })
    assert.equal(decoded.functionName, functionName)
    assert.deepEqual([...decoded.args], expected)
  }
})

test('4-arg selector is not the pre-M04 2-arg selector', () => {
  const four = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [1n, SESSION, 1_893_456_000n, SESSION_SCOPE_UNSCOPED],
  })
  const fourSelector = toFunctionSelector('setDirectorOperator(uint256,address,uint256,uint32)')
  const twoSelector = toFunctionSelector('setDirectorOperator(uint256,address)')
  assert.equal(four.slice(0, 10), fourSelector)
  assert.notEqual(fourSelector, twoSelector)
  assert.equal(four.length, 2 + 8 + 4 * 64)
})

test('session-key writes decode NotDirector and M04 session errors', () => {
  const notDirector = encodeErrorResult({ abi: chamberAbi, errorName: 'NotDirector' })
  assert.equal(
    formatChamberError({
      message: 'The contract function "setDirectorOperator" reverted.',
      data: notDirector,
    }),
    'You are not a director',
  )

  const badExpiry = encodeErrorResult({ abi: chamberAbi, errorName: 'InvalidSessionExpiry' })
  assert.equal(
    formatChamberError({
      message: 'The contract function "setDirectorOperator" reverted.',
      data: badExpiry,
    }),
    'Session expiry must be a future unix timestamp (0 is rejected)',
  )

  const badScope = encodeErrorResult({ abi: chamberAbi, errorName: 'InvalidSessionScope' })
  assert.equal(
    formatChamberError({
      message: 'The contract function "setDirectorOperator" reverted.',
      data: badScope,
    }),
    'Session scope 0 is rejected; use SESSION_SCOPE_UNSCOPED for full access',
  )
})

test('defaults and status helpers match M04 rules', () => {
  assert.equal(DEFAULT_SESSION_EXPIRY_DAYS, 30)
  const expiry = defaultSessionExpiry(1_700_000_000_000)
  assert.equal(expiry, 1_700_000_000n + 30n * 24n * 60n * 60n)
  assert.equal(isValidSessionExpiry(0n, 1_700_000_000), false)
  assert.equal(isValidSessionExpiry(1_700_000_001n, 1_700_000_000), true)
  assert.equal(describeSessionScope(SESSION_SCOPE_UNSCOPED), 'unscoped (all actions)')
  assert.equal(describeSessionScope(SESSION_SCOPE_CONFIRM), 'confirm')
  assert.equal(describeSessionScope(0), 'none')

  assert.equal(
    directorSessionStatus({
      liveOperator: SESSION,
      rawOperator: SESSION,
      rawExpiry: 2_000_000_000n,
      liveAt: 10n,
      blockNumber: 9n,
    }),
    'delayed',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: SESSION,
      rawOperator: SESSION,
      rawExpiry: 2_000_000_000n,
      liveAt: 10n,
      blockNumber: 10n,
    }),
    'active',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: ZERO,
      rawOperator: SESSION,
      rawExpiry: 1n,
      liveAt: 0n,
      blockNumber: 1n,
      nowSec: 2,
    }),
    'expired',
  )
  assert.equal(
    directorSessionStatusLabel('delayed', 12n, 11n),
    'Confirm/execute delayed until block 12 (now 11)',
  )
})

test('CLI documents operator / set-operator / clear-operator with 4-arg ABI', async () => {
  const cli = await readFile(join(ROOT, 'src/cli.ts'), 'utf8')
  assert.match(cli, /operator\s+Read live session key/)
  assert.match(cli, /set-operator\s+setDirectorOperator \(tokenId, operator, expiry, scope\)/)
  assert.match(cli, /clear-operator\s+setDirectorOperator\(tokenId, address\(0\), 0, 0\)/)
  assert.match(cli, /case 'operator':/)
  assert.match(cli, /case 'set-operator':/)
  assert.match(cli, /case 'clear-operator':/)
  assert.match(cli, /There is no\nERC-1271 fallback/)
  assert.match(cli, /now \+ 30 days/)
  assert.match(cli, /Confirm\/execute wait until liveAt/)
})

test('README documents 4-arg session keys, defaults, EOA rejection, and no 1271', async () => {
  const readme = await readFile(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /getDirectorOperator/)
  assert.match(readme, /getDirectorOperatorScope/)
  assert.match(readme, /getDirectorOperatorLiveAt/)
  assert.match(readme, /setDirectorOperator\(tokenId, operator, expiry, scope\)/)
  assert.match(readme, /clearDirectorOperator/)
  assert.match(readme, /chamber-operator operator/)
  assert.match(readme, /chamber-operator set-operator/)
  assert.match(readme, /chamber-operator clear-operator/)
  assert.match(readme, /EOA-owned membership NFTs are rejected/)
  assert.match(readme, /no ERC-1271 fallback/)
  assert.match(readme, /30-day/)
  assert.match(readme, /SESSION_SCOPE_UNSCOPED/)
  assert.match(readme, /confirm\/execute wait until `liveAt`/i)
})
