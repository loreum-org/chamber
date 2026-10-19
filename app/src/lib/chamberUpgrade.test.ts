import { describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, stringToHex } from 'viem'
import {
  ChamberUpgradeError,
  LEGACY_UPGRADE_SELECTOR,
  UPGRADE_AND_CALL_SELECTOR,
  buildUpgradeProposal,
  decodeUpgradeProposal,
  prepareUpgradeProposal,
  proxyAdminAbi,
} from './chamberUpgrade'
import { isAllowedChamberSelfCall } from './chamberGovernance'
import { decodeTransactionAction } from './txDecoding'

const chamber = getAddress('0x00000000000000000000000000000000000000c1')
const proxyAdmin = getAddress('0x00000000000000000000000000000000000000a1')
const impl = getAddress('0x00000000000000000000000000000000000000b1')
const legacyAbi = parseAbi(['function upgradeImplementation(address newImplementation, bytes data)'])

const label = (v: string) => stringToHex(v, { size: 32 })

function client(opts: {
  proxyAdmin?: string | Error
  owner?: string | Error
  code?: string
  chamberVersion?: string | Error
  implVersion?: string | Error
}) {
  return {
    readContract: vi.fn(async ({ functionName, address }: { functionName: string; address: string }) => {
      if (functionName === 'VERSION') {
        const ver = address === chamber ? (opts.chamberVersion ?? '1.2.0') : (opts.implVersion ?? '1.3.0')
        if (ver instanceof Error) throw ver
        return label(ver)
      }
      const v = functionName === 'getProxyAdmin' ? opts.proxyAdmin : opts.owner
      if (v instanceof Error) throw v
      return v
    }),
    getCode: vi.fn(async () => (opts.code ?? '0x6080') as `0x${string}`),
  }
}

describe('buildUpgradeProposal', () => {
  it('targets the ProxyAdmin with upgradeAndCall(chamber, impl, data)', () => {
    const p = buildUpgradeProposal(chamber, proxyAdmin, impl)
    expect(p.target).toBe(proxyAdmin)
    expect(p.value).toBe(0n)
    expect(UPGRADE_AND_CALL_SELECTOR).toBe('0x9623609d')
    expect(p.data.slice(0, 10)).toBe(UPGRADE_AND_CALL_SELECTOR)
    const { args } = decodeFunctionData({ abi: proxyAdminAbi, data: p.data })
    expect(args).toEqual([chamber, impl, '0x'])
  })

  it('rejects a zero implementation or ProxyAdmin', () => {
    expect(() => buildUpgradeProposal(chamber, proxyAdmin, '0x0000000000000000000000000000000000000000')).toThrow(ChamberUpgradeError)
    expect(() => buildUpgradeProposal(chamber, '0x0000000000000000000000000000000000000000', impl)).toThrow(ChamberUpgradeError)
  })
})

describe('decodeUpgradeProposal', () => {
  const data = buildUpgradeProposal(chamber, proxyAdmin, impl).data

  it('recognises a ProxyAdmin upgrade of this chamber', () => {
    expect(decodeUpgradeProposal(chamber, proxyAdmin, proxyAdmin, data)).toEqual({ implementation: impl, initData: '0x', via: 'proxyAdmin' })
    // ProxyAdmin still loading: any upgradeAndCall of this chamber counts.
    expect(decodeUpgradeProposal(chamber, undefined, proxyAdmin, data)?.via).toBe('proxyAdmin')
  })

  it('ignores upgrades of other proxies or sent elsewhere', () => {
    const other = buildUpgradeProposal('0x00000000000000000000000000000000000000c2', proxyAdmin, impl).data
    expect(decodeUpgradeProposal(chamber, proxyAdmin, proxyAdmin, other)).toBeNull()
    expect(decodeUpgradeProposal(chamber, proxyAdmin, '0x00000000000000000000000000000000000000d1', data)).toBeNull()
  })

  it('labels an older upgradeImplementation self-call as legacy', () => {
    const legacy = encodeFunctionData({ abi: legacyAbi, functionName: 'upgradeImplementation', args: [impl, '0x'] })
    expect(legacy.slice(0, 10)).toBe(LEGACY_UPGRADE_SELECTOR)
    expect(decodeUpgradeProposal(chamber, proxyAdmin, chamber, legacy)?.via).toBe('legacy')
  })
})

