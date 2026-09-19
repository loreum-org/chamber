/**
 * Decoded transaction view + simulation gate (#260).
 *
 * DecodedTxSummary — plain-English action line with a labelled counterparty,
 * USD value of any ETH/token transfer, and an expandable raw-calldata section.
 * It makes no RPC reads: token metadata comes from the built-in list or from
 * the transaction-time simulation.
 * TxSimulationPanel — runs the pending action as an impersonated eth_call,
 * renders a before/after state diff, and surfaces the revert reason so the
 * queue can block Confirm on failure.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { formatEther, formatUnits, isAddress, type Address } from 'viem'
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiCode,
  FiDollarSign,
  FiExternalLink,
  FiLoader,
  FiPlay,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi'
import {
  chainSupportsSpotUsdPricing,
  fetchSpotUsdPrices,
  formatUsdCompact,
} from '@/lib/portfolioUsd'
import { lookupKnownToken } from '@/lib/knownTokens'
import { decodeTransactionAction } from '@/lib/txDecoding'
import {
  simulateChamberTx,
  type SimResult,
  type SimTokenMeta,
  type SimulationMode,
} from '@/lib/txSimulation'
import { getBlockExplorerAddressUrl } from '@/lib/utils'

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Known label (e.g. this chamber) with a shortened-address fallback. */
function CounterpartyLabel({
  address,
  chainId,
  knownLabel,
}: {
  address: Address
  chainId: number
  knownLabel?: string
}) {
  const explorerUrl = chainId !== 31337 ? getBlockExplorerAddressUrl(address, chainId) : undefined
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <a
        href={explorerUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-slate-200 hover:text-accent-300 min-w-0"
        onClick={(e) => {
          if (!explorerUrl) e.preventDefault()
        }}
      >
        <span className="font-mono tabular-nums">{knownLabel ?? shorten(address)}</span>
        <FiExternalLink className="w-3 h-3 shrink-0 opacity-60" />
      </a>
      {knownLabel && (
        <span
          className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0"
          title={knownLabel}
        >
          Verified
        </span>
      )}
    </span>
  )
}

/** USD value of an ETH/ERC-20 amount via the portfolio's spot-price feed. */
function TransferUsdChip({
  chainId,
  token,
  amountRaw,
  decimals,
}: {
  chainId: number
  token: Address | 'native'
  amountRaw: bigint
  decimals: number
}) {
  const enabled = chainSupportsSpotUsdPricing(chainId) && amountRaw > 0n
  const { data, isPending } = useQuery({
    queryKey: ['tx-spot-usd', chainId, token],
    enabled,
    staleTime: 120_000,
    retry: false,
    queryFn: () => fetchSpotUsdPrices(chainId, [token === 'native' ? ('0x0000000000000000000000000000000000000000' as Address) : token]),
  })

  if (!enabled) return null
  const price =
    token === 'native'
      ? (data?.native ?? null)
      : (data?.tokens[token.toLowerCase()] ?? null)
  if (price == null) {
    return isPending ? null : (
      <span className="text-slate-500 text-xs" title="No spot price feed for this asset">
        USD n/a
      </span>
    )
  }
  let human: number
  try {
    human = Number(formatUnits(amountRaw, decimals))
  } catch {
    return null
  }
  if (!Number.isFinite(human)) return null
  return (
    <span className="badge bg-emerald-500/10 text-emerald-300 border-emerald-500/25 text-xs gap-1">
      <FiDollarSign className="w-3 h-3" />
      {formatUsdCompact(human * price)}
    </span>
  )
}

