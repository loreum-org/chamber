import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { formatUnits, zeroAddress } from 'viem'
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiKey,
  FiLoader,
  FiPlus,
  FiX,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useIsContractAccount,
  useOperatorSeats,
  useOperatorSeatsForWallet,
  useReceiptRefresh,
  useSetDirectorOperator,
  useSetDirectorOperatorGasEstimate,
  useShareDecimals,
} from '@/hooks'
import {
  DEFAULT_SESSION_EXPIRY_DAYS,
  SESSION_EXPIRY_PRESETS,
  SESSION_SCOPE_BITS,
  SESSION_SCOPE_UNSCOPED,
  describeSessionScope,
  expiryUnixFromDays,
  isValidSessionExpiry,
  scopeFromSelectedBits,
  type SessionScopeBitId,
} from '@/lib/directorSession'
import {
  WEEKDAY_LABELS,
  canAddWhitelistEntry,
  describeOperatorPolicy,
  isPolicyOverBroad,
  loadOperatorPolicy,
  normalizeOperatorAddress,
  operatorLabel,
  rememberOperator,
  saveOperatorPolicy,
} from '@/lib/operatorPolicy'
import { formatTimestamp, formatWalletSendError, shortenAddress } from '@/lib/utils'
import type { OperatorScopePolicy } from '@/lib/operatorPolicy'

const STEPS = [
  { n: 1, label: 'Operator wallet' },
  { n: 2, label: 'Seat scope' },
  { n: 3, label: 'Override policy' },
  { n: 4, label: 'Review & sign' },
] as const

type OverridePolicyId = OperatorScopePolicy['overridePolicy']

const OVERRIDE_OPTIONS: {
  id: OverridePolicyId
  label: string
  detail: string
  recommended?: boolean
  onChain: boolean
}[] = [
  {
    id: 'director',
    label: 'Director holder only',
    detail: 'The seat’s NFT holder can revoke instantly — one click, no quorum.',
    recommended: true,
    onChain: true,
  },
  {
    id: 'quorum',
    label: 'Quorum of directors',
    detail: 'Planned. Recorded in the app-level policy; on-chain revocation stays with the seat holder today.',
    onChain: false,
  },
  {
    id: 'none',
    label: 'No one',
    detail: 'Not enforceable on-chain today — revocation always remains available to the seat holder.',
    onChain: false,
  },
]

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-[0.16em] leading-none mb-1">
      {children}
    </p>
  )
}

function StepHeader({ current }: { current: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-700/50 rounded-lg overflow-hidden text-[11px] font-mono uppercase tracking-wider">
      {STEPS.map(({ n, label }) => (
        <div
          key={n}
          className={`px-3 py-2.5 truncate ${
            n < current
              ? 'text-emerald-400 bg-slate-900/60'
              : n === current
                ? 'text-accent-300 bg-accent-950/40'
                : 'text-slate-500'
          } ${n > 1 ? 'border-l border-slate-700/50' : ''}`}
        >
          {n < 10 ? `0${n}` : n} · {label}
          {n < current ? ' ✓' : ''}
        </div>
      ))}
    </div>
  )
}

function WizardField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-slate-500 text-xs mt-1.5">{hint}</p>}
    </div>
  )
}

