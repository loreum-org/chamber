import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { isAddress, type Address } from 'viem'
import {
  FiActivity,
  FiAlertTriangle,
  FiClock,
  FiDownload,
  FiFileText,
  FiHelpCircle,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import { useMyChambers } from '@/hooks'
import { useComplianceMetrics } from '@/hooks/useComplianceMetrics'
import Sparkline from '@/components/Sparkline'
import {
  formatDuration,
  hhiBand,
  policyComplianceBand,
  seatStabilityBand,
  timeToExecuteBand,
  METHODOLOGY_NOTES,
  type HealthBand,
  type MetricPoint,
} from '@/lib/complianceMetrics'
import {
  downloadComplianceCsv,
  getExportLog,
  printComplianceReport,
  recordExport,
  type ExportContext,
} from '@/lib/complianceExport'
import { getNetworkName } from '@/lib/wagmi'
import { getBlockExplorerAddressUrl, shortenAddress } from '@/lib/utils'

const BAND_TEXT: Record<HealthBand, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
}

function bandColorHex(band: HealthBand): string {
  return band === 'ok' ? '#34d399' : band === 'warn' ? '#fbbf24' : '#f87171'
}

function percentText(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(0)}%`
}

interface WidgetProps {
  title: string
  note: string
  value: string
  band: HealthBand | null
  sub: string
  series: MetricPoint[]
  icon: React.ReactNode
}

function MetricWidget({ title, note, value, band, sub, series, icon }: WidgetProps) {
  const [showNote, setShowNote] = useState(false)
  const color = band ? bandColorHex(band) : '#94a3b8'
  const valueColor = band ? BAND_TEXT[band] : 'text-slate-200'
  return (
    <div className="panel p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <button
          type="button"
          aria-label={`${title} methodology`}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => setShowNote((open) => !open)}
        >
          <FiHelpCircle className="w-4 h-4" aria-hidden />
        </button>
      </div>
      <div className={`font-mono text-3xl font-medium ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
      <Sparkline
        values={series.map((point) => point.value)}
        color={color}
        ariaLabel={`${title} 30-day trend`}
        width={280}
        height={48}
      />
      <div className="text-[11px] text-slate-500 font-mono">30-day trend</div>
      {showNote && (
        <p className="text-xs text-slate-400 border-t border-slate-700/60 pt-2 mt-1">{note}</p>
      )}
    </div>
  )
}

