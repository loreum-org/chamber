/**
 * One-click exports for the compliance dashboard (#261).
 *
 * - CSV: multi-section, auditor-friendly text (summary metrics, daily series,
 *   transaction log). Downloaded as a Blob — no server round-trip.
 * - PDF: no PDF dependency ships with the app, so the report is generated as a
 *   self-contained HTML document (cover page + charts + methodology notes) and
 *   rendered through the browser's print pipeline ("Save as PDF"), per the
 *   HTML-print fallback in the #261 architecture notes.
 *
 * Every export is appended to a localStorage audit log so auditors can see how
 * often packages were generated and by whom.
 */

import {
  METHODOLOGY_NOTES,
  csvRow,
  formatDuration,
  type ComplianceMetrics,
} from './complianceMetrics'
import { sparklineSvgMarkup } from './sparklineSvg'
import type { ComplianceSnapshot } from './complianceQuery'

export interface ExportContext {
  chamberAddress: string
  chamberLabel: string
  networkLabel: string
  chainId: number
  explorerAddressUrl: string
  generatedBy: string
  /** Unix seconds. */
  generatedAt: number
  windowDays: number
  metrics: ComplianceMetrics
  snapshot: ComplianceSnapshot | undefined
  /** Sequence number of this export within the local audit log. */
  exportSequence: number
}

const EXPORT_LOG_KEY = 'chamber.complianceExportLog'

export interface ExportLogEntry {
  sequence: number
  format: 'csv' | 'pdf'
  chamberAddress: string
  windowDays: number
  generatedAt: number
}

/** Append an entry to the local export audit log (read side: getExportLog). */
export function recordExport(
  format: 'csv' | 'pdf',
  chamberAddress: string,
  windowDays: number,
  generatedAt: number,
): number {
  let log: ExportLogEntry[] = []
  try {
    const raw = window.localStorage.getItem(EXPORT_LOG_KEY)
    if (raw) log = JSON.parse(raw) as ExportLogEntry[]
  } catch {
    log = []
  }
  const entry: ExportLogEntry = {
    sequence: log.length + 1,
    format,
    chamberAddress,
    windowDays,
    generatedAt,
  }
  log.push(entry)
  try {
    window.localStorage.setItem(EXPORT_LOG_KEY, JSON.stringify(log.slice(-500)))
  } catch {
    // Storage full / private mode — the export still proceeds unlogged.
  }
  return entry.sequence
}

export function getExportLog(): ExportLogEntry[] {
  try {
    const raw = window.localStorage.getItem(EXPORT_LOG_KEY)
    return raw ? (JSON.parse(raw) as ExportLogEntry[]) : []
  } catch {
    return []
  }
}

function isoDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function isoDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

