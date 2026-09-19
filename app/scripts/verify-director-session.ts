/**
 * Offline checks for M04 session-key ABI + helpers.
 * Run: npx tsx --tsconfig tsconfig.json scripts/verify-director-session.ts
 */
import assert from 'node:assert/strict'
import { encodeFunctionData, toFunctionSelector, zeroAddress } from 'viem'
import { chamberAbi } from '../contracts/abis.ts'
import {
  DEFAULT_SESSION_EXPIRY_DAYS,
  SESSION_SCOPE_CONFIRM,
  SESSION_SCOPE_SUBMIT,
  SESSION_SCOPE_UNSCOPED,
  asUint32,
  describeSessionScope,
  directorSessionStatus,
  directorSessionStatusLabel,
  expiryUnixFromDays,
  isValidSessionExpiry,
  scopeFromSelectedBits,
} from '../src/lib/directorSession.ts'

function abiFn(name: string) {
  const fn = chamberAbi.find((entry) => entry.type === 'function' && entry.name === name)
  assert.ok(fn, `${name} missing from chamberAbi`)
  return fn
}

function testSetDirectorOperatorAbi() {
  const fn = abiFn('setDirectorOperator')
  assert.deepEqual(
    fn.inputs?.map((input) => input.name),
    ['tokenId', 'operator', 'expiry', 'scope'],
  )
  assert.deepEqual(
    fn.inputs?.map((input) => input.type),
    ['uint256', 'address', 'uint256', 'uint32'],
  )

  const expected = toFunctionSelector('setDirectorOperator(uint256,address,uint256,uint32)')
  const stale = toFunctionSelector('setDirectorOperator(uint256,address)')
  const encoded = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [1n, '0x0000000000000000000000000000000000000001', 1_800_000_000n, SESSION_SCOPE_UNSCOPED],
  })
  assert.equal(encoded.slice(0, 10), expected)
  assert.notEqual(expected, stale)

  const clear = encodeFunctionData({
    abi: chamberAbi,
    functionName: 'setDirectorOperator',
    args: [1n, zeroAddress, 0n, 0],
  })
  assert.equal(clear.slice(0, 10), expected)
}

function testSessionReaders() {
  assert.equal(abiFn('getDirectorOperator').outputs?.[0]?.type, 'address')
  assert.equal(abiFn('getDirectorOperatorScope').outputs?.[0]?.type, 'uint32')
  assert.equal(abiFn('getDirectorOperatorLiveAt').outputs?.[0]?.type, 'uint256')
  assert.deepEqual(
    abiFn('getDirectorSession').outputs?.map((output) => output.name),
    ['sessionOwner', 'operator', 'expiry', 'scope', 'liveAt'],
  )
}

function testEventHasExpiryAndScope() {
  const event = chamberAbi.find((entry) => entry.type === 'event' && entry.name === 'DirectorOperatorSet')
  assert.ok(event)
  assert.deepEqual(
    event.inputs?.map((input) => input.name),
    ['tokenId', 'owner', 'operator', 'expiry', 'scope'],
  )
}

function testScopeAndStatusHelpers() {
  assert.equal(scopeFromSelectedBits(new Set(), true), SESSION_SCOPE_UNSCOPED)
  assert.equal(scopeFromSelectedBits(new Set(['submit', 'confirm']), false), SESSION_SCOPE_SUBMIT | SESSION_SCOPE_CONFIRM)
  assert.equal(describeSessionScope(SESSION_SCOPE_UNSCOPED), 'unscoped (all actions)')
  assert.equal(describeSessionScope(0), 'none')
  assert.equal(asUint32(0xffff_ffffn), SESSION_SCOPE_UNSCOPED)

  const now = 1_800_000_000
  assert.equal(isValidSessionExpiry(0n, now), false)
  assert.equal(isValidSessionExpiry(BigInt(now), now), false)
  assert.equal(isValidSessionExpiry(BigInt(now + 1), now), true)
  assert.equal(DEFAULT_SESSION_EXPIRY_DAYS, 30)
  assert.ok(expiryUnixFromDays(30, now * 1000) > BigInt(now))

  assert.equal(
    directorSessionStatus({
      liveOperator: zeroAddress,
      rawOperator: zeroAddress,
      rawExpiry: 0n,
      liveAt: 0n,
      blockNumber: 10n,
    }),
    'none',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: '0x0000000000000000000000000000000000000001',
      rawOperator: '0x0000000000000000000000000000000000000001',
      rawExpiry: 9_999_999_999n,
      liveAt: 12n,
      blockNumber: 11n,
    }),
    'delayed',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: '0x0000000000000000000000000000000000000001',
      rawOperator: '0x0000000000000000000000000000000000000001',
      rawExpiry: 9_999_999_999n,
      liveAt: 12n,
      blockNumber: 12n,
    }),
    'active',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: zeroAddress,
      rawOperator: '0x0000000000000000000000000000000000000001',
      rawExpiry: 10n,
      liveAt: 1n,
      blockNumber: 10n,
      nowSec: 11,
    }),
    'expired',
  )
  assert.equal(
    directorSessionStatus({
      liveOperator: zeroAddress,
      rawOperator: '0x0000000000000000000000000000000000000001',
      rawExpiry: 9_999_999_999n,
      liveAt: 1n,
      blockNumber: 10n,
      nowSec: 11,
    }),
    'stale',
  )
  assert.equal(
    directorSessionStatusLabel('delayed', 12n, 11n),
    'Confirm/execute delayed until block 12 (now 11)',
  )
}

testSetDirectorOperatorAbi()
testSessionReaders()
testEventHasExpiryAndScope()
testScopeAndStatusHelpers()
console.log('verify-director-session: ok')
