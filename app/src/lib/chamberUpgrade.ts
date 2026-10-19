import { decodeFunctionData, encodeFunctionData, parseAbi, toFunctionSelector, type Hex } from 'viem'
import { compareVersions, parseChamberVersion, type SemVer } from './chamberSubmit'
import { chamberVersionBytes32ToLabel } from './utils'

/**
 * Chamber upgrades go through the chamber-owned ProxyAdmin on every version.
 *
 * Since 1.3.0 Chamber has no `upgradeImplementation`; the only path is a quorum transaction with
 * `target = getProxyAdmin()` and `data = upgradeAndCall(chamber, newImplementation, initData)`.
 * Older chambers still have `upgradeImplementation`, but it only forwarded to the same
 * `ProxyAdmin.upgradeAndCall`, which has the same selector on OpenZeppelin v4 and v5. Queuing the
 * ProxyAdmin call for every version means one code path and no guessing which build a `1.3.0`
 * VERSION label came from. The checks `upgradeImplementation` used to make (chamber owns its
 * ProxyAdmin, non-zero implementation) run here as a preflight before anything is sent.
 * ProxyAdmin has no version or migration checks of its own; the board is responsible.
 * The preflight also refuses an in-place upgrade to 1.3.0+ from a chamber older than 1.2.0: 1.3.0
 * removed the pre-1.2.0 delegation backfill, so such a chamber must be redeployed instead.
 */

export const proxyAdminAbi = parseAbi([
  'function owner() view returns (address)',
  'function upgradeAndCall(address proxy, address implementation, bytes data) payable',
  'function transferOwnership(address newOwner)',
  'function renounceOwnership()',
])

export const PROXY_ADMIN_TRANSFER_OWNERSHIP_SELECTOR = toFunctionSelector('transferOwnership(address)')
export const PROXY_ADMIN_RENOUNCE_OWNERSHIP_SELECTOR = toFunctionSelector('renounceOwnership()')

export const UPGRADE_AND_CALL_SELECTOR = toFunctionSelector('upgradeAndCall(address,address,bytes)')
/** Removed in Chamber 1.3.0. Only for recognising older queued proposals. */
export const LEGACY_UPGRADE_SELECTOR = '0xc89311b6' as const

const legacyUpgradeAbi = parseAbi(['function upgradeImplementation(address newImplementation, bytes data)'])

export class ChamberUpgradeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChamberUpgradeError'
  }
}

const ZERO = '0x0000000000000000000000000000000000000000'
const eq = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export interface UpgradeProposal {
  target: `0x${string}`
  value: bigint
  data: Hex
  /** Non-blocking notes for the proposer (for example a downgrade). */
  warnings?: string[]
}

/** The calldata and target for an upgrade proposal through the chamber's submit path. */
export function buildUpgradeProposal(
  chamber: `0x${string}`,
  proxyAdmin: `0x${string}`,
  newImplementation: `0x${string}`,
  initData: Hex = '0x',
): UpgradeProposal {
  if (eq(proxyAdmin, ZERO)) throw new ChamberUpgradeError('This chamber has no ProxyAdmin, so it cannot be upgraded.')
  if (eq(newImplementation, ZERO)) throw new ChamberUpgradeError('The new implementation address is zero.')
  return {
    target: proxyAdmin,
    value: 0n,
    data: encodeFunctionData({ abi: proxyAdminAbi, functionName: 'upgradeAndCall', args: [chamber, newImplementation, initData] }),
  }
}

export type DecodedUpgrade = { implementation: `0x${string}`; initData: Hex; via: 'proxyAdmin' | 'legacy' }

/**
 * Recognises an upgrade proposal: `upgradeAndCall(chamber, impl, data)` sent to the chamber's
 * ProxyAdmin, or an older queued `upgradeImplementation` self-call. `proxyAdmin` may be unknown
 * (still loading); then any `upgradeAndCall` aimed at this chamber counts.
 */
export function decodeUpgradeProposal(
  chamber: `0x${string}`,
  proxyAdmin: `0x${string}` | undefined,
  target: string,
  data: Hex,
): DecodedUpgrade | null {
  const selector = data.slice(0, 10).toLowerCase()
  try {
    if (selector === UPGRADE_AND_CALL_SELECTOR) {
      if (proxyAdmin && !eq(target, proxyAdmin)) return null
      const { args } = decodeFunctionData({ abi: proxyAdminAbi, data })
      const [proxy, implementation, initData] = args as readonly [`0x${string}`, `0x${string}`, Hex]
      if (!eq(proxy, chamber)) return null
      return { implementation, initData, via: 'proxyAdmin' }
    }
    if (selector === LEGACY_UPGRADE_SELECTOR && eq(target, chamber)) {
      const { args } = decodeFunctionData({ abi: legacyUpgradeAbi, data })
      const [implementation, initData] = args as readonly [`0x${string}`, Hex]
      return { implementation, initData, via: 'legacy' }
    }
  } catch {
    return null
  }
  return null
}

