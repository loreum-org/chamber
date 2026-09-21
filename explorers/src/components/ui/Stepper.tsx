import { useEffect, useState, type KeyboardEvent } from 'react'

/**
 * Frame-07: 40px tall; + disabled at `max` (claimable), − disabled at 1.
 * Arrow keys adjust; the field accepts typed integers and clamps on commit.
 * Buttons are labelled for screen readers.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  ariaLabel = 'Quantity',
  className = '',
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  ariaLabel?: string
  className?: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const clamp = (n: number) => Math.min(Math.max(n, min), max)
  const dec = () => onChange(clamp(value - 1))
  const inc = () => onChange(clamp(value + 1))

  const commitDraft = () => {
    const n = Number.parseInt(draft, 10)
    if (Number.isFinite(n)) onChange(clamp(n))
    else setDraft(String(value))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      inc()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      dec()
    }
  }

  const btn =
    'w-10 grid place-items-center text-lg text-slate-200 hover:bg-slate-800/60 ' +
    'disabled:opacity-35 disabled:pointer-events-none focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/60'

  return (
    <div
      onKeyDown={onKeyDown}
      className={`inline-flex items-stretch h-10 border border-slate-700/40 rounded-lg overflow-hidden ${className}`}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
        onClick={dec}
        disabled={value <= min}
        className={btn}
      >
        −
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="w-12 text-center text-sm font-semibold tabular-nums text-slate-100 bg-transparent border-x border-slate-700/40 focus:outline-none focus:bg-slate-950/50"
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel.toLowerCase()}`}
        onClick={inc}
        disabled={value >= max}
        className={btn}
      >
        +
      </button>
    </div>
  )
}
