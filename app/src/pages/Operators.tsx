import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccount, useBlockNumber, useChainId, useSwitchChain } from 'wagmi'
import { formatUnits } from 'viem'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiKey,
  FiLoader,
  FiRefreshCw,
  FiShield,
  FiSlash,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useIsContractAccount,
  useOperatorActivity,
  useOperatorSeats,
  useOperatorSeatsForWallet,
  useOperatorTxStats,
  useReceiptRefresh,
  useSetDirectorOperator,
  useShareDecimals,
} from '@/hooks'
import {
  SESSION_SCOPE_UNSCOPED,
  describeSessionScope,
  directorSessionStatus,
  directorSessionStatusLabel,
} from '@/lib/directorSession'
import {
  describeOperatorPolicy,
  loadOperatorPolicy,
  normalizeOperatorAddress,
} from '@/lib/operatorPolicy'
import { getNetworkName, getPreferredSupportedChainId, hasValidAddresses } from '@/lib/wagmi'
import {
  readSimulatedChainId,
  showMainnetUnsupportedBanner,
  switchToSupportedChainLabel,
} from '@/lib/supportedChain'
import { useMyChambers } from '@/hooks/useMyChambers'
import { formatTimestamp, formatWalletSendError, shortenAddress } from '@/lib/utils'
import type { OperatorSeatView } from '@/hooks/useOperatorConsole'

const REVOKE_CONFIRM_WORD = 'REVOKE'

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-[0.16em] leading-none mb-1">
      {children}
    </p>
  )
}

