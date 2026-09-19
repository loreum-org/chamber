import { getAddress, isAddress, zeroAddress } from 'viem'
import { isNonZeroAddress } from './address'

/**
 * App-level operator scope policy (P0 Feature 1, stories 1.1/1.2).
 *
 * The Chamber contract enforces the on-chain session scope bitmask
 * (`setDirectorOperator`); the richer policy below — contract whitelist,
 * per-tx / daily value limits, time windows, override policy — is enforced
 * in the app before queue submission (spec: "Scope enforcement happens
 * off-chain in the app"). It is persisted per (chain, chamber, seat) in
 * localStorage so the operator console can render the active policy and its
 * remaining limits next to the on-chain session.
 */

export type OperatorTimeWindow = {
  enabled: boolean
  /** 0 = Sunday … 6 = Saturday (JS `Date#getDay`). */
  days: number[]
  /** Inclusive start hour, 0–23 UTC. */
  startHourUtc: number
  /** Exclusive end hour, 0–24 UTC. */
  endHourUtc: number
}

export type OperatorScopePolicy = {
  /** Contracts the operator may call; empty list = unrestricted. */
  whitelist: `0x${string}`[]
  /** Per-transaction value limit (human units, e.g. "500000"). Empty = unlimited. */
  perTxLimit: string
  /** Daily aggregate value limit (human units). Empty = unlimited. */
  dailyLimit: string
  /** Submission window (UTC). Disabled = always. */
  timeWindow: OperatorTimeWindow
  /** Who may revoke this operator: `director` is the only on-chain policy today. */
  overridePolicy: 'director' | 'quorum' | 'none'
  /** Explicit acknowledgement recorded when an over-broad scope was accepted. */
  acknowledgedUnrestricted: boolean
}

export type OperatorPolicyKey = {
  chainId: number
  chamber: `0x${string}`
  tokenId: string
}

export type OperatorPolicyRecord = OperatorPolicyKey & {
  operator: `0x${string}`
  policy: OperatorScopePolicy
  updatedAt: number
}

export type RecentOperator = {
  address: `0x${string}`
  label: string
  lastUsed: number
}

const POLICIES_KEY = 'chamber:operator-policies:v1'
const RECENT_OPERATORS_KEY = 'chamber:recent-operators:v1'
const MAX_RECENT_OPERATORS = 8
const MAX_WHITELIST = 25

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function emptyOperatorPolicy(): OperatorScopePolicy {
  return {
    whitelist: [],
    perTxLimit: '',
    dailyLimit: '',
    timeWindow: { enabled: false, days: [1, 2, 3, 4, 5], startHourUtc: 8, endHourUtc: 18 },
    overridePolicy: 'director',
    acknowledgedUnrestricted: false,
  }
}

/** Checksums valid input; returns undefined for empty/invalid/non-checksum-fixable values. */
export function normalizeOperatorAddress(raw: string): `0x${string}` | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (!isAddress(value)) return undefined
  try {
    return getAddress(value) as `0x${string}`
  } catch {
    return undefined
  }
}

function policyKeyString(key: OperatorPolicyKey): string {
  return `${key.chainId}:${key.chamber.toLowerCase()}:${key.tokenId}`
}

function readJson<T>(storageKey: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(storageKey: string, value: unknown): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Quota / private mode — policies are a convenience, not source of truth.
  }
}

export function loadOperatorPolicy(key: OperatorPolicyKey): OperatorPolicyRecord | undefined {
  const map = readJson<Record<string, OperatorPolicyRecord>>(POLICIES_KEY, {})
  const record = map[policyKeyString(key)]
  if (!record || !isAddress(record.operator ?? '')) return undefined
  // Merge so records saved by older versions gain new fields.
  return { ...record, policy: { ...emptyOperatorPolicy(), ...record.policy } }
}

export function saveOperatorPolicy(
  key: OperatorPolicyKey,
  operator: `0x${string}`,
  policy: OperatorScopePolicy,
): OperatorPolicyRecord {
  const map = readJson<Record<string, OperatorPolicyRecord>>(POLICIES_KEY, {})
  const record: OperatorPolicyRecord = {
    ...key,
    chamber: key.chamber,
    operator,
    policy,
    updatedAt: Date.now(),
  }
  map[policyKeyString(key)] = record
  writeJson(POLICIES_KEY, map)
  return record
}

