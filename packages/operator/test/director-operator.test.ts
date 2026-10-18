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
  isLiveSession,
  isSelfSession,
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
  // Live session = getDirectorSession + isTokenAuthorized; the per-field live getters were removed.
  assert.equal(abiItem('function', 'getDirectorOperator'), undefined)
  assert.ok(abiItem('function', 'isTokenAuthorized'))
  assert.ok(abiItem('function', 'getDirectorSession'))
  const event = abiItem('event', 'DirectorOperatorSet')
  assert.ok(event && 'inputs' in event)
  assert.deepEqual(
    event.inputs.map((input) => input.name),
    ['tokenId', 'owner', 'operator', 'expiry', 'scope'],
  )
  assert.ok(abiItem('error', 'InvalidSessionExpiry'))
  assert.ok(abiItem('error', 'InvalidSessionScope'))
  assert.equal(directorOperatorAbi.length, 5)
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

/**
 * Fake chamber for the live-session read path. `isTokenAuthorized` mirrors the contract:
 * owner, or the stored operator while `sessionOwner == owner` and unexpired.
 */
function fakeOperator(state: {
  owner: string
  sessionOwner: string
  operator: string
  scope: number
  liveAt: bigint
  expiry?: bigint
  now?: bigint
  ownerCode?: `0x${string}`
}) {
  const expiry = state.expiry ?? 1_900_000_000n
  const now = state.now ?? 1_800_000_000n
  const ownerCode = state.ownerCode ?? '0x6080'
  const calls: string[] = []
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const publicClient = {
    async readContract({ functionName, args }: { functionName: string; args: readonly unknown[] }) {
      calls.push(functionName)
      if (functionName === 'getDirectorSession') {
        return [state.sessionOwner, state.operator, expiry, state.scope, state.liveAt]
      }
      if (functionName === 'isTokenAuthorized') {
        // Chamber._isTokenAuthorized: owner branch first, then _isLiveSessionKey.
        const account = args[1] as string
        if (eq(account, ZERO)) return false
        if (eq(account, state.owner)) return true
        return (
          ownerCode !== '0x' &&
          eq(state.sessionOwner, state.owner) &&
          eq(account, state.operator) &&
          expiry !== 0n &&
          now <= expiry
        )
      }
      throw new Error(`unexpected read ${functionName}`)
    },
    async getBlockNumber() {
      return 100n
    },
    async getBlock() {
      calls.push('getBlock')
      return { timestamp: now }
    },
    async getBytecode({ address }: { address: string }) {
      calls.push('getBytecode')
      return eq(address, state.owner) ? ownerCode : '0x'
    },
  }
  const Ctor = ChamberOperator as unknown as new (opts: Record<string, unknown>) => ChamberOperator
  return Object.assign(
    new Ctor({ rpcUrl: 'http://fake', chamber: '0x00000000000000000000000000000000000000C1', publicClient }),
    { calls },
  )
}

test('isLiveSession needs both the operator and the stored session owner authorized', () => {
  assert.equal(isLiveSession({ rawOperator: SESSION, operatorAuthorized: true, sessionOwnerAuthorized: true }), true)
  assert.equal(isLiveSession({ rawOperator: SESSION, operatorAuthorized: true, sessionOwnerAuthorized: false }), false)
  assert.equal(isLiveSession({ rawOperator: SESSION, operatorAuthorized: false, sessionOwnerAuthorized: true }), false)
  assert.equal(isLiveSession({ rawOperator: ZERO, operatorAuthorized: true, sessionOwnerAuthorized: true }), false)
})

test('live session reads report the key while the setting owner still holds the NFT', async () => {
  const OWNER_A = '0x00000000000000000000000000000000000000A1'
  const op = fakeOperator({ owner: OWNER_A, sessionOwner: OWNER_A, operator: SESSION, scope: SESSION_SCOPE_CONFIRM, liveAt: 50n })
  assert.equal((await op.getDirectorOperator(3n)).toLowerCase(), SESSION.toLowerCase())
  assert.equal(await op.getDirectorOperatorScope(3n), SESSION_SCOPE_CONFIRM)
  assert.equal(await op.getDirectorOperatorLiveAt(3n), 50n)
})

