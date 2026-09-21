import type { ReactNode } from 'react'

/**
 * Frame-07: 3 equal cells, muted label above a tabular-numeral value.
 * Values come from chain reads (totalSupply, mintCost, MAX_MINT) — never
 * hardcoded in the caller.
 */
export interface StatItem {
  label: string
  value: ReactNode
}

export function StatsStrip({
  items,
  className = '',
}: {
  items: StatItem[]
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-3 border border-slate-700/40 rounded-xl overflow-hidden divide-x divide-slate-700/40 ${className}`}
    >
      {items.map((it) => (
        <div key={it.label} className="px-4 py-3 min-w-0">
          <div className="text-xs text-slate-400">{it.label}</div>
          <div className="mt-0.5 text-lg font-semibold text-slate-100 tabular-nums truncate">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  )
}