describe('prepareUpgradeProposal (preflight, same on old and new chambers)', () => {
  it('reads the ProxyAdmin on-chain and returns the proposal when the chamber owns it', async () => {
    const c = client({ proxyAdmin, owner: chamber })
    const p = await prepareUpgradeProposal(c, chamber, impl)
    expect(p.target).toBe(proxyAdmin)
    expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: chamber, functionName: 'getProxyAdmin' }))
    expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: proxyAdmin, functionName: 'owner' }))
  })

  it('blocks when the chamber does not own its ProxyAdmin', async () => {
    await expect(prepareUpgradeProposal(client({ proxyAdmin, owner: impl }), chamber, impl)).rejects.toThrow(/does not own its ProxyAdmin/)
  })

  it('blocks when the ProxyAdmin cannot be read or is zero', async () => {
    await expect(prepareUpgradeProposal(client({ proxyAdmin: new Error('x') }), chamber, impl)).rejects.toThrow(ChamberUpgradeError)
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin: '0x0000000000000000000000000000000000000000' }), chamber, impl),
    ).rejects.toThrow(/no ProxyAdmin/)
  })

  it('blocks an in-place upgrade to 1.3.0+ from a chamber older than 1.2.0', async () => {
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: '1.1.5' }), chamber, impl),
    ).rejects.toThrow(/runs Chamber 1\.1\.5.*needs to be redeployed/)
    // 1.2.x chambers can still be upgraded in place.
    const p = await prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: '1.2.0' }), chamber, impl)
    expect(p.target).toBe(proxyAdmin)
    // Old-to-old upgrades that keep the backfill are not blocked.
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: '1.1.5', implVersion: '1.2.0' }), chamber, impl),
    ).resolves.toBeTruthy()
  })

  it('blocks when either VERSION cannot be read', async () => {
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: new Error('x') }), chamber, impl),
    ).rejects.toThrow(/Could not read this chamber’s VERSION/)
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, implVersion: new Error('x') }), chamber, impl),
    ).rejects.toThrow(/no readable VERSION/)
  })

  it('blocks when the new implementation has no code', async () => {
    await expect(prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, code: '0x' }), chamber, impl)).rejects.toThrow(/no contract code/)
  })
})

describe('self-call allowlist and decoding', () => {
  it('no longer allows upgradeImplementation self-calls; pause/unpause still allowed', () => {
    const legacy = encodeFunctionData({ abi: legacyAbi, functionName: 'upgradeImplementation', args: [impl, '0x'] })
    expect(isAllowedChamberSelfCall(chamber, chamber, legacy)).toBe(false)
    expect(isAllowedChamberSelfCall(chamber, chamber, '0x8456cb59')).toBe(true)
    expect(isAllowedChamberSelfCall(chamber, chamber, '0x3f4ba83a')).toBe(true)
    // Calls to other targets (the ProxyAdmin) are not self-calls.
    expect(isAllowedChamberSelfCall(chamber, proxyAdmin, buildUpgradeProposal(chamber, proxyAdmin, impl).data)).toBe(true)
  })

  it('decodes a ProxyAdmin upgrade for the queue', () => {
    const d = decodeTransactionAction({ target: proxyAdmin, value: 0n, calldata: buildUpgradeProposal(chamber, proxyAdmin, impl).data })
    expect(d?.functionName).toBe('upgradeAndCall')
    expect(d?.counterparty).toBe(impl)
    expect(d?.counterpartyRole).toBe('implementation')
  })
})
