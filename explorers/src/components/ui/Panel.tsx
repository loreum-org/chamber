import type { HTMLAttributes } from 'react'

/**
 * Frame-07: "Existing .panel". Resolved against the repo register
 * (app/src/index.css .panel): slate-900/55 + backdrop-blur-xl +
 * border-slate-700/40 + rounded-xl + shadow-soft — the mock's flat
 * rgba(15,23,42,.55) with no blur/shadow is superseded.
 */
export function Panel({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel p-5 ${className}`} {...rest} />
}
