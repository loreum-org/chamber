import type { ReactNode } from 'react'

/**
 * Hero/collection stat tile for the showcase redesign (#307). A big
 * tabular-numeral value over a muted label, optionally a small sublabel.
 * Values always come from chain reads (totalSupply, mintCost, …) — the caller
 * never hardcodes them. Use `loading` to render a skeleton without layout shift.
 */
export interface StatTileProps {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  loading?: boolean
  className?: string
}

export function StatTile({ label, value, sub, loading = false, className = '' }: StatTileProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-slate-500">
        {label}
      </div>
      {loading ? (
        <div className="shimmer mt-2 h-7 w-20 rounded-md bg-slate-800/60" aria-hidden />
      ) : (
        <div className="mt-1 whitespace-nowrap font-display text-xl font-semibold tabular-nums text-slate-100 sm:text-[1.75rem]">
          {value}
        </div>
      )}
      {sub && !loading && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

/** Row of stat tiles with hairline dividers — the hero's live collection stats. */
export function StatRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  const childCount = Array.isArray(children) ? children.length : 1
  const cols = childCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <div
      className={`grid ${cols} gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] [&>*]:px-3 [&>*]:py-3.5 sm:[&>*]:px-5 sm:[&>*]:py-4 ${className}`}
    >
      {children}
    </div>
  )
}