/** Multi-section CSV: summary metrics, daily series, transaction log. */
export function buildComplianceCsv(ctx: ExportContext): string {
  const { metrics } = ctx
  const lines: string[] = []

  lines.push('# Chamber Compliance Export')
  lines.push(csvRow(['section', 'metric', 'value']))
  lines.push(csvRow(['meta', 'chamber', ctx.chamberLabel]))
  lines.push(csvRow(['meta', 'chamber_address', ctx.chamberAddress]))
  lines.push(csvRow(['meta', 'network', ctx.networkLabel]))
  lines.push(csvRow(['meta', 'window_days', metrics.windowDays]))
  lines.push(csvRow(['meta', 'window_start', isoDate(metrics.hhiSeries[0]?.timestamp ?? ctx.generatedAt)]))
  lines.push(csvRow(['meta', 'window_end', isoDate(ctx.generatedAt)]))
  lines.push(csvRow(['meta', 'generated_at', isoDateTime(ctx.generatedAt)]))
  lines.push(csvRow(['meta', 'generated_by', ctx.generatedBy]))
  lines.push(csvRow(['meta', 'export_sequence', ctx.exportSequence]))
  lines.push(csvRow(['meta', 'source', `RPC events ${ctx.snapshot ? `blocks ${ctx.snapshot.fromBlock}..${ctx.snapshot.toBlock}` : 'N/A'}`]))
  lines.push(csvRow(['metric', 'board_seats', metrics.seats]))
  lines.push(csvRow(['metric', 'delegation_hhi', metrics.hhi === null ? 'N/A' : metrics.hhi.toFixed(4)]))
  lines.push(csvRow(['metric', 'delegation_hhi_reading', metrics.hhiReading]))
  lines.push(csvRow(['metric', 'seat_stability', metrics.seatStability === null ? 'N/A' : `${(metrics.seatStability * 100).toFixed(1)}%`]))
  lines.push(csvRow(['metric', 'seat_churn_events', metrics.churnCount]))
  lines.push(csvRow(['metric', 'median_time_to_execute_seconds', metrics.medianTimeToExecuteSec === null ? 'N/A' : Math.round(metrics.medianTimeToExecuteSec)]))
  lines.push(csvRow(['metric', 'policy_compliance_rate', metrics.policyComplianceRate === null ? 'N/A' : `${(metrics.policyComplianceRate * 100).toFixed(1)}%`]))
  lines.push(csvRow(['metric', 'proposals_submitted', metrics.submittedCount]))
  lines.push(csvRow(['metric', 'proposals_executed', metrics.executedCount]))
  lines.push('')

  lines.push('# Daily metric series')
  lines.push(csvRow(['date', 'delegation_hhi', 'seat_stability', 'median_time_to_execute_seconds', 'policy_compliance_rate']))
  for (let i = 0; i < metrics.hhiSeries.length; i++) {
    const hhi = metrics.hhiSeries[i]?.value
    const stability = metrics.seatStabilitySeries[i]?.value
    const tte = metrics.timeToExecuteSeries[i]?.value
    const policy = metrics.policyComplianceSeries[i]?.value
    lines.push(
      csvRow([
        isoDate(metrics.hhiSeries[i]?.timestamp ?? 0),
        hhi === null || hhi === undefined ? '' : hhi.toFixed(4),
        stability === null || stability === undefined ? '' : stability.toFixed(3),
        tte === null || tte === undefined ? '' : Math.round(tte),
        policy === null || policy === undefined ? '' : policy.toFixed(4),
      ]),
    )
  }
  lines.push('')

  lines.push('# Transaction log')
  lines.push(csvRow(['transaction_id', 'date_submitted', 'date_executed', 'deadline_utc', 'deadline_met', 'time_to_execute_seconds']))
  const txs = [...(ctx.snapshot?.txs ?? [])].sort((a, b) => a.submittedAt - b.submittedAt)
  if (txs.length === 0) {
    lines.push(csvRow(['-', 'no transactions in window', '', '', '', '']))
  }
  for (const tx of txs) {
    const deadlineMet =
      tx.executedAt === undefined
        ? tx.deadline && tx.deadline > 0
          ? 'pending'
          : 'pending (no deadline)'
        : !tx.deadline || tx.deadline <= 0
          ? 'no deadline'
          : tx.executedAt <= tx.deadline
            ? 'yes'
            : 'NO — after deadline'
    lines.push(
      csvRow([
        tx.transactionId.toString(),
        isoDateTime(tx.submittedAt),
        tx.executedAt === undefined ? '' : isoDateTime(tx.executedAt),
        tx.deadline && tx.deadline > 0 ? isoDateTime(tx.deadline) : '',
        deadlineMet,
        tx.executedAt === undefined ? '' : Math.max(0, tx.executedAt - tx.submittedAt),
      ]),
    )
  }
  lines.push('')

  lines.push('# Board composition (current)')
  lines.push(csvRow(['seat_token_id', 'delegated_amount']))
  for (const member of ctx.snapshot?.members ?? []) {
    lines.push(csvRow([member.tokenId.toString(), member.amount.toString()]))
  }

  return lines.join('\n') + '\n'
}

function seriesRow(label: string, value: string, sub: string): string {
  return (
    `<tr><td>${label}</td><td class="mono"><strong>${value}</strong></td><td>${sub}</td></tr>`
  )
}

function trendChart(
  title: string,
  series: Array<{ timestamp: number; value: number | null }>,
  formatValue: (v: number) => string,
  color: string,
): string {
  const points = series.map((p) => p.value)
  const last = [...points].reverse().find((v): v is number => v !== null)
  const chart = sparklineSvgMarkup(points, 660, 120, color)
  const firstTs = series[0]?.timestamp
  const lastTs = series[series.length - 1]?.timestamp
  return (
    `<div class="chart">` +
    `<h3>${escapeHtml(title)}</h3>` +
    `<p class="mono small">${firstTs ? isoDate(firstTs) : ''} → ${lastTs ? isoDate(lastTs) : ''} · latest: ${last === undefined ? 'N/A' : formatValue(last)}</p>` +
    chart +
    `</div>`
  )
}

