import type { ReactNode } from 'react'

/**
 * Frame-07 callout semantics — colour carries meaning, never decoration:
 *   warn (amber) = decision needed · info (blue) = informational end state
 *   bad (red)    = failure            · ok (emerald) = success
 * No toasts for any claim state; these render inline in the panel.
 * Colors map to the repo badge registers (app/src/index.css .badge-*):
 *  -400 text on -950 tint with -700/35 border (mock used -500 text — superseded).
 * Bold one-line title + one sentence of what to do.
 */
export type CalloutVariant = 'warn' | 'info' | 'bad' | 'ok'

const styles: Record<CalloutVariant, { box: string; title: string }> = {
  warn: { box: 'bg-amber-950/40 border-amber-700/35', title: 'text-amber-400' },
  ok: { box: 'bg-emerald-950/50 border-emerald-700/35', title: 'text-emerald-400' },
  bad: { box: 'bg-red-950/40 border-red-700/35', title: 'text-red-400' },
  info: { box: 'bg-accent-950/80 border-accent-700/35', title: 'text-accent-300' },
}

export function Callout({
  variant,
  title,
  children,
  live = true,
  className = '',
}: {
  variant: CalloutVariant
  title: ReactNode
  children: ReactNode
  /** Announce to AT (default on). Turn off for static informational callouts. */
  live?: boolean
  className?: string
}) {
  const s = styles[variant]
  return (
    <div
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      className={`rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${s.box} ${className}`}
    >
      <b className={`block font-semibold mb-0.5 ${s.title}`}>{title}</b>
      <span className="text-slate-300">{children}</span>
    </div>
  )
}