export default function Compliance() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isConnected, address: account } = useAccount()
  const chainId = useChainId()
  const { chambers, recents } = useMyChambers()

  const urlChamber = searchParams.get('chamber')
  const [manualAddress, setManualAddress] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [exportSequence, setExportSequence] = useState(0)
  const [exportLogCount, setExportLogCount] = useState(0)

  const selectedChamber = useMemo(() => {
    if (urlChamber && isAddress(urlChamber)) return urlChamber as Address
    const first = chambers[0]?.address
    if (first && isAddress(first)) return first as Address
    return undefined
  }, [urlChamber, chambers])

  const {
    metrics,
    snapshot,
    computedAt,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useComplianceMetrics(selectedChamber)

  useEffect(() => {
    setExportLogCount(getExportLog().length)
  }, [exportSequence])

  const selectChamber = (address: string) => {
    setSearchParams(address ? { chamber: address } : {})
  }

  const handleOpenAddress = (e: React.FormEvent) => {
    e.preventDefault()
    const value = manualAddress.trim()
    if (!isAddress(value)) {
      setManualError('Enter a valid chamber address')
      return
    }
    setManualError(null)
    setManualAddress('')
    selectChamber(value)
  }

  const candidateAddresses = useMemo(() => {
    const seen = new Set<string>()
    const addresses: Address[] = []
    for (const entry of [...chambers.map((c) => c.address), ...recents]) {
      const key = entry.toLowerCase()
      if (!isAddress(entry) || seen.has(key)) continue
      seen.add(key)
      addresses.push(entry as Address)
    }
    return addresses
  }, [chambers, recents])

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!metrics || !selectedChamber) return
    const generatedAt = Math.floor(Date.now() / 1000)
    const sequence = recordExport(format, selectedChamber.toLowerCase(), metrics.windowDays, generatedAt)
    setExportSequence(sequence)
    const ctx: ExportContext = {
      chamberAddress: selectedChamber,
      chamberLabel: `Chamber ${shortenAddress(selectedChamber)}`,
      networkLabel: getNetworkName(chainId),
      chainId,
      explorerAddressUrl: getBlockExplorerAddressUrl(selectedChamber, chainId),
      generatedBy: account ?? 'unconnected',
      generatedAt,
      windowDays: metrics.windowDays,
      metrics,
      snapshot,
      exportSequence: sequence,
    }
    if (format === 'csv') downloadComplianceCsv(ctx)
    else printComplianceReport(ctx)
    setExportLogCount(getExportLog().length)
  }

  const hhiBandValue = metrics?.hhi != null ? hhiBand(metrics.hhi, metrics.seats) : null
  const stabilityBand = metrics?.seatStability != null ? seatStabilityBand(metrics.seatStability) : null
  const tteBand = metrics?.medianTimeToExecuteSec != null ? timeToExecuteBand(metrics.medianTimeToExecuteSec) : null
  const policyBand = metrics?.policyComplianceRate != null ? policyComplianceBand(metrics.policyComplianceRate) : null

  const staleMinutes = computedAt ? Math.max(0, Math.floor((Date.now() / 1000 - computedAt) / 60)) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-slate-100 flex items-center gap-3">
            <FiShield className="text-accent-400" aria-hidden />
            Compliance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Governance health and audit-ready exports for one chamber — computed directly from
            on-chain events over the trailing {metrics?.windowDays ?? 30} days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 border border-slate-700 rounded-full px-3 py-1">
            {metrics
              ? `Updated ${staleMinutes === 0 ? '<1' : staleMinutes} min ago`
              : 'Awaiting data'}
            {isFetching ? ' · refreshing…' : ''}
          </span>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => void refetch()}
            disabled={isFetching || !selectedChamber}
          >
            <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Chamber selector */}
      <div className="panel p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="text-xs font-mono uppercase tracking-widest text-slate-500" htmlFor="compliance-chamber">
            Chamber
          </label>
          <select
            id="compliance-chamber"
            className="input bg-slate-800/60 text-sm flex-1 min-w-0"
            value={selectedChamber ?? ''}
            onChange={(e) => selectChamber(e.target.value)}
          >
            {!selectedChamber && <option value="">Select a chamber…</option>}
            {selectedChamber && (
              <option value={selectedChamber}>{shortenAddress(selectedChamber)}</option>
            )}
            {candidateAddresses
              .filter((address) => address.toLowerCase() !== selectedChamber?.toLowerCase())
              .map((address) => (
                <option key={address.toLowerCase()} value={address.toLowerCase()}>
                  {shortenAddress(address)}
                </option>
              ))}
          </select>
          <form
            className="flex gap-2"
            onSubmit={handleOpenAddress}
          >
            <input
              className="input bg-slate-800/60 text-sm w-56"
              placeholder="Paste chamber address…"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary text-sm">
              Load
            </button>
          </form>
        </div>
        {manualError && <p className="text-xs text-red-400 mt-2">{manualError}</p>}
        <p className="text-[11px] text-slate-500 font-mono mt-2">
          Metrics and exports are scoped to the selected chamber's own events (Chamber + director NFT).
        </p>
      </div>

      {!isConnected && (
        <div className="panel p-4 border-amber-500/30 bg-amber-500/5 text-sm text-slate-300">
          <FiAlertTriangle className="inline mr-2 text-amber-400" aria-hidden />
          Connect a wallet and switch to a supported network to query compliance events.
        </div>
      )}

      {error && (
        <div className="panel p-4 border-red-500/30 bg-red-500/5 text-sm text-slate-300">
          <FiAlertTriangle className="inline mr-2 text-red-400" aria-hidden />
          Failed to load compliance data: {error.message}. Public RPCs occasionally rate-limit
          event queries — try Refresh.
        </div>
      )}

      {/* Widgets */}
      {isLoading && !metrics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-3 w-24 bg-slate-700/60 rounded mb-3" />
              <div className="h-8 w-20 bg-slate-700/40 rounded mb-2" />
              <div className="h-12 w-full bg-slate-700/30 rounded" />
            </div>
          ))}
        </div>
      )}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricWidget
            title="Delegation HHI"
            note={METHODOLOGY_NOTES.hhi}
            value={metrics.hhi === null ? 'N/A' : metrics.hhi.toFixed(2)}
            band={hhiBandValue}
            sub={metrics.hhiReading}
            series={metrics.hhiSeries}
            icon={<FiUsers className="text-accent-400" aria-hidden />}
          />
          <MetricWidget
            title="Seat stability"
            note={METHODOLOGY_NOTES.seatStability}
            value={percentText(metrics.seatStability)}
            band={stabilityBand}
            sub={`${metrics.churnCount} seat change(s) · ${metrics.seats} seats`}
            series={metrics.seatStabilitySeries}
            icon={<FiUsers className="text-accent-400" aria-hidden />}
          />
          <MetricWidget
            title="Median time-to-execute"
            note={METHODOLOGY_NOTES.timeToExecute}
            value={metrics.medianTimeToExecuteSec === null ? 'N/A' : formatDuration(metrics.medianTimeToExecuteSec)}
            band={tteBand}
            sub={`${metrics.executedCount} executed · ${metrics.submittedCount} submitted`}
            series={metrics.timeToExecuteSeries}
            icon={<FiClock className="text-accent-400" aria-hidden />}
          />
          <MetricWidget
            title="Policy compliance"
            note={METHODOLOGY_NOTES.policyCompliance}
            value={percentText(metrics.policyComplianceRate)}
            band={policyBand}
            sub="Executions before deadline (no-deadline proposals excluded)"
            series={metrics.policyComplianceSeries}
            icon={<FiActivity className="text-accent-400" aria-hidden />}
          />
        </div>
      )}

      {/* Exports */}
      {metrics && (
        <div className="panel p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-heading font-semibold text-slate-200">Audit export</h3>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.windowDays}-day window · summary metrics, daily series, transaction log,
                board composition. Every export is logged (currently {exportLogCount} on this
                device).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => handleExport('csv')}
              >
                <FiDownload className="w-4 h-4" aria-hidden />
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={() => handleExport('pdf')}
              >
                <FiFileText className="w-4 h-4" aria-hidden />
                Export PDF report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Methodology */}
      <div className="panel p-5">
        <h3 className="text-sm font-heading font-semibold text-slate-200 mb-3">Methodology</h3>
        <dl className="space-y-3 text-xs text-slate-400">
          <div>
            <dt className="text-slate-300 font-medium">Delegation HHI</dt>
            <dd>{METHODOLOGY_NOTES.hhi}</dd>
          </div>
          <div>
            <dt className="text-slate-300 font-medium">Seat stability</dt>
            <dd>{METHODOLOGY_NOTES.seatStability}</dd>
          </div>
          <div>
            <dt className="text-slate-300 font-medium">Time-to-execute</dt>
            <dd>{METHODOLOGY_NOTES.timeToExecute}</dd>
          </div>
          <div>
            <dt className="text-slate-300 font-medium">Policy compliance</dt>
            <dd>{METHODOLOGY_NOTES.policyCompliance}</dd>
          </div>
          <div>
            <dt className="text-slate-300 font-medium">Approximations</dt>
            <dd>{METHODOLOGY_NOTES.approximations}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}