export function DecodedTxSummary({
  chainId,
  chamberAddress,
  chamberName,
  target,
  value,
  calldata,
  dataHash,
  functionNameHint,
  simulatedToken,
}: {
  chainId: number
  chamberAddress: Address
  chamberName?: string
  target: Address
  value: bigint
  calldata?: string | null
  dataHash?: string
  functionNameHint?: string
  /** Token metadata from a simulation run on this card, if any. */
  simulatedToken?: SimTokenMeta
}) {
  const decoded = useMemo(
    () => decodeTransactionAction({ target, value, calldata, functionNameHint }),
    [target, value, calldata, functionNameHint],
  )

  const intent = decoded?.intent ?? null
  const token = intent?.kind === 'erc20' ? intent.token : null

  const tokenMeta = token
    ? simulatedToken && simulatedToken.address.toLowerCase() === token.toLowerCase()
      ? simulatedToken
      : lookupKnownToken(chainId, token)
    : undefined
  const symbol = tokenMeta?.symbol
  const decimals = tokenMeta?.decimals
  /** Amount in token units, or raw base units until decimals are known. */
  const formatTokenAmount = (amountRaw: bigint): string => {
    if (decimals === undefined) return `${amountRaw.toString()} base units`
    try {
      return `${formatUnits(amountRaw, decimals)} ${symbol ?? 'tokens'}`
    } catch {
      return `${amountRaw.toString()} base units`
    }
  }

  const counterparty = decoded?.counterparty
  const knownLabel =
    counterparty && counterparty.toLowerCase() === chamberAddress.toLowerCase()
      ? chamberName ?? 'This chamber'
      : undefined

  if (!decoded && value <= 0n && !calldata) return null

  const amountChip = (() => {
    if (intent?.kind === 'eth') {
      return {
        amount: `${formatEther(intent.amountRaw)} ETH`,
        usd: (
          <TransferUsdChip
            chainId={chainId}
            token="native"
            amountRaw={intent.amountRaw}
            decimals={18}
          />
        ),
      }
    }
    if (intent?.kind === 'erc20') {
      return {
        amount: formatTokenAmount(intent.amountRaw),
        usd:
          decimals === undefined ? null : (
            <TransferUsdChip
              chainId={chainId}
              token={intent.token}
              amountRaw={intent.amountRaw}
              decimals={decimals}
            />
          ),
      }
    }
    return null
  })()

  const counterparties = [
    ...(counterparty && isAddress(counterparty) ? [{ address: counterparty, knownLabel }] : []),
    ...(intent?.kind === 'erc20' && intent.mode === 'transferFrom' && intent.from !== undefined
      ? [{ address: intent.from, knownLabel: undefined }]
      : []),
  ]

  return (
    <div className="mb-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Decoded action</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-300">
        {intent?.kind === 'erc20' && intent.mode === 'approve' && (
          <>
            <span>
              {intent.amountRaw === 0n ? 'Revoke the allowance of' : 'Approve spending of'}{' '}
              <span className="font-mono text-slate-100">
                {intent.amountRaw === 0n ? '0' : formatTokenAmount(intent.amountRaw)}
              </span>
            </span>
            {counterparties.map((c) => (
              <CounterpartyLabel key={c.address} address={c.address} chainId={chainId} knownLabel={c.knownLabel} />
            ))}
            <span>for the Chamber</span>
          </>
        )}
        {intent?.kind === 'erc20' && intent.mode === 'transferFrom' && (
          <>
            <span>Move</span>
            <span className="font-mono text-slate-100">{formatTokenAmount(intent.amountRaw)}</span>
            <span>from</span>
            {counterparties.map((c) => (
              <CounterpartyLabel key={c.address} address={c.address} chainId={chainId} knownLabel={c.knownLabel} />
            ))}
          </>
        )}
        {(intent?.kind === 'eth' || (intent?.kind === 'erc20' && intent.mode === 'transfer')) && (
          <>
            <span>Send</span>
            <span className="font-mono text-slate-100">{amountChip?.amount}</span>
            {amountChip?.usd}
            <span>to</span>
            {counterparties.map((c) => (
              <CounterpartyLabel key={c.address} address={c.address} chainId={chainId} knownLabel={c.knownLabel} />
            ))}
          </>
        )}
        {decoded?.isChamberSelfCall && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <FiShield className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-medium">{decoded.summary}</span>
            </span>
            {counterparties.map((c) => (
              <CounterpartyLabel key={c.address} address={c.address} chainId={chainId} knownLabel={c.knownLabel} />
            ))}
          </>
        )}
        {!intent && !decoded?.isChamberSelfCall && decoded && (
          <span className="text-slate-300">{decoded.summary}</span>
        )}
      </div>

      {calldata && (
        <details className="mt-2 group">
          <summary className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none">
            <FiCode className="w-3 h-3" />
            Raw calldata
            <FiChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-slate-500 font-mono">
              selector <span className="text-slate-300">{calldata.slice(0, 10)}</span> ·{' '}
              {Math.max(0, calldata.length / 2 - 1).toLocaleString('en-US')} bytes
            </p>
            <code className="block text-[10px] leading-relaxed text-slate-400 bg-slate-900/70 border border-slate-700/40 rounded-lg p-2 overflow-x-auto break-all font-mono">
              {calldata}
            </code>
            {dataHash && (
              <p className="text-[10px] text-slate-500 font-mono" title={dataHash}>
                commitment hash {dataHash.slice(0, 18)}…
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

export function TxSimulationPanel({
  chamberAddress,
  txId,
  mode,
  target,
  value,
  calldata,
  userAddress,
  userTokenId,
  disabled,
  onResult,
}: {
  chamberAddress: Address
  txId: number
  mode: SimulationMode
  target: Address
  value: bigint
  /** Calldata used for execute simulation (executeCalldata / resolved preimage). */
  calldata: string
  userAddress?: Address
  userTokenId?: bigint
  disabled?: boolean
  onResult?: (result: SimResult | null) => void
}) {
  const publicClient = usePublicClient()
  const [result, setResult] = useState<SimResult | null>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!publicClient || !userAddress || userTokenId === undefined) return
    setRunning(true)
    try {
      const sim = await simulateChamberTx({
        publicClient,
        chamberAddress,
        userAddress,
        userTokenId,
        txId,
        mode,
        target,
        value,
        calldata: mode === 'execute' ? calldata : null,
      })
      setResult(sim)
      onResult?.(sim)
    } catch (err) {
      const failed: SimResult = {
        status: 'error',
        ranAt: Date.now(),
        reason: err instanceof Error ? err.message : String(err),
        diff: [],
      }
      setResult(failed)
      onResult?.(failed)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-900/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Simulation</p>
        <button
          type="button"
          onClick={run}
          disabled={running || disabled || !userAddress || userTokenId === undefined}
          className="btn btn-secondary py-2 px-3 text-sm"
          title="Dry-run this action as an eth_call against current state"
        >
          {running ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              Simulating…
            </>
          ) : result ? (
            <>
              <FiRefreshCw className="w-4 h-4" />
              Re-run simulation
            </>
          ) : (
            <>
              <FiPlay className="w-4 h-4" />
              Run simulation
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-2">
          {result.status === 'passed' ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-400">
              <FiCheckCircle className="w-4 h-4" />
              Simulation passed — the {mode === 'confirm' ? 'confirmation' : 'execution'} completes on current state.
            </p>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <p className="flex items-start gap-1.5 font-medium text-red-300">
                <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Simulation reverted — {mode === 'confirm' ? 'Confirm' : 'Execute'} is blocked.
              </p>
              <p className="mt-1 text-red-200/90 break-words">{result.reason}</p>
            </div>
          )}

          {result.diff.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-3 font-medium uppercase tracking-wider text-[10px]">State</th>
                    <th className="py-1 pr-3 font-medium uppercase tracking-wider text-[10px]">Before</th>
                    <th className="py-1 font-medium uppercase tracking-wider text-[10px]">After</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {result.diff.map((row, i) => (
                    <tr key={i} className="border-t border-slate-700/40">
                      <td className="py-1.5 pr-3 text-slate-400">{row.label}</td>
                      <td className="py-1.5 pr-3 text-slate-300">{row.before}</td>
                      <td className={`py-1.5 ${row.highlight ? 'text-amber-300 font-medium' : 'text-slate-100'}`}>
                        {row.after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            {result.status === 'passed' ? 'Dry-run' : 'Reason extracted from the revert'} · eth_call against
            current state · ran {new Date(result.ranAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {!result && !running && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Dry-runs the {mode === 'confirm' ? 'confirmation' : 'execution'} onchain without spending gas. A
          revert here blocks {mode === 'confirm' ? 'Confirm' : 'Execute'} with the reason.
        </p>
      )}
    </div>
  )
}