export interface UpgradePreflightClient {
  readContract(args: {
    address: `0x${string}`
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
  getCode(args: { address: `0x${string}` }): Promise<Hex | undefined>
}

const getProxyAdminAbi = parseAbi(['function getProxyAdmin() view returns (address)'])
const versionAbi = parseAbi(['function VERSION() view returns (bytes32)'])

/** Oldest chamber that can be upgraded in place to a build without the pre-1.2.0 backfill. */
export const MIN_IN_PLACE_UPGRADE_VERSION: SemVer = [1, 2, 0]
/** First build without the pre-1.2.0 delegation backfill. */
export const BACKFILL_REMOVED_VERSION: SemVer = [1, 3, 0]

async function readVersion(client: UpgradePreflightClient, address: `0x${string}`): Promise<string | undefined> {
  try {
    const raw = await client.readContract({ address, abi: versionAbi, functionName: 'VERSION' })
    return chamberVersionBytes32ToLabel(raw as Hex)
  } catch {
    return undefined
  }
}

/**
 * Reads the chamber's ProxyAdmin on-chain and checks it can perform the upgrade: the chamber owns
 * it, the new implementation is a contract with a VERSION, and the version jump is allowed in place.
 * Returns the proposal to queue.
 */
export async function prepareUpgradeProposal(
  client: UpgradePreflightClient,
  chamber: `0x${string}`,
  newImplementation: `0x${string}`,
  initData: Hex = '0x',
): Promise<UpgradeProposal> {
  let proxyAdmin: `0x${string}`
  try {
    proxyAdmin = (await client.readContract({ address: chamber, abi: getProxyAdminAbi, functionName: 'getProxyAdmin' })) as `0x${string}`
  } catch {
    throw new ChamberUpgradeError('Could not read this chamber’s ProxyAdmin. Nothing was sent.')
  }
  if (!proxyAdmin || eq(proxyAdmin, ZERO)) {
    throw new ChamberUpgradeError('This chamber has no ProxyAdmin, so it cannot be upgraded.')
  }
  let owner: string | undefined
  try {
    owner = (await client.readContract({ address: proxyAdmin, abi: proxyAdminAbi, functionName: 'owner' })) as string
  } catch {
    throw new ChamberUpgradeError('Could not read the ProxyAdmin owner. Nothing was sent.')
  }
  if (!eq(owner, chamber)) {
    throw new ChamberUpgradeError(
      `This chamber does not own its ProxyAdmin (owner is ${owner}), so a board upgrade would fail. Nothing was sent.`,
    )
  }
  const code = await client.getCode({ address: newImplementation }).catch(() => undefined)
  if (!code || code === '0x') {
    throw new ChamberUpgradeError('The new implementation address has no contract code. Nothing was sent.')
  }
  const newLabel = await readVersion(client, newImplementation)
  const newVersion = parseChamberVersion(newLabel)
  if (!newVersion) {
    throw new ChamberUpgradeError('The new implementation has no readable VERSION, so it may not be a Chamber build. Nothing was sent.')
  }
  const currentLabel = await readVersion(client, chamber)
  const currentVersion = parseChamberVersion(currentLabel)
  if (!currentVersion) {
    throw new ChamberUpgradeError('Could not read this chamber’s VERSION, so the upgrade cannot be checked. Nothing was sent.')
  }
  if (
    compareVersions(newVersion, BACKFILL_REMOVED_VERSION) >= 0 &&
    compareVersions(currentVersion, MIN_IN_PLACE_UPGRADE_VERSION) < 0
  ) {
    throw new ChamberUpgradeError(
      `This chamber runs Chamber ${currentLabel}, which cannot be upgraded in place to ${newLabel}. ` +
        'The chamber needs to be redeployed on a current version.',
    )
  }
  const warnings: string[] = []
  if (compareVersions(newVersion, currentVersion) < 0) {
    warnings.push(`This is a downgrade from Chamber ${currentLabel} to ${newLabel}. Make sure the board intends to roll back.`)
  }
  return { ...buildUpgradeProposal(chamber, proxyAdmin, newImplementation, initData), warnings }
}

export type ProxyAdminCallKind = 'upgrade' | 'transferOwnership' | 'renounceOwnership' | 'other'

/**
 * Classifies a proposal aimed at this chamber's ProxyAdmin. Returns null when the target is not
 * the ProxyAdmin (or the ProxyAdmin is still unknown). `transferOwnership` hands upgrade control
 * of the chamber to someone else; `renounceOwnership` makes the chamber permanently unupgradeable.
 */
export function classifyProxyAdminCall(
  proxyAdmin: `0x${string}` | undefined,
  target: string,
  data: Hex,
): ProxyAdminCallKind | null {
  if (!proxyAdmin || !eq(target, proxyAdmin)) return null
  const selector = data.slice(0, 10).toLowerCase()
  if (selector === UPGRADE_AND_CALL_SELECTOR) return 'upgrade'
  if (selector === PROXY_ADMIN_TRANSFER_OWNERSHIP_SELECTOR) return 'transferOwnership'
  if (selector === PROXY_ADMIN_RENOUNCE_OWNERSHIP_SELECTOR) return 'renounceOwnership'
  return 'other'
}

export interface ProxyAdminRisk {
  level: 'high'
  label: string
  summary: string
}

/**
 * Risk copy for a proposal to the chamber's ProxyAdmin. Ownership calls are the dangerous ones:
 * the board stays the chamber's only upgrader only while the chamber owns its ProxyAdmin.
 * Upgrades are classified separately (`decodeUpgradeProposal`); this returns null for them.
 */
export function proxyAdminRisk(kind: ProxyAdminCallKind | null): ProxyAdminRisk | null {
  switch (kind) {
    case 'transferOwnership':
      return {
        level: 'high',
        label: 'High risk: hands over upgrade control',
        summary:
          'Transfers ownership of this chamber’s ProxyAdmin. The new owner could upgrade the chamber to any code on its own, and the board could no longer upgrade it.',
      }
    case 'renounceOwnership':
      return {
        level: 'high',
        label: 'High risk: makes the chamber unupgradeable',
        summary:
          'Renounces ownership of this chamber’s ProxyAdmin. Nobody, including the board, could ever upgrade the chamber again. This cannot be undone.',
      }
    case 'other':
      return {
        level: 'high',
        label: 'High risk: ProxyAdmin call',
        summary: 'Calls this chamber’s ProxyAdmin, which controls upgrades. Verify the exact function before approving.',
      }
    default:
      return null
  }
}