export default function OperatorWizard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { address: userAddress } = useAccount()
  const chainId = useChainId()

  const chamberRaw = searchParams.get('chamber') ?? ''
  const chamber = normalizeOperatorAddress(chamberRaw) ?? undefined
  const seatParam = searchParams.get('seat') ?? ''
  const seatTokenId = /^\d+$/.test(seatParam) ? BigInt(seatParam) : undefined

  const { seats, refetch: refetchSeats } = useOperatorSeats(chamber)
  const seat = useMemo(
    () => seats.find((s) => s.tokenId === seatTokenId),
    [seats, seatTokenId],
  )
  const isOwnerConnected =
    !!userAddress &&
    !!seat?.owner &&
    seat.owner.toLowerCase() === userAddress.toLowerCase()
  const ownerContract = useIsContractAccount(seat?.owner)
  const shareDecimals = useShareDecimals(chamber)

  // Step 1
  const [operatorInput, setOperatorInput] = useState('')
  // Step 2 — on-chain scope + expiry
  const [unscoped, setUnscoped] = useState(false)
  const [selectedBits, setSelectedBits] = useState<Set<SessionScopeBitId>>(
    new Set(['submit']),
  )
  const [expiryDays, setExpiryDays] = useState(DEFAULT_SESSION_EXPIRY_DAYS)
  const [customExpiry, setCustomExpiry] = useState('')
  // Step 2 — app-enforced policy
  const [whitelistInput, setWhitelistInput] = useState('')
  const [whitelist, setWhitelist] = useState<`0x${string}`[]>([])
  const [perTxLimit, setPerTxLimit] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [windowEnabled, setWindowEnabled] = useState(false)
  const [windowDays, setWindowDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(18)
  // Step 3
  const [overridePolicy, setOverridePolicy] = useState<OverridePolicyId>('director')
  const [acknowledgedUnrestricted, setAcknowledgedUnrestricted] = useState(false)
  const [step, setStep] = useState(1)

  const parsedOperator = useMemo(
    (): `0x${string}` | undefined => normalizeOperatorAddress(operatorInput),
    [operatorInput],
  )
  const operatorLooksValid = !!parsedOperator && parsedOperator !== zeroAddress

  const policy: OperatorScopePolicy = useMemo(
    () => ({
      whitelist,
      perTxLimit: perTxLimit.trim(),
      dailyLimit: dailyLimit.trim(),
      timeWindow: {
        enabled: windowEnabled,
        days: windowDays,
        startHourUtc: startHour,
        endHourUtc: endHour,
      },
      overridePolicy,
      acknowledgedUnrestricted,
    }),
    [
      whitelist,
      perTxLimit,
      dailyLimit,
      windowEnabled,
      windowDays,
      startHour,
      endHour,
      overridePolicy,
      acknowledgedUnrestricted,
    ],
  )

  const expiry = customExpiry
    ? (() => {
        const ms = new Date(customExpiry).getTime()
        return Number.isNaN(ms) ? 0n : BigInt(Math.floor(ms / 1000))
      })()
    : expiryUnixFromDays(expiryDays)
  const expiryOk = isValidSessionExpiry(expiry)
  const scope = scopeFromSelectedBits(selectedBits, unscoped)
  const scopeOk = scope !== 0
  const overBroad = isPolicyOverBroad(policy, unscoped)
  const overBroadAcked = !overBroad || acknowledgedUnrestricted

  // Other seats in this chamber already operated by the chosen wallet (warn but allow).
  const existingOperatorSeats = useOperatorSeatsForWallet(seats, parsedOperator).filter(
    (s) => s.tokenId !== seatTokenId,
  )

  const { setDirectorOperator, isPending, isConfirming, hash } = useSetDirectorOperator(chamber)

  useReceiptRefresh({
    chamberAddress: chamber,
    hash,
    successMessage: 'Operator assigned successfully',
    errorMessage: 'Operator assignment failed',
    onSuccess: () => {
      if (chamber && seatTokenId !== undefined && parsedOperator) {
        saveOperatorPolicy(
          { chainId, chamber, tokenId: seatTokenId.toString() },
          parsedOperator,
          policy,
        )
        rememberOperator(parsedOperator, operatorLabel(parsedOperator))
        void refetchSeats()
      }
      setStep(5)
    },
  })

  const { gas, isEstimating, estimateUnavailable } = useSetDirectorOperatorGasEstimate({
    chamberAddress: chamber,
    tokenId: seatTokenId,
    operator: parsedOperator,
    expiry: expiryOk ? expiry : undefined,
    scope,
  })

  // Prefill from any saved app-level policy for this seat.
  useEffect(() => {
    if (!chamber || seatTokenId === undefined) return
    const saved = loadOperatorPolicy({
      chainId,
      chamber,
      tokenId: seatTokenId.toString(),
    })
    if (!saved) return
    if (saved.operator) setOperatorInput(saved.operator)
    const p = saved.policy
    setWhitelist(p.whitelist)
    setPerTxLimit(p.perTxLimit)
    setDailyLimit(p.dailyLimit)
    setWindowEnabled(p.timeWindow.enabled)
    setWindowDays(p.timeWindow.days)
    setStartHour(p.timeWindow.startHourUtc)
    setEndHour(p.timeWindow.endHourUtc)
    setOverridePolicy(p.overridePolicy)
    setAcknowledgedUnrestricted(p.acknowledgedUnrestricted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamber, seatParam])

  // Reset the acknowledgement when the scope stops being over-broad.
  useEffect(() => {
    if (!overBroad) setAcknowledgedUnrestricted(false)
  }, [overBroad])

  const busy = isPending || isConfirming
  const canProceedToReview =
    !!seat && isOwnerConnected && ownerContract.isContract && operatorLooksValid && expiryOk && scopeOk && overBroadAcked

  const setSeatParam = (tokenId: bigint | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (tokenId === undefined) next.delete('seat')
    else next.set('seat', tokenId.toString())
    setSearchParams(next, { replace: true })
  }

  const addWhitelistEntry = () => {
    const check = canAddWhitelistEntry(policy, normalizeOperatorAddress(whitelistInput))
    if (!check.ok) {
      if (check.reason) toast.error(check.reason)
      return
    }
    const entry = normalizeOperatorAddress(whitelistInput)
    if (!entry) return
    setWhitelist((current) => [...current, entry])
    setWhitelistInput('')
  }

  const toggleBit = (id: SessionScopeBitId) => {
    setSelectedBits((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleWindowDay = (day: number) => {
    setWindowDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    )
  }

  const handleSign = async () => {
    if (!seatTokenId || !parsedOperator || !expiryOk || !scopeOk || !overBroadAcked) return
    try {
      await setDirectorOperator(seatTokenId, parsedOperator, expiry, scope)
    } catch (err) {
      toast.error(formatWalletSendError(err, 'Failed to set operator'))
    }
  }

  if (!chamber) {
    return (
      <div className="panel p-12 text-center space-y-4">
        <h1 className="font-heading text-xl font-semibold text-slate-100">Operator wizard</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Choose a chamber in the operator console first, then start an assignment from one of its seats.
        </p>
        <Link to="/operators" className="btn btn-primary inline-flex">
          <FiArrowLeft className="w-4 h-4" />
          Open operator console
        </Link>
      </div>
    )
  }

  if (!userAddress) {
    return (
      <div className="panel p-12 text-center">
        <h1 className="font-heading text-xl font-semibold text-slate-100 mb-2">Connect a wallet</h1>
        <p className="text-slate-500 text-sm">
          Connecting the director wallet is required to assign an operator.
        </p>
      </div>
    )
  }

  // Seat picker when arriving without ?seat=
  if (seatTokenId === undefined) {
    const ownedSeats = seats.filter(
      (s) => s.owner && s.owner.toLowerCase() === userAddress.toLowerCase(),
    )
    return (
      <div className="space-y-6">
        <PageIntro chamber={chamber} />
        <div className="panel p-6">
          <h2 className="font-heading text-lg font-semibold text-slate-100 mb-1">
            Choose a director seat
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Seats owned by the connected wallet in this chamber.
          </p>
          {!ownerContract.isFetched || seats.length === 0 ? (
            <div className="h-16 bg-slate-800/60 rounded-lg animate-pulse" />
          ) : ownedSeats.length === 0 ? (
            <p className="text-slate-500 text-sm">
              This wallet does not own a membership token in this chamber. Connect the director wallet
              that holds the seat you want to staff.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ownedSeats.map((s) => (
                <button
                  key={s.tokenId.toString()}
                  type="button"
                  onClick={() => setSeatParam(s.tokenId)}
                  className="text-left stat-card hover:border-accent-500/40 transition-colors"
                >
                  <Overline>Director seat #{s.rank}</Overline>
                  <p className="font-mono text-sm text-slate-200">
                    Member #{s.tokenId.toString()} · {shortenAddress(s.owner ?? zeroAddress, 6)}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {s.isLive
                      ? `Operator set: ${shortenAddress(s.operator ?? zeroAddress, 6)}`
                      : 'No operator yet'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!seat) {
    return (
      <div className="panel p-12 text-center">
        <p className="text-slate-400 text-sm">Loading seat #{seatParam}…</p>
      </div>
    )
  }

  if (!isOwnerConnected) {
    return (
      <div className="panel p-12 text-center space-y-3">
        <h1 className="font-heading text-xl font-semibold text-slate-100">Not your seat</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Seat #{seat.rank} is owned by{' '}
          <span className="font-mono">{shortenAddress(seat.owner ?? zeroAddress, 6)}</span>. Only the
          membership token holder can assign its operator.
        </p>
        <button type="button" onClick={() => setSeatParam(undefined)} className="btn btn-secondary inline-flex">
          <FiArrowLeft className="w-4 h-4" />
          Pick another seat
        </button>
      </div>
    )
  }

  if (ownerContract.isFetched && !ownerContract.isContract) {
    return (
      <div className="panel p-12 text-center space-y-3">
        <h1 className="font-heading text-xl font-semibold text-slate-100">
          EOA-owned seat
        </h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          The protocol rejects <span className="font-mono">setDirectorOperator</span> for
          EOA-owned membership tokens (no ERC-1271). Move the seat into a contract wallet (e.g. Safe)
          to staff an operator.
        </p>
        <Link to="/operators" className="btn btn-secondary inline-flex">
          Back to operator console
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro chamber={chamber} />

      {step <= 4 ? (
        <div className="space-y-5">
          <StepHeader current={step} />

          {step === 1 && (
            <div className="panel p-6">
              <h2 className="font-heading text-lg font-semibold text-slate-100 mb-1">
                Select operator wallet
              </h2>
              <p className="text-slate-500 text-sm mb-5">
                The wallet that will submit transactions under{' '}
                <span className="font-mono text-slate-300">Director Seat #{seat.rank}</span>.
                Attribution on-chain stays with the seat, not the operator.
              </p>

              <WizardField label="Operator address" hint="Paste a wallet address, or pick a recent operator below.">
                <input
                  id="operator-address"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="0x…"
                  className="input font-mono text-sm"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  disabled={busy}
                />
              </WizardField>

              {userAddress.toLowerCase() !== (parsedOperator ?? '').toLowerCase() && (
                <button
                  type="button"
                  onClick={() => setOperatorInput(userAddress ?? '')}
                  className="badge badge-primary font-mono mb-3 cursor-pointer hover:bg-accent-900/60"
                >
                  Use my connected wallet ({shortenAddress(userAddress ?? zeroAddress, 6)})
                </button>
              )}
              {userAddress.toLowerCase() === (parsedOperator ?? '').toLowerCase() && (
                <p className="text-slate-500 text-xs mb-3">
                  Self-assignment is common for small teams — allowed.
                </p>
              )}

              {operatorInput.trim() !== '' && !operatorLooksValid && (
                <div className="flex items-start gap-1.5 text-red-400 text-xs mb-3">
                  <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                  Enter a valid non-zero address.
                </div>
              )}

              {existingOperatorSeats.length > 0 && (
                <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2.5 text-xs text-amber-300 mb-3">
                  <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                  <span>
                    This wallet already operates{' '}
                    {existingOperatorSeats.map((s) => `Seat #${s.rank}`).join(', ')} — multi-seat
                    operators are allowed and shown in the audit trail.
                  </span>
                </div>
              )}

              <StepNav
                onBack={undefined}
                onNext={() => setStep(2)}
                nextDisabled={!operatorLooksValid}
              />
            </div>
          )}

          {step === 2 && (
            <div className="panel p-6">
              <h2 className="font-heading text-lg font-semibold text-slate-100 mb-1">
                Define seat scope
              </h2>
              <p className="text-slate-500 text-sm mb-5">
                What this operator may do on-chain, for how long — and the app-enforced policy
                applied before queue submission.
              </p>

              <WizardField label="On-chain action scope">
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setUnscoped(true)}
                    disabled={busy}
                    className={`btn py-1.5 px-3 text-xs ${unscoped ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Unscoped (all actions)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnscoped(false)}
                    disabled={busy}
                    className={`btn py-1.5 px-3 text-xs ${!unscoped ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Custom bitmask
                  </button>
                </div>
                {unscoped ? (
                  <p className="text-slate-500 text-xs">
                    Explicit <span className="font-mono">SESSION_SCOPE_UNSCOPED</span> (
                    {SESSION_SCOPE_UNSCOPED}).
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {SESSION_SCOPE_BITS.map(({ id, label, detail, bit }) => (
                      <label key={id} className="flex items-start gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedBits.has(id)}
                          onChange={() => toggleBit(id)}
                          disabled={busy}
                        />
                        <span>
                          <span className="font-medium">{label}</span>
                          <span className="font-mono text-slate-500">{` 1<<${Math.log2(bit)}`}</span>
                          <span className="block text-slate-500">{detail}</span>
                        </span>
                      </label>
                    ))}
                    {!scopeOk && (
                      <div className="flex items-start gap-1.5 text-red-400 text-xs">
                        <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                        Select at least one action — scope 0 is rejected on-chain.
                      </div>
                    )}
                  </div>
                )}
              </WizardField>

              <WizardField label="Session expiry" hint={`Sets expiry to ${formatTimestamp(expiry)} (unix ${expiry.toString()}).`}>
                <div className="flex flex-wrap gap-2 mb-2">
                  {SESSION_EXPIRY_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        setExpiryDays(days)
                        setCustomExpiry('')
                      }}
                      disabled={busy}
                      className={`btn py-1.5 px-3 text-xs ${
                        !customExpiry && expiryDays === days ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  aria-label="Custom expiry (local time)"
                  className="input py-2 text-sm"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  disabled={busy}
                />
                {!expiryOk && (
                  <p className="text-red-400 text-xs mt-1.5">Expiry must be a future unix timestamp.</p>
                )}
              </WizardField>

              <div className="divider" />

              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                App-enforced policy
              </p>
              <p className="text-slate-500 text-xs mb-4">
                Enforced in the app before queue submission; on-chain attribution stays with the
                seat. Stored with this seat’s audit record.
              </p>

              <WizardField label="Contract whitelist" hint="Empty list = any contract. Calls outside the list are blocked at submission.">
                <div className="flex gap-2">
                  <input
                    type="text"
                    spellCheck={false}
                    placeholder="0x… target contract"
                    className="input font-mono text-sm py-2"
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={addWhitelistEntry}
                    disabled={busy || !whitelistInput.trim()}
                    className="btn btn-secondary shrink-0 py-2 text-xs"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                {whitelist.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {whitelist.map((entry) => (
                      <span key={entry} className="badge badge-muted font-mono gap-1.5">
                        {shortenAddress(entry, 6)}
                        <button
                          type="button"
                          aria-label={`Remove ${entry}`}
                          onClick={() =>
                            setWhitelist((current) =>
                              current.filter((c) => c.toLowerCase() !== entry.toLowerCase()),
                            )
                          }
                          className="text-slate-500 hover:text-red-400"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </WizardField>

              <div className="grid gap-4 sm:grid-cols-2">
                <WizardField label="Per-tx value limit" hint="Human units of the chamber’s asset token. Empty = unlimited.">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 500000"
                    className="input font-mono text-sm py-2"
                    value={perTxLimit}
                    onChange={(e) => setPerTxLimit(e.target.value)}
                    disabled={busy}
                  />
                </WizardField>
                <WizardField label="Daily aggregate limit" hint="Resets 00:00 UTC. Empty = unlimited.">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 1500000"
                    className="input font-mono text-sm py-2"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    disabled={busy}
                  />
                </WizardField>
              </div>

              <WizardField label="Time window (UTC)">
                <label className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                  <input
                    type="checkbox"
                    checked={windowEnabled}
                    onChange={(e) => setWindowEnabled(e.target.checked)}
                    disabled={busy}
                  />
                  Restrict submissions to a window
                </label>
                {windowEnabled && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {WEEKDAY_LABELS.map((label, day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWindowDay(day)}
                          disabled={busy}
                          className={`btn py-1 px-2.5 text-[11px] ${
                            windowDays.includes(day) ? 'btn-primary' : 'btn-secondary'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <select
                        aria-label="Window start hour (UTC)"
                        className="input py-1.5 w-20 text-xs font-mono"
                        value={startHour}
                        onChange={(e) => setStartHour(Number(e.target.value))}
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <span>→</span>
                      <select
                        aria-label="Window end hour (UTC)"
                        className="input py-1.5 w-20 text-xs font-mono"
                        value={endHour}
                        onChange={(e) => setEndHour(Number(e.target.value))}
                      >
                        {Array.from({ length: 25 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h % 24).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <span>UTC</span>
                    </div>
                    {windowDays.length === 0 && (
                      <p className="text-red-400 text-xs mt-1.5">Pick at least one weekday.</p>
                    )}
                  </>
                )}
              </WizardField>

              {overBroad && (
                <div className="border border-red-500/30 bg-red-500/5 rounded-lg px-3 py-2.5 text-xs text-red-300 mt-2">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <p className="font-medium">
                        This operator will have <strong>unrestricted authority</strong> under Seat #
                        {seat.rank}.
                      </p>
                      <p className="text-slate-500 mt-1">
                        Unscoped bitmask, no whitelist, no value limits, no time window. Revocation
                        remains instant for the seat holder.
                      </p>
                      <label className="flex items-start gap-2 mt-2 text-red-200">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={acknowledgedUnrestricted}
                          onChange={(e) => setAcknowledgedUnrestricted(e.target.checked)}
                          disabled={busy}
                        />
                        I understand and accept this scope
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!expiryOk || !scopeOk || !overBroadAcked} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="panel p-6">
              <h2 className="font-heading text-lg font-semibold text-slate-100 mb-1">
                Override policy
              </h2>
              <p className="text-slate-500 text-sm mb-5">
                Who can revoke this operator. Revocation is instant and never requires quorum —
                the plug is always one click away.
              </p>
              <div className="space-y-2">
                {OVERRIDE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-start gap-3 stat-card cursor-pointer transition-colors ${
                      overridePolicy === option.id ? 'border-accent-500/40' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="override-policy"
                      className="mt-1"
                      checked={overridePolicy === option.id}
                      onChange={() => setOverridePolicy(option.id)}
                      disabled={busy}
                    />
                    <span>
                      <span className="text-sm text-slate-200 font-medium">
                        {option.label}
                        {option.recommended && (
                          <span className="badge badge-primary ml-2 text-[10px]">recommended</span>
                        )}
                        {!option.onChain && (
                          <span className="badge badge-pending ml-2 text-[10px]">app-level only</span>
                        )}
                      </span>
                      <span className="block text-slate-500 text-xs mt-0.5">{option.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-5">
                <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={false} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="panel p-6">
              <h2 className="font-heading text-lg font-semibold text-slate-100 mb-1">
                Review & sign
              </h2>
              <p className="text-slate-500 text-sm mb-5">
                Summary of what goes on-chain. The wallet will ask you to sign{' '}
                <span className="font-mono text-slate-300">setDirectorOperator</span>.
              </p>
              <ReviewTable
                seatRank={seat.rank}
                seatTokenId={seat.tokenId}
                delegationLabel={`${formatUnits(seat.delegation, shareDecimals)} shares`}
                operator={parsedOperator ?? zeroAddress}
                expiry={expiry}
                scope={scope}
                policy={policy}
                gas={gas}
                isEstimating={isEstimating}
                estimateUnavailable={estimateUnavailable}
              />
              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={busy}
                  className="btn btn-secondary"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleSign()}
                  disabled={!canProceedToReview || busy}
                  className="btn btn-primary"
                >
                  {busy ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" aria-hidden />
                      {isPending ? 'Confirm in wallet…' : 'Processing…'}
                    </>
                  ) : (
                    <>
                      <FiKey className="w-4 h-4" />
                      Sign setDirectorOperator
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="panel p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/40 border border-emerald-700/35 flex items-center justify-center mx-auto">
            <FiCheckCircle className="w-7 h-7 text-emerald-400" aria-hidden />
          </div>
          <h2 className="font-heading text-xl font-semibold text-slate-100">
            Operator assigned successfully
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            {parsedOperator && shortenAddress(parsedOperator, 6)} can now act under{' '}
            <span className="font-mono text-slate-300">Director Seat #{seat.rank}</span> until{' '}
            {formatTimestamp(expiry)}. The app-enforced policy was recorded with the seat’s audit
            trail.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to={`/operators?chamber=${chamber}`}
              className="btn btn-primary"
            >
              Open operator console
              <FiArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setOperatorInput('')
                setSeatParam(undefined)
                setStep(1)
              }}
            >
              Assign another operator
            </button>
          </div>
        </div>
      )}

      <div className="panel p-4 flex items-start gap-3">
        <FiCheck className="w-4 h-4 mt-0.5 text-accent-400 shrink-0 mt-0.5" aria-hidden />
        <p className="text-slate-500 text-xs leading-relaxed">
          On-chain, the operator’s actions are attributed to the director seat. Revocation is
          always instant for the seat holder —{' '}
          <span className="font-mono">setDirectorOperator(address(0))</span>.
        </p>
      </div>
    </div>
  )
}

function PageIntro({ chamber }: { chamber: `0x${string}` }) {
  return (
    <div>
      <Overline>Operator assignment</Overline>
      <h1 className="font-heading text-2xl font-bold text-slate-100 tracking-tight">
        Assign an operator
      </h1>
      <p className="text-slate-500 text-sm font-mono mt-1">{shortenAddress(chamber, 10)}</p>
    </div>
  )
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack?: (() => void) | undefined
  onNext: () => void
  nextDisabled: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
      {onBack && (
        <button type="button" onClick={onBack} className="btn btn-secondary sm:mr-auto">
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="btn btn-primary">
        Continue
        <FiArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function ReviewTable({
  seatRank,
  seatTokenId,
  delegationLabel,
  operator,
  expiry,
  scope,
  policy,
  gas,
  isEstimating,
  estimateUnavailable,
}: {
  seatRank: number
  seatTokenId: bigint
  delegationLabel: string
  operator: `0x${string}`
  expiry: bigint
  scope: number
  policy: OperatorScopePolicy
  gas: bigint | undefined
  isEstimating: boolean
  estimateUnavailable: boolean
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Director seat</td>
          <td className="py-2.5 text-slate-300">
            <span className="badge badge-primary font-mono mr-2">SEAT #{seatRank}</span>
            Member #{seatTokenId.toString()} · {delegationLabel}
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Operator</td>
          <td className="py-2.5 font-mono text-accent-300">{operator}</td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Call</td>
          <td className="py-2.5 font-mono text-slate-400 break-all">
            setDirectorOperator(#{seatTokenId.toString()}, {shortenAddress(operator, 6)})
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Expiry (UTC)</td>
          <td className="py-2.5 text-slate-300">{formatTimestamp(expiry)}</td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">On-chain scope</td>
          <td className="py-2.5 text-slate-300">
            {describeSessionScope(scope)}
            <span className="font-mono text-slate-500">
              {' '}
              (0x{scope === SESSION_SCOPE_UNSCOPED ? 'ffffffff' : scope.toString(16)})
            </span>
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">App policy</td>
          <td className="py-2.5 text-slate-300">{describeOperatorPolicy(policy)}</td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Revocable by</td>
          <td className="py-2.5 text-slate-300">
            {OVERRIDE_OPTIONS.find((o) => o.id === policy.overridePolicy)?.label ?? 'Director holder'} ·
            instant, no quorum
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-header py-2.5 pr-4 align-top">Gas est.</td>
          <td className="py-2.5 font-mono text-slate-300">
            {isEstimating
              ? 'estimating…'
              : gas !== undefined
                ? `~${gas.toString()} · paid by director wallet`
                : estimateUnavailable
                  ? 'unavailable — wallet estimates at signing'
                  : '—'}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

