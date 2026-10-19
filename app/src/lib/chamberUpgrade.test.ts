import { describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, stringToHex } from 'viem'
import {
  ChamberUpgradeError,
  LEGACY_UPGRADE_SELECTOR,
  PROXY_ADMIN_RENOUNCE_OWNERSHIP_SELECTOR,
  PROXY_ADMIN_TRANSFER_OWNERSHIP_SELECTOR,
  classifyProxyAdminCall,
  proxyAdminRisk,
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

describe('upgrade preflight warnings', () => {
  it('warns, but does not block, on a downgrade', async () => {
    const p = await prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: '1.3.1', implVersion: '1.3.0' }), chamber, impl)
    expect(p.target).toBe(proxyAdmin)
    expect(p.warnings).toHaveLength(1)
    expect(p.warnings?.[0]).toMatch(/downgrade from Chamber 1\.3\.1 to 1\.3\.0/)
  })

  it('no warning on a normal upgrade; 1.1.9 -> 1.3.0 still refused', async () => {
    const p = await prepareUpgradeProposal(client({ proxyAdmin, owner: chamber }), chamber, impl)
    expect(p.warnings).toEqual([])
    await expect(
      prepareUpgradeProposal(client({ proxyAdmin, owner: chamber, chamberVersion: '1.1.9' }), chamber, impl),
    ).rejects.toThrow(/needs to be redeployed/)
  })
})

describe('ProxyAdmin ownership calls are high risk', () => {
  const transfer = encodeFunctionData({ abi: proxyAdminAbi, functionName: 'transferOwnership', args: [impl] })
  const renounce = encodeFunctionData({ abi: proxyAdminAbi, functionName: 'renounceOwnership' })

  it('classifies calls to the ProxyAdmin', () => {
    expect(PROXY_ADMIN_TRANSFER_OWNERSHIP_SELECTOR).toBe('0xf2fde38b')
    expect(PROXY_ADMIN_RENOUNCE_OWNERSHIP_SELECTOR).toBe('0x715018a6')
    expect(classifyProxyAdminCall(proxyAdmin, proxyAdmin, transfer)).toBe('transferOwnership')
    expect(classifyProxyAdminCall(proxyAdmin, proxyAdmin, renounce)).toBe('renounceOwnership')
    expect(classifyProxyAdminCall(proxyAdmin, proxyAdmin, buildUpgradeProposal(chamber, proxyAdmin, impl).data)).toBe('upgrade')
    expect(classifyProxyAdminCall(proxyAdmin, proxyAdmin, '0xdeadbeef')).toBe('other')
    // Same selector on another Ownable contract is not this hazard; unknown ProxyAdmin -> null.
    expect(classifyProxyAdminCall(proxyAdmin, impl, transfer)).toBeNull()
    expect(classifyProxyAdminCall(undefined, proxyAdmin, transfer)).toBeNull()
  })

  it('maps ownership calls to high-risk copy', () => {
    expect(proxyAdminRisk('transferOwnership')).toMatchObject({ level: 'high', label: expect.stringMatching(/upgrade control/) })
    expect(proxyAdminRisk('renounceOwnership')).toMatchObject({ level: 'high', label: expect.stringMatching(/unupgradeable/) })
    expect(proxyAdminRisk('other')?.level).toBe('high')
    expect(proxyAdminRisk('upgrade')).toBeNull()
    expect(proxyAdminRisk(null)).toBeNull()
  })

  it('decoder flags ownership calls when the ProxyAdmin is known', () => {
    const t = decodeTransactionAction({ target: proxyAdmin, value: 0n, calldata: transfer, proxyAdmin })
    expect(t?.functionName).toBe('transferOwnership')
    expect(t?.highRisk).toBe(true)
    expect(t?.counterparty).toBe(impl)
    const r = decodeTransactionAction({ target: proxyAdmin, value: 0n, calldata: renounce, proxyAdmin })
    expect(r?.functionName).toBe('renounceOwnership')
    expect(r?.highRisk).toBe(true)
    expect(decodeTransactionAction({ target: impl, value: 0n, calldata: transfer, proxyAdmin })?.highRisk).toBeFalsy()
  })
})