export default function Operators() {
  const [searchParams, setSearchParams] = useSearchParams()
  const locationChainId = useChainId()
  const { address: userAddress } = useAccount()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()

  const simulatedChainId = readSimulatedChainId(searchParams.toString(), import.meta.env.DEV)
  const chainId = simulatedChainId ?? locationChainId
  const preferredChainId = getPreferredSupportedChainId()
  const showUnsupportedChain = showMainnetUnsupportedBanner(chainId, true)

  const { chambers, recents } = useMyChambers()

  const chamberRaw = searchParams.get('chamber') ?? ''
  const chamber = useMemo(
    () => (hasValidAddresses(chainId) ? normalizeOperatorAddress(chamberRaw) ?? undefined : undefined),
    [chamberRaw, chainId],
  )

  const {
    seats,
    refetch: refetchSeats,
    isFetched: seatsFetched,
  } = useOperatorSeats(chamber)
  const txStats = useOperatorTxStats(chamber)
  const activity = useOperatorActivity(chamber)
  const shareDecimals = useShareDecimals(chamber)

  const myOperatorSeats = useOperatorSeatsForWallet(seats, userAddress)
  const seatsWithOperators = seats.filter((seat) => seat.isLive)

  const handleSwitchChain = async () => {
    if (preferredChainId && switchChainAsync) {
      try {
        await switchChainAsync({ chainId: preferredChainId })
        return
      } catch {
        toast.error(`Switch to ${getNetworkName(preferredChainId)} to continue`)
        return
      }
    }
    toast.error(`Switch your wallet to ${getNetworkName(preferredChainId ?? 11155111)}`)
  }

  const setChamberParam = (value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (!value) next.delete('chamber')
    else next.set('chamber', value)
    setSearchParams(next)
  }

  useEffect(() => {
    if (!chamber && chambers.length > 0) {
      setChamberParam(chambers[0].address)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamber, chambers.length])

  return (
    <div className="space-y-8">
      {showUnsupportedChain && (
        <div className="panel p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-slate-300 text-sm">
              This deployment does not include <strong className="text-slate-200">Ethereum mainnet</strong>.
              Switch to <strong className="text-slate-200">{getNetworkName(preferredChainId ?? 11155111)}</strong>{' '}
              to manage operators.
            </p>
            <button
              type="button"
              className="btn btn-primary shrink-0 self-start sm:self-auto"
              onClick={() => void handleSwitchChain()}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <FiLoader className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <FiRefreshCw className="w-4 h-4" aria-hidden />
              )}
              {isSwitching ? 'Switching…' : switchToSupportedChainLabel(preferredChainId)}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden panel px-5 py-4">
        <div className="absolute inset-0 bg-mesh-gradient pointer-events-none opacity-[0.85]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <Overline>Operator console</Overline>
            <h1 className="font-heading text-2xl font-bold text-slate-100 tracking-tight">
              Operators
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Who acts under each director seat — assignment, scope, and the instant plug.
            </p>
          </div>
          <Link
            to={chamber ? `/operators/wizard?chamber=${chamber}` : '/operators/wizard'}
            className={`btn btn-primary shrink-0 ${!chamber ? 'pointer-events-none opacity-50' : ''}`}
          >
            <FiKey className="w-4 h-4" />
            Assign operator
          </Link>
        </div>
      </div>

      {/* Chamber selector */}
      <div className="panel p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 min-w-0">
          <label htmlFor="operator-chamber" className="block text-slate-400 text-xs font-medium mb-1.5">
            Chamber
          </label>
          <select
            id="operator-chamber"
            className="input font-mono text-sm"
            value={chamber ?? ''}
            onChange={(e) => setChamberParam(e.target.value || undefined)}
          >
            <option value="">Select a chamber…</option>
            {chambers.map((entry) => (
              <option key={entry.address} value={entry.address}>
                {shortenAddress(entry.address, 10)}
                {entry.isDirector ? ' · director' : ''}
              </option>
            ))}
            {chamber && !chambers.some((c) => c.address.toLowerCase() === chamber.toLowerCase()) && (
              <option value={chamber}>{shortenAddress(chamber, 10)} (open by URL)</option>
            )}
          </select>
        </div>
        {recents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Recents
            </span>
            {recents.slice(0, 4).map((addr) => (
              <button
                key={addr}
                type="button"
                onClick={() => setChamberParam(addr)}
                className={`badge font-mono text-[11px] cursor-pointer ${
                  addr.toLowerCase() === chamber?.toLowerCase()
                    ? 'badge-primary'
                    : 'bg-slate-800 text-slate-300 border-slate-600/60 hover:text-slate-100'
                }`}
              >
                {shortenAddress(addr, 8)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operator perspective banner — the authority chain, from the operator side */}
      {myOperatorSeats.length > 0 && chamber && (
        <div className="panel p-4 border-accent-600/25 bg-accent-950/20">
          <div className="flex items-start gap-3">
            <FiShield className="w-5 h-5 text-accent-400 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-slate-200 text-sm font-medium">
                Operating as{' '}
                {myOperatorSeats.map((seat, index) => (
                  <span key={seat.tokenId.toString()}>
                    {index > 0 && ', '}
                    <span className="badge badge-primary font-mono text-[10px] align-middle">
                      DIRECTOR SEAT #{seat.rank}
                    </span>
                  </span>
                ))}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                On-chain attribution for your submissions lands on the seat, not this wallet. Scope:{' '}
                {describeSessionScope(myOperatorSeats[0]?.scope ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {!chamber ? (
        <div className="panel p-12 text-center">
          <FiUsers className="w-8 h-8 text-slate-600 mx-auto mb-4" aria-hidden />
          <p className="text-slate-500 text-sm">Select a chamber to manage its operator seats.</p>
        </div>
      ) : (
        <>
          {/* Seat allocation + queue analytics */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-slate-100">Seat allocation & activity</h2>
              <button
                type="button"
                onClick={() => {
                  void refetchSeats()
                  void activity.refetch()
                }}
                className="btn btn-ghost py-1.5 text-xs"
              >
                <FiRefreshCw className="w-3.5 h-3.5" aria-hidden />
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Seats with operators"
                value={seats.length === 0 ? '—' : `${seatsWithOperators.length}/${seats.length}`}
                hint={`${seats.length} seated of the board`}
              />
              <StatCard
                label="Txs submitted"
                value={txStats.isLoading ? '…' : txStats.total.toString()}
                hint="max last 200 reads"
              />
              <StatCard
                label="Executed / pending"
                value={txStats.isLoading ? '…' : `${txStats.executed} / ${txStats.pending}`}
                hint="failed executions are not recorded on-chain"
              />
              <StatCard
                label="Value moved (executed)"
                value={txStats.isLoading ? '…' : `${formatUnits(txStats.valueMovedWei, 18)} ETH`}
                hint="native call value; ERC-20 transfers not included"
              />
            </div>
          </section>

          {/* Activity feed */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-slate-100">Activity feed</h2>
            <div className="panel divide-y divide-slate-800/70">
              {activity.isLoading ? (
                <div className="p-6">
                  <div className="h-4 bg-slate-800/70 rounded w-2/3 animate-pulse" />
                  <div className="h-4 bg-slate-800/70 rounded w-1/2 mt-3 animate-pulse" />
                </div>
              ) : activity.isError ? (
                <FeedRow
                  kind="error"
                  timestamp={undefined}
                  summary="Activity lookup failed on this RPC — try Refresh."
                />
              ) : activity.items.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No recent activity in the last ~{activity.lookbackBlocks.toString()} blocks.
                </div>
              ) : (
                activity.items.map((item) => (
                  <FeedRow
                    key={item.id}
                    kind={item.kind}
                    timestamp={item.timestamp}
                    summary={item.summary}
                    tokenId={item.tokenId}
                  />
                ))
              )}
            </div>
          </section>

          {/* Seats */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-slate-100">
              Director seats
            </h2>
            {!seatsFetched ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-5 bg-slate-800 rounded-lg w-1/3 mb-4" />
                    <div className="h-4 bg-slate-800 rounded-lg w-2/3" />
                  </div>
                ))}
              </div>
            ) : seats.length === 0 ? (
              <div className="panel p-8 text-center text-slate-500 text-sm">
                No seated membership tokens yet.
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {seats.map((seat) => (
                  <SeatOperatorCard
                    key={seat.tokenId.toString()}
                    chamber={chamber}
                    seat={seat}
                    shareDecimals={shareDecimals}
                    isConnectedOwner={
                      !!userAddress &&
                      !!seat.owner &&
                      seat.owner.toLowerCase() === userAddress.toLowerCase()
                    }
                    onWrite={() => {
                      void refetchSeats()
                      void activity.refetch()
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="stat-card">
      <Overline>{label}</Overline>
      <p className="font-heading text-xl font-bold text-slate-100 tabular-nums font-mono">{value}</p>
      {hint && <p className="text-slate-500 text-[11px] mt-1">{hint}</p>}
    </div>
  )
}

type FeedKind =
  | 'operator-assigned'
  | 'operator-cleared'
  | 'tx-submitted'
  | 'tx-executed'
  | 'tx-cancelled'
  | 'error'

function FeedRow({
  kind,
  timestamp,
  summary,
  tokenId,
}: {
  kind: FeedKind
  timestamp: number | undefined
  summary: string
  tokenId?: bigint
}) {
  const badge =
    kind === 'operator-assigned' ? (
      <span className="badge badge-primary">assigned</span>
    ) : kind === 'tx-executed' ? (
      <span className="badge badge-success">executed</span>
    ) : kind === 'operator-cleared' ? (
      <span className="badge badge-danger">revoked</span>
    ) : kind === 'tx-cancelled' ? (
      <span className="badge badge-danger">cancelled</span>
    ) : kind === 'tx-submitted' ? (
      <span className="badge badge-pending">submitted</span>
    ) : (
      <span className="badge badge-muted">info</span>
    )

  return (
    <div className="flex items-start gap-3 px-4 py-3 text-sm">
      <span className="font-mono text-xs text-slate-500 whitespace-nowrap pt-0.5 w-32 shrink-0">
        {timestamp !== undefined ? new Date(timestamp * 1000).toISOString().slice(0, 16) + 'Z' : '—'}
      </span>
      <span className="shrink-0 pt-0.5">{badge}</span>
      <span className="text-slate-300 min-w-0 break-words">
        {summary}
        {tokenId !== undefined && (
          <span className="font-mono text-slate-500"> · member #{tokenId.toString()}</span>
        )}
      </span>
    </div>
  )
}

function SeatOperatorCard({
  chamber,
  seat,
  shareDecimals,
  isConnectedOwner,
  onWrite,
}: {
  chamber: `0x${string}`
  seat: OperatorSeatView
  shareDecimals: number
  isConnectedOwner: boolean
  onWrite: () => void
}) {
  const { data: blockNumber } = useBlockNumber({
    // Session liveness only needs coarse block height (one poll per seat card); hidden tabs pause.
    query: { enabled: seat.isLive, refetchInterval: 60_000 },
  })
  const cardChainId = useChainId()
  const ownerContract = useIsContractAccount(seat.owner)
  const status = directorSessionStatus({
    liveOperator: seat.operator,
    rawOperator: seat.rawOperator,
    rawExpiry: seat.expiry,
    liveAt: seat.liveAt,
    blockNumber,
  })
  const statusLabel = directorSessionStatusLabel(status, seat.liveAt, blockNumber)
  const savedPolicy = useMemo(
    () => loadOperatorPolicy({ chainId: cardChainId, chamber, tokenId: seat.tokenId.toString() }),
    [cardChainId, chamber, seat.tokenId],
  )

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Overline>Director seat #{seat.rank}</Overline>
          <p className="font-mono text-sm text-slate-200">
            Member #{seat.tokenId.toString()} ·{' '}
            {formatUnits(seat.delegation, shareDecimals)} shares
          </p>
          <p className="font-mono text-xs text-slate-500 mt-0.5">
            {shortenAddress(seat.owner ?? '0x0', 6)}
            {ownerContract.isFetched && !ownerContract.isContract && ' · EOA-owned (no operator)'}
          </p>
        </div>
        <StatusBadge status={status} label={statusLabel} />
      </div>

      {/* Authority chain: seat → operator */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2.5 space-y-1 text-xs">
        <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px] mb-1">
          Authority chain
        </p>
        <p className="text-slate-300">
          <span className="badge badge-primary font-mono text-[10px] mr-2">SEAT #{seat.rank}</span>
          {shortenAddress(seat.owner ?? '0x0', 6)}
          <span className="text-slate-600 mx-2">→</span>
          {seat.isLive ? (
            <>
              <span className="badge badge-success font-mono text-[10px] mr-2">OPERATOR</span>
              <span className="font-mono text-accent-300">{shortenAddress(seat.operator ?? '0x0', 6)}</span>
            </>
          ) : (
            <span className="text-slate-500">no operator</span>
          )}
        </p>
        {seat.isLive && (
          <p className="text-slate-500 mt-1">
            Expiry {formatTimestamp(seat.expiry)} · scope {describeSessionScope(seat.scope)}
            {seat.scope !== 0 && seat.scope !== SESSION_SCOPE_UNSCOPED && (
              <span className="font-mono"> (0x{seat.scope.toString(16)})</span>
            )}
          </p>
        )}
        {seat.isLive && seat.liveAt > 0n && status === 'delayed' && (
          <p className="text-amber-400">
            Confirm/execute unlock at block {seat.liveAt.toString()} (now {blockNumber?.toString() ?? '…'})
          </p>
        )}
        {seat.isLive && savedPolicy && (
          <p className="text-slate-500 mt-1">
            App policy: {describeOperatorPolicy(savedPolicy.policy)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {isConnectedOwner ? (
          <>
            <Link
              to={`/operators/wizard?chamber=${chamber}&seat=${seat.tokenId.toString()}`}
              className="btn btn-secondary py-2 text-xs"
            >
              <FiKey className="w-3.5 h-3.5" aria-hidden />
              {seat.isLive ? 'Reassign operator' : 'Assign operator'}
            </Link>
            {seat.isLive && (
              <RevokeControl
                chamber={chamber}
                seat={seat}
                onWrite={onWrite}
              />
            )}
          </>
        ) : (
          <p className="text-slate-500 text-xs py-2">
            Connect the seat owner's wallet to manage this seat's operator.
          </p>
        )}
      </div>
    </div>
  )
}

function RevokeControl({
  chamber,
  seat,
  onWrite,
}: {
  chamber: `0x${string}`
  seat: OperatorSeatView
  onWrite: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const { clearDirectorOperator, isPending, isConfirming, hash } = useSetDirectorOperator(chamber)

  useReceiptRefresh({
    chamberAddress: chamber,
    hash,
    successMessage: 'Operator revoked successfully',
    errorMessage: 'Revocation failed',
    onSuccess: () => {
      setConfirmOpen(false)
      setTyped('')
      onWrite()
    },
  })

  const busy = isPending || isConfirming
  const canRevoke = typed.trim().toUpperCase() === REVOKE_CONFIRM_WORD && !busy

  const handleRevoke = async () => {
    if (!seat.tokenId) return
    try {
      await clearDirectorOperator(seat.tokenId)
    } catch (err) {
      toast.error(formatWalletSendError(err, 'Failed to revoke operator'))
    }
  }

  if (!confirmOpen) {
    return (
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="btn btn-ghost py-2 text-xs !text-red-400 hover:!bg-red-950/30"
      >
        <FiSlash className="w-3.5 h-3.5" aria-hidden />
        Revoke operator access
        <span className="font-mono text-[10px] text-slate-500 ml-1">instant · no quorum</span>
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-3 space-y-2">
      <p className="text-xs text-red-300">
        Revoke{' '}
        <span className="font-mono">{shortenAddress(seat.operator ?? '0x0', 6)}</span>? They will no
        longer be able to submit transactions under Seat #{seat.rank}. Pending transactions are not
        affected — they were submitted under valid authority.
      </p>
      <p className="text-[11px] text-slate-500 font-mono">
        Sets operator to address(0), expiry 0, scope 0. This action is logged.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          spellCheck={false}
          placeholder={`Type ${REVOKE_CONFIRM_WORD} to confirm`}
          aria-label={`Type ${REVOKE_CONFIRM_WORD} to confirm revocation`}
          className="input py-2 text-sm font-mono flex-1"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void handleRevoke()}
          disabled={!canRevoke}
          className="btn btn-secondary !border-red-500/40 !text-red-300 hover:!bg-red-950/40 shrink-0 py-2 text-xs"
        >
          {busy ? (
            <>
              <FiLoader className="w-3.5 h-3.5 animate-spin" aria-hidden />
              {isPending ? 'Confirm…' : 'Processing…'}
            </>
          ) : (
            <>
              <FiXCircle className="w-3.5 h-3.5" aria-hidden />
              Revoke
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmOpen(false)
            setTyped('')
          }}
          disabled={busy}
          className="btn btn-ghost py-2 text-xs shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  label,
}: {
  status: 'none' | 'active' | 'delayed' | 'expired' | 'stale'
  label: string
}) {
  const cls =
    status === 'active'
      ? 'badge-success'
      : status === 'delayed'
        ? 'badge-pending'
        : status === 'expired' || status === 'stale'
          ? 'badge-danger'
          : 'badge-muted'
  const icon =
    status === 'active' ? (
      <FiCheckCircle className="w-3 h-3 mr-1" aria-hidden />
    ) : status === 'delayed' ? (
      <FiClock className="w-3 h-3 mr-1" aria-hidden />
    ) : status === 'expired' || status === 'stale' ? (
      <FiAlertTriangle className="w-3 h-3 mr-1" aria-hidden />
    ) : null
  return (
    <span className={`badge ${cls} shrink-0 max-w-[16rem]`} title={label}>
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}

