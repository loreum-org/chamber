import type { ReactNode } from 'react'

/**
 * Section header for showcase surfaces (#307): optional uppercase eyebrow, a
 * title, an optional supporting line, and an optional right-aligned action
 * (e.g. a "View all" link). Keeps section rhythm consistent across pages.
 */
export interface SectionHeadingProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** Center the block (used on marketing-ish sections). */
  align?: 'left' | 'center'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className = '',
}: SectionHeadingProps) {
  const centered = align === 'center'
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        centered ? 'sm:flex-col sm:items-center text-center' : ''
      } ${className}`}
    >
      <div className={`max-w-2xl ${centered ? 'mx-auto' : ''}`}>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
