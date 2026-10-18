import { describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi } from 'viem'
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

function client(opts: { proxyAdmin?: string | Error; owner?: string | Error; code?: string }) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
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
