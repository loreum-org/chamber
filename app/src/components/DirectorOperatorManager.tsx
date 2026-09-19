import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useBlockNumber, useReadContract } from 'wagmi'
import { getAddress, isAddress, zeroAddress } from 'viem'
import { FiKey, FiLoader, FiTrash2, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { erc721Abi } from '@/contracts/abis'
import {
  useDirectorSession,
  useIsContractAccount,
  useSetDirectorOperator,
  useUserNFTs,
  useReceiptRefresh,
} from '@/hooks'
import { formatTimestamp, formatWalletSendError, shortenAddress } from '@/lib/utils'
import {
  DEFAULT_SESSION_EXPIRY_DAYS,
  SESSION_EXPIRY_PRESETS,
  SESSION_SCOPE_BITS,
  SESSION_SCOPE_UNSCOPED,
  describeSessionScope,
  directorSessionStatus,
  directorSessionStatusLabel,
  expiryUnixFromDays,
  isUnscopedSession,
  isValidSessionExpiry,
  scopeFromSelectedBits,
  selectedBitsFromScope,
  type SessionScopeBitId,
} from '@/lib/directorSession'

/**
 * Write path for `setDirectorOperator(tokenId, operator, expiry, scope)`.
 * Shown only when the connected wallet is `ownerOf(tokenId)` and that owner
 * is a contract (`code.length > 0`). Hidden for EOAs — the protocol rejects
 * that path (no EIP-1271).
 */
export function DirectorOperatorManager({
  chamberAddress,
  nftToken,
  tokenId: lockedTokenId,
  preferredTokenId,
}: {
  chamberAddress: `0x${string}`
  nftToken?: `0x${string}`
  /** When set (DirectorProfile), only this membership token is eligible. */
  tokenId?: bigint
  /** Default selection on ChamberDetail when the connected wallet is a seated owner. */
  preferredTokenId?: bigint
}) {
  const { address: userAddress } = useAccount()
  const { isContract, isFetched: bytecodeFetched } = useIsContractAccount(userAddress)
  const {
    tokenIds: ownedTokenIds,
    isLoading: nftsLoading,
  } = useUserNFTs(
    lockedTokenId === undefined ? nftToken : undefined,
    lockedTokenId === undefined ? userAddress : undefined,
    { chamberAddress },
  )

  const { data: lockedOwner, isFetched: lockedOwnerFetched } = useReadContract({
    address: nftToken,
    abi: erc721Abi,
    functionName: 'ownerOf',
    args: lockedTokenId !== undefined ? [lockedTokenId] : undefined,
    query: {
      enabled: !!nftToken && lockedTokenId !== undefined,
      retry: false,
    },
  })

  const isOwnerOfLocked =
    !!userAddress &&
    typeof lockedOwner === 'string' &&
    lockedOwner.toLowerCase() === userAddress.toLowerCase()

  const eligibleTokenIds = useMemo(() => {
    if (lockedTokenId !== undefined) {
      return isOwnerOfLocked ? [lockedTokenId] : []
    }
    const ids = [...ownedTokenIds]
    if (
      preferredTokenId !== undefined &&
      !ids.some((id) => id === preferredTokenId)
    ) {
      ids.unshift(preferredTokenId)
    }
    return ids
  }, [lockedTokenId, isOwnerOfLocked, ownedTokenIds, preferredTokenId])

  const [selectedId, setSelectedId] = useState('')
  const [operatorInput, setOperatorInput] = useState('')
  const [expiryDays, setExpiryDays] = useState(DEFAULT_SESSION_EXPIRY_DAYS)
  const [customExpiry, setCustomExpiry] = useState('')
  const [unscoped, setUnscoped] = useState(true)
  const [selectedBits, setSelectedBits] = useState<Set<SessionScopeBitId>>(new Set())
  const [lastWrite, setLastWrite] = useState<'set' | 'clear' | null>(null)

  useEffect(() => {
    if (eligibleTokenIds.length === 0) {
      setSelectedId('')
      return
    }
    setSelectedId((current) => {
      if (current && eligibleTokenIds.some((id) => id.toString() === current)) {
        return current
      }
      if (preferredTokenId !== undefined) {
        const preferred = preferredTokenId.toString()
        if (eligibleTokenIds.some((id) => id.toString() === preferred)) {
          return preferred
        }
      }
      return eligibleTokenIds[0].toString()
    })
  }, [eligibleTokenIds, preferredTokenId])

  const selectedTokenId = selectedId && /^\d+$/.test(selectedId) ? BigInt(selectedId) : undefined
  const session = useDirectorSession(chamberAddress, selectedTokenId)
  const { data: blockNumber } = useBlockNumber({
    query: {
      enabled: selectedTokenId !== undefined,
      // Seating/session maturity only needs coarse block height; hidden tabs pause.
      refetchInterval: 60_000,
    },
  })
  const { setDirectorOperator, clearDirectorOperator, isPending, isConfirming, hash } =
    useSetDirectorOperator(chamberAddress)

  const prefilledToken = useRef('')
  useEffect(() => {
    prefilledToken.current = ''
    setOperatorInput('')
    setUnscoped(true)
    setSelectedBits(new Set())
    setCustomExpiry('')
    setExpiryDays(DEFAULT_SESSION_EXPIRY_DAYS)
  }, [selectedTokenId])

  useEffect(() => {
    const key = selectedTokenId?.toString() ?? ''
    if (!key || !session.isFetched || prefilledToken.current === key) return
    prefilledToken.current = key
    if (session.liveOperator && session.liveOperator !== zeroAddress) {
      setOperatorInput(session.liveOperator)
      setUnscoped(isUnscopedSession(session.liveScope))
      setSelectedBits(selectedBitsFromScope(session.liveScope))
    }
  }, [selectedTokenId, session.isFetched, session.liveOperator, session.liveScope])

  useReceiptRefresh({
    chamberAddress,
    hash,
    successMessage: lastWrite === 'clear' ? 'Session key cleared' : 'Session key registered',
    errorMessage: 'Session key update failed',
    onSuccess: () => {
      void session.refetch()
      setLastWrite(null)
    },
  })

  const waitingForEligibility =
    !!userAddress &&
    (!bytecodeFetched ||
      (lockedTokenId !== undefined
        ? !lockedOwnerFetched
        : nftsLoading && ownedTokenIds.length === 0 && preferredTokenId === undefined))

  if (!userAddress || waitingForEligibility) return null
  if (!isContract) return null
  if (eligibleTokenIds.length === 0) return null

  const parsedOperator = (() => {
    const raw = operatorInput.trim()
    if (!raw || !isAddress(raw)) return undefined
    try {
      return getAddress(raw) as `0x${string}`
    } catch {
      return undefined
    }
  })()

  const operatorLooksValid = !!parsedOperator && parsedOperator !== zeroAddress
  const expiry = customExpiry
    ? (() => {
        const ms = new Date(customExpiry).getTime()
        return Number.isNaN(ms) ? 0n : BigInt(Math.floor(ms / 1000))
      })()
    : expiryUnixFromDays(expiryDays)
  const expiryOk = isValidSessionExpiry(expiry)
  const scope = scopeFromSelectedBits(selectedBits, unscoped)
  const scopeOk = scope !== 0
  const busy = isPending || isConfirming
  const canSet =
    !busy && operatorLooksValid && expiryOk && scopeOk && selectedTokenId !== undefined
  const canClear = !busy && session.isLive && selectedTokenId !== undefined

  const status = directorSessionStatus({
    liveOperator: session.liveOperator,
    rawOperator: session.rawOperator,
    rawExpiry: session.expiry,
    liveAt: session.liveAt,
    blockNumber,
  })
  const displayOperator = session.isLive ? session.liveOperator : session.rawOperator
  const displayScope = session.isLive ? session.liveScope : session.rawScope
  const displayExpiry = session.expiry
  const displayLiveAt = session.isLive ? session.liveAt : session.rawLiveAt

  const handleSet = async () => {
    if (!selectedTokenId || !parsedOperator || parsedOperator === zeroAddress) return
    if (!expiryOk || !scopeOk) return
    setLastWrite('set')
    try {
      await setDirectorOperator(selectedTokenId, parsedOperator, expiry, scope)
    } catch (err) {
      setLastWrite(null)
      toast.error(formatWalletSendError(err, 'Failed to set session key'))
    }
  }

  const handleClear = async () => {
    if (!selectedTokenId) return
    setLastWrite('clear')
    try {
      await clearDirectorOperator(selectedTokenId)
    } catch (err) {
      setLastWrite(null)
      toast.error(formatWalletSendError(err, 'Failed to clear session key'))
    }
  }

  const toggleBit = (id: SessionScopeBitId) => {
    setSelectedBits((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <FiKey className="w-4 h-4 mt-0.5 shrink-0 text-sky-400" aria-hidden />
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="font-medium text-sky-100">Session key</p>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
              This membership NFT is owned by a contract wallet. Register an operator with a future
              expiry and a non-zero scope, or clear the key. Chamber never checks ERC-1271. Confirm
              and execute wait until <span className="font-mono">liveAt</span> (
              <span className="font-mono">SEATING_DELAY</span>).
            </p>
          </div>

          {eligibleTokenIds.length > 1 && (
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5" htmlFor="session-key-token">
                Member ID
              </label>
              <select
                id="session-key-token"
                className="input py-2 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={busy}
              >
                {eligibleTokenIds.map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    #{id.toString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {eligibleTokenIds.length === 1 && (
            <p className="text-slate-400 text-xs font-mono">
              Member #{eligibleTokenIds[0].toString()}
            </p>
          )}

          <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2 space-y-1.5 text-xs">
            <p className="text-slate-300 font-medium">Current session</p>
            <p className="text-slate-400">
              Operator:{' '}
              {displayOperator && displayOperator !== zeroAddress ? (
                <span className="font-mono text-sky-100">{shortenAddress(displayOperator, 6)}</span>
              ) : (
                <span className="text-slate-500">none</span>
              )}
            </p>
            <p className="text-slate-400">
              Expiry:{' '}
              {displayExpiry > 0n ? (
                <span className="text-sky-100">{formatTimestamp(displayExpiry)}</span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </p>
            <p className="text-slate-400">
              Scope:{' '}
              <span className="text-sky-100">{describeSessionScope(displayScope)}</span>
              {displayScope !== 0 && (
                <span className="font-mono text-slate-500"> ({displayScope === SESSION_SCOPE_UNSCOPED ? 'max uint32' : `0x${displayScope.toString(16)}`})</span>
              )}
            </p>
            <p className="text-slate-400">
              liveAt:{' '}
              {displayLiveAt > 0n ? (
                <span className="font-mono text-sky-100">block {displayLiveAt.toString()}</span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </p>
            <p className="text-slate-300">
              Status: {directorSessionStatusLabel(status, session.liveAt, blockNumber)}
            </p>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-medium mb-1.5" htmlFor="session-key-operator">
              Operator address
            </label>
            <input
              id="session-key-operator"
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              className="input font-mono text-sm py-2"
              value={operatorInput}
              onChange={(e) => setOperatorInput(e.target.value)}
              disabled={busy}
            />
            {operatorInput.trim() && !operatorLooksValid && (
              <div className="flex items-start gap-1.5 mt-1.5 text-red-400 text-xs">
                <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                Enter a non-zero address to register a session key.
              </div>
            )}
          </div>

          <div>
            <p className="block text-slate-300 text-xs font-medium mb-1.5">Expiry</p>
            <div className="flex flex-wrap gap-2">
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
            <label className="block text-slate-500 text-xs mt-2 mb-1" htmlFor="session-key-expiry">
              Or a specific local time (must be in the future; expiry 0 is rejected)
            </label>
            <input
              id="session-key-expiry"
              type="datetime-local"
              className="input py-2 text-sm"
              value={customExpiry}
              onChange={(e) => setCustomExpiry(e.target.value)}
              disabled={busy}
            />
            <p className="text-slate-500 text-xs mt-1.5">
              Sets expiry to {formatTimestamp(expiry)} (unix {expiry.toString()}).
              {!expiryOk && (
                <span className="text-red-400"> Must be a future unix timestamp.</span>
              )}
            </p>
          </div>

          <div>
            <p className="block text-slate-300 text-xs font-medium mb-1.5">Scope</p>
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
                Explicit <span className="font-mono">SESSION_SCOPE_UNSCOPED</span> ({SESSION_SCOPE_UNSCOPED}).
                Scope 0 is rejected and is not a silent default.
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
                      <span className="font-mono text-slate-500"> 1&lt;&lt;{Math.log2(bit)}</span>
                      <span className="block text-slate-500">{detail}</span>
                    </span>
                  </label>
                ))}
                {!scopeOk && (
                  <div className="flex items-start gap-1.5 text-red-400">
                    <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                    Select at least one action. Scope 0 is rejected on-chain.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSet()}
              disabled={!canSet}
              className="btn btn-primary py-2 text-xs"
            >
              {isPending || isConfirming ? (
                <>
                  <FiLoader className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  {isPending ? 'Confirm…' : 'Processing…'}
                </>
              ) : (
                <>
                  <FiKey className="w-3.5 h-3.5" aria-hidden />
                  Set operator
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={!canClear}
              className="btn btn-secondary py-2 text-xs"
            >
              <FiTrash2 className="w-3.5 h-3.5" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}