/** Formatted printable report: cover page, KPIs, charts, methodology, tx log. */
export function buildComplianceReportHtml(ctx: ExportContext): string {
  const { metrics } = ctx
  const windowFrom = isoDate(metrics.hhiSeries[0]?.timestamp ?? ctx.generatedAt)
  const windowTo = isoDate(ctx.generatedAt)

  const summaryRows = [
    seriesRow('Board seats', String(metrics.seats), 'getSeats'),
    seriesRow(
      'Delegation HHI',
      metrics.hhi === null ? 'N/A' : metrics.hhi.toFixed(3),
      `${metrics.hhiReading} · even-split floor ${metrics.seats > 0 ? (1 / metrics.seats).toFixed(3) : '—'}`,
    ),
    seriesRow(
      'Seat stability',
      metrics.seatStability === null ? 'N/A' : `${(metrics.seatStability * 100).toFixed(0)}%`,
      `${metrics.churnCount} seat change(s) in window`,
    ),
    seriesRow(
      'Median time-to-execute',
      metrics.medianTimeToExecuteSec === null ? 'N/A' : formatDuration(metrics.medianTimeToExecuteSec),
      `${metrics.executedCount} proposal(s) executed`,
    ),
    seriesRow(
      'Policy compliance',
      metrics.policyComplianceRate === null ? 'N/A' : `${(metrics.policyComplianceRate * 100).toFixed(0)}%`,
      'executions before their deadline (no-deadline proposals excluded)',
    ),
  ].join('')

  const txRows = [...(ctx.snapshot?.txs ?? [])]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .map((tx) => {
      const outcome =
        tx.executedAt === undefined
          ? 'Pending / cancelled'
          : !tx.deadline || tx.deadline <= 0
            ? 'Executed (no deadline)'
            : tx.executedAt <= tx.deadline
              ? 'Executed — within deadline'
              : 'Executed — after deadline'
      return (
        '<tr>' +
        `<td class="mono">#${tx.transactionId.toString()}</td>` +
        `<td class="mono">${isoDateTime(tx.submittedAt)}</td>` +
        `<td class="mono">${tx.executedAt === undefined ? '—' : isoDateTime(tx.executedAt)}</td>` +
        `<td>${outcome}</td>` +
        `<td class="mono">${tx.executedAt === undefined ? '—' : formatDuration(Math.max(0, tx.executedAt - tx.submittedAt))}</td>` +
        '</tr>'
      )
    })
    .join('')

  const methodology = [
    ['Delegation HHI', METHODOLOGY_NOTES.hhi],
    ['Seat stability', METHODOLOGY_NOTES.seatStability],
    ['Time-to-execute', METHODOLOGY_NOTES.timeToExecute],
    ['Policy compliance', METHODOLOGY_NOTES.policyCompliance],
    ['Approximations', METHODOLOGY_NOTES.approximations],
  ]
    .map(([title, body]) => `<dt>${title}</dt><dd>${body}</dd>`)
    .join('')

  const boardRows = (ctx.snapshot?.members ?? [])
    .map(
      (member) =>
        `<tr><td class="mono">Seat #${member.tokenId.toString()}</td>` +
        `<td class="mono">${member.amount.toString()}</td></tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Chamber Audit Package — ${escapeHtml(ctx.chamberLabel)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  :root {
    --ink: #181522; --ink-soft: #453F56; --muted: #79728C;
    --line: #DCD5E6; --accent: #4A2F8F;
    --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    --sans: 'IBM Plex Sans', system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--sans); color: var(--ink); font-size: 12.5px; line-height: 1.55; }
  .cover { page-break-after: always; padding-top: 60mm; }
  .cover .kicker { font-family: var(--mono); letter-spacing: .22em; text-transform: uppercase; font-size: 11px; color: var(--accent); margin-bottom: 14px; }
  .cover h1 { font-size: 30px; font-weight: 300; margin-bottom: 10px; }
  .cover p { color: var(--ink); margin-bottom: 6px; }
  .cover .mono { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  h2 { font-size: 15px; margin: 22px 0 10px; border-bottom: 1px solid var(--accent); padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { font-family: var(--mono); font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); text-align: left; border-bottom: 1px solid var(--muted); padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .mono { font-family: var(--mono); }
  .small { font-size: 10px; color: var(--muted); }
  .chart { page-break-inside: avoid; margin-bottom: 14px; }
  .kpis { display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap; }
  .kpi { border: 1px solid var(--accent); border-radius: 4px; padding: 10px 14px; min-width: 150px; }
  .kpi .n { font-family: var(--mono); font-size: 20px; font-weight: 500; }
  .kpi .l { font-family: var(--mono); font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
  dl { margin: 8px 0; }
  dt { font-weight: 600; margin-top: 10px; }
  dd { color: var(--ink); margin-bottom: 6px; }
  footer { margin-top: 24px; border-top: 1px solid var(--muted); padding-top: 8px; font-family: var(--mono); font-size: 9.5px; color: var(--muted); }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <section class="cover">
    <p class="kicker">Chamber Audit Package</p>
    <h1>${escapeHtml(ctx.chamberLabel)}</h1>
    <p class="mono">${escapeHtml(ctx.chamberAddress)} · ${escapeHtml(ctx.networkLabel)}</p>
    <p style="margin-top:18px"><strong>Period:</strong> ${windowFrom} → ${windowTo} (${metrics.windowDays} days)</p>
    <p><strong>Generated:</strong> ${isoDateTime(ctx.generatedAt)}</p>
    <p><strong>Generated by:</strong> ${escapeHtml(ctx.generatedBy)}</p>
    <p><strong>Export sequence:</strong> #${ctx.exportSequence}</p>
    <p class="mono" style="margin-top:24px">${ctx.explorerAddressUrl ? `<a href="${ctx.explorerAddressUrl}">${ctx.explorerAddressUrl}</a>` : ''}</p>
    <p class="mono small">All figures derived directly from on-chain events (Chamber + director NFT contracts). No indexer.</p>
  </section>

  <section>
    <h2>Governance health summary</h2>
    <div class="kpis">
      <div class="kpi"><div class="n">${metrics.hhi === null ? 'N/A' : metrics.hhi.toFixed(2)}</div><div class="l">Delegation HHI · ${escapeHtml(metrics.hhiReading)}</div></div>
      <div class="kpi"><div class="n">${metrics.seatStability === null ? 'N/A' : `${(metrics.seatStability * 100).toFixed(0)}%`}</div><div class="l">Seat stability · ${metrics.windowDays}d</div></div>
      <div class="kpi"><div class="n">${metrics.medianTimeToExecuteSec === null ? 'N/A' : formatDuration(metrics.medianTimeToExecuteSec)}</div><div class="l">Median time-to-execute</div></div>
      <div class="kpi"><div class="n">${metrics.policyComplianceRate === null ? 'N/A' : `${(metrics.policyComplianceRate * 100).toFixed(0)}%`}</div><div class="l">Policy compliance</div></div>
    </div>
    <table><tbody>${summaryRows}</tbody></table>
  </section>

  <section class="page-break">
    <h2>30-day trends</h2>
    ${trendChart('Delegation HHI', metrics.hhiSeries, (v) => v.toFixed(3), '#4A2F8F')}
    ${trendChart('Seat stability', metrics.seatStabilitySeries, (v) => `${(v * 100).toFixed(0)}%`, '#156B44')}
    ${trendChart('Median time-to-execute (seconds)', metrics.timeToExecuteSeries, (v) => formatDuration(v), '#A05A00')}
    ${trendChart('Policy compliance rate', metrics.policyComplianceSeries, (v) => `${(v * 100).toFixed(0)}%`, '#156B44')}
  </section>

  <section class="page-break">
    <h2>Board composition (current)</h2>
    <table>
      <thead><tr><th>Seat</th><th>Delegated weight (raw)</th></tr></thead>
      <tbody>${boardRows || '<tr><td colspan="2">No delegated weight</td></tr>'}</tbody>
    </table>

    <h2>Transaction log</h2>
    <table>
      <thead><tr><th>Proposal</th><th>Submitted</th><th>Executed</th><th>Outcome</th><th>Time to execute</th></tr></thead>
      <tbody>${txRows || '<tr><td colspan="5">No transactions in this period</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Methodology notes</h2>
    <dl>${methodology}</dl>
  </section>

  <footer>
    Generated ${isoDateTime(ctx.generatedAt)} by ${escapeHtml(ctx.generatedBy)} ·
    export #${ctx.exportSequence} · window ${metrics.windowDays} days ·
    proposals: ${metrics.submittedCount} submitted / ${metrics.executedCount} executed ·
    seat changes: ${metrics.churnCount}
  </footer>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Trigger a browser download for the CSV. */
export function downloadComplianceCsv(ctx: ExportContext): void {
  const csv = buildComplianceCsv(ctx)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(`chamber-compliance-${shortAddress(ctx.chamberAddress)}-${isoDate(ctx.generatedAt)}.csv`, blob)
}

function triggerDownload(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-4)}`.toLowerCase()
}

/**
 * Generate the PDF report via the browser print pipeline: open a popup with
 * the fully-styled report, wait for layout, then invoke print. Falls back to a
 * new tab when popups are blocked.
 */
export function printComplianceReport(ctx: ExportContext): void {
  const html = buildComplianceReportHtml(ctx)
  const win = window.open('', '_blank')
  if (!win) {
    // Popup blocked — download the report as an .html file instead so the
    // user can open and print it manually.
    const blob = new Blob([html], { type: 'text/html' })
    triggerDownload(`chamber-audit-${shortAddress(ctx.chamberAddress)}-${isoDate(ctx.generatedAt)}.html`, blob)
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  // Give the document a tick to lay out before the print dialog opens.
  win.setTimeout(() => win.print(), 250)
}