test('session is not live after the NFT moves to the operator itself', async () => {
  // Contract A set key X, then transferred the NFT to X. X now acts as owner, not as A's key.
  const OWNER_A = '0x00000000000000000000000000000000000000A1'
  const op = fakeOperator({ owner: SESSION, sessionOwner: OWNER_A, operator: SESSION, scope: SESSION_SCOPE_CONFIRM, liveAt: 50n })
  assert.equal(await op.getDirectorOperator(3n), ZERO)
  assert.equal(await op.getDirectorOperatorScope(3n), 0)
  assert.equal(await op.getDirectorOperatorLiveAt(3n), 0n)
  const state = await op.getDirectorOperatorState(3n)
  assert.equal(state.operator, ZERO)
  assert.equal(state.status, 'stale')
})

// ---------------------------------------------------------------------------
// QA #392: self-registered key (operator == sessionOwner == owner). Both
// isTokenAuthorized reads pass via the owner branch, so liveness must mirror
// Chamber._isLiveSessionKey: owner has code and expiry != 0 && now <= expiry.
// ---------------------------------------------------------------------------

const SELF = '0x00000000000000000000000000000000000000A1'

test('isLiveSession mirrors _isLiveSessionKey for a self-registered key', () => {
  const base = { rawOperator: SELF, operatorAuthorized: true, sessionOwnerAuthorized: true, sessionOwner: SELF } as const
  assert.equal(isSelfSession(SELF, SELF.toUpperCase().replace('0X', '0x')), true)
  assert.equal(isSelfSession(SESSION, SELF), false)
  assert.equal(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 200n, ownerHasCode: true }), true)
  assert.equal(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 201n, ownerHasCode: true }), false, 'expired')
  assert.equal(isLiveSession({ ...base, rawExpiry: 0n, nowSec: 1n, ownerHasCode: true }), false, 'expiry 0')
  assert.equal(isLiveSession({ ...base, rawExpiry: 200n, nowSec: 100n, ownerHasCode: false }), false, 'owner lost code')
  assert.equal(isLiveSession({ ...base }), false, 'missing inputs fail closed')
  // A normal key (operator != sessionOwner) does not need the extra inputs.
  assert.equal(
    isLiveSession({ rawOperator: SESSION, operatorAuthorized: true, sessionOwnerAuthorized: true, sessionOwner: SELF }),
    true,
  )
})

test('self-registered key is live while unexpired and the owner has code', async () => {
  const op = fakeOperator({ owner: SELF, sessionOwner: SELF, operator: SELF, scope: SESSION_SCOPE_CONFIRM, liveAt: 50n })
  assert.equal((await op.getDirectorOperator(3n)).toLowerCase(), SELF.toLowerCase())
  assert.equal(await op.getDirectorOperatorScope(3n), SESSION_SCOPE_CONFIRM)
})

test('expired self-registered key is not live even though both isTokenAuthorized reads pass', async () => {
  const op = fakeOperator({
    owner: SELF,
    sessionOwner: SELF,
    operator: SELF,
    scope: SESSION_SCOPE_CONFIRM,
    liveAt: 50n,
    expiry: 1_000n,
    now: 2_000n,
  })
  assert.equal(await op.getDirectorOperator(3n), ZERO)
  assert.equal(await op.getDirectorOperatorScope(3n), 0)
  assert.equal(await op.getDirectorOperatorLiveAt(3n), 0n)
  const state = await op.getDirectorOperatorState(3n)
  assert.equal(state.operator, ZERO)
  assert.equal(state.status, 'expired')
})

test('self-registered key is not live once the owner has no code (revoked EIP-7702)', async () => {
  const op = fakeOperator({
    owner: SELF,
    sessionOwner: SELF,
    operator: SELF,
    scope: SESSION_SCOPE_CONFIRM,
    liveAt: 50n,
    ownerCode: '0x',
  })
  assert.equal(await op.getDirectorOperator(3n), ZERO)
})

test('normal session key skips the extra block / bytecode reads', async () => {
  const op = fakeOperator({ owner: SELF, sessionOwner: SELF, operator: SESSION, scope: SESSION_SCOPE_CONFIRM, liveAt: 50n })
  assert.equal((await op.getDirectorOperator(3n)).toLowerCase(), SESSION.toLowerCase())
  assert.ok(!op.calls.includes('getBlock'))
  assert.ok(!op.calls.includes('getBytecode'))
})
