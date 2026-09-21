/**
 * Frame-07: 6px bar, accent fill = totalSupply / MAX_SUPPLY, meta line
 * "X of Y minted · Z left" supplied by the caller (computed from chain reads).
 */
export function ProgressBar({
  value,
  max,
  metaLeft,
  metaRight,
  className = '',
}: {
  value: number
  max: number
  metaLeft?: string
  metaRight?: string
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-1.5 rounded-full bg-slate-500/15 overflow-hidden"
      >
        <div className="h-full rounded-full bg-accent-600" style={{ width: `${pct}%` }} />
      </div>
      {(metaLeft !== undefined || metaRight !== undefined) && (
        <div className="flex justify-between gap-4 text-xs text-slate-500 mt-1.5 tabular-nums">
          <span>{metaLeft}</span>
          <span>{metaRight}</span>
        </div>
      )}
    </div>
  )
}