export function clearOperatorPolicy(key: OperatorPolicyKey): void {
  const map = readJson<Record<string, OperatorPolicyRecord>>(POLICIES_KEY, {})
  delete map[policyKeyString(key)]
  writeJson(POLICIES_KEY, map)
}

export function listRecentOperators(): RecentOperator[] {
  const list = readJson<RecentOperator[]>(RECENT_OPERATORS_KEY, [])
  return list.filter((entry) => isNonZeroAddress(entry?.address ?? zeroAddress))
}

/** Remember an operator wallet for the wizard's "recent" chips (most recent first). */
export function rememberOperator(address: `0x${string}`, label = ''): RecentOperator[] {
  const normalized = (isAddress(address) ? (getAddress(address) as `0x${string}`) : address)
  const next = listRecentOperators().filter(
    (entry) => entry.address.toLowerCase() !== normalized.toLowerCase(),
  )
  next.unshift({ address: normalized, label, lastUsed: Date.now() })
  const trimmed = next.slice(0, MAX_RECENT_OPERATORS)
  writeJson(RECENT_OPERATORS_KEY, trimmed)
  return trimmed
}

export function operatorLabel(address: `0x${string}`): string {
  const hit = listRecentOperators().find(
    (entry) => entry.address.toLowerCase() === address.toLowerCase(),
  )
  return hit?.label ?? ''
}

/** True when a whitelist entry would be a duplicate or the list is at capacity. */
export function canAddWhitelistEntry(
  policy: OperatorScopePolicy,
  address: `0x${string}` | undefined,
): { ok: boolean; reason?: string } {
  if (!address || !isNonZeroAddress(address)) return { ok: false, reason: 'Enter a valid contract address' }
  if (policy.whitelist.some((entry) => entry.toLowerCase() === address.toLowerCase())) {
    return { ok: false, reason: 'Already whitelisted' }
  }
  if (policy.whitelist.length >= MAX_WHITELIST) {
    return { ok: false, reason: `Whitelist is capped at ${MAX_WHITELIST} contracts` }
  }
  return { ok: true }
}

/** Human-readable one-liner for the console + review step. */
export function describeOperatorPolicy(policy: OperatorScopePolicy): string {
  const parts: string[] = []
  parts.push(
    policy.whitelist.length === 0
      ? 'any contract'
      : `${policy.whitelist.length} whitelisted contract${policy.whitelist.length === 1 ? '' : 's'}`,
  )
  parts.push(policy.perTxLimit ? `$${policy.perTxLimit}/tx` : 'no per-tx limit')
  parts.push(policy.dailyLimit ? `$${policy.dailyLimit}/day` : 'no daily limit')
  if (policy.timeWindow.enabled) {
    const days = policy.timeWindow.days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS[d])
      .join('·')
    parts.push(`${days} ${policy.timeWindow.startHourUtc}–${policy.timeWindow.endHourUtc}:00 UTC`)
  } else {
    parts.push('any time')
  }
  return parts.join(' · ')
}

/**
 * Over-broad scope guardrail (spec edge case): a scope that grants
 * unrestricted authority — unscoped bitmask with no app-level limits.
 */
export function isPolicyOverBroad(policy: OperatorScopePolicy, unscoped: boolean): boolean {
  if (!unscoped) return false
  return (
    policy.whitelist.length === 0 &&
    !policy.perTxLimit &&
    !policy.dailyLimit &&
    !policy.timeWindow.enabled
  )
}

/** True when `nowUtc` (hours 0-23, day 0-6) is inside the policy window. */
export function isWithinTimeWindow(policy: OperatorScopePolicy, now = new Date()): boolean {
  if (!policy.timeWindow.enabled) return true
  if (!policy.timeWindow.days.includes(now.getUTCDay())) return false
  const hour = now.getUTCHours()
  return hour >= policy.timeWindow.startHourUtc && hour < policy.timeWindow.endHourUtc
}
