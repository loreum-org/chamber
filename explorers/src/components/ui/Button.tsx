import { forwardRef, type ButtonHTMLAttributes } from 'react'

/**
 * Frame-07 spec: primary = accent-600 fill, white label; ghost = all secondary
 * actions. Exactly one primary per view; label names outcome + quantity.
 *
 * Values follow the repo register (app/src/index.css), which wins over the
 * design mock:
 *  - primary hover lightens to accent-500 (mock darkened to accent-700)
 *  - ghost is borderless text-slate-400 (mock showed a 1px slate border)
 * Motion: duration-200 (repo) — the mock's 150ms is not used.
 */

type Variant = 'primary' | 'ghost'
type Size = 'sm' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-700 shadow-sm border border-accent-500/30',
  ghost: 'text-slate-400 hover:text-accent-400 hover:bg-slate-800/60',
}

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm', // default surface (frame 07: 40px)
  lg: 'h-12 px-5 text-[15px]', // panel CTA (frame 07: 48px)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'sm', className = '', type = 'button', loading = false, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
})

/** Class string for anchor-styled CTAs (design renders several as <a>). */
export function buttonClass(variant: Variant = 'primary', size: Size = 'sm', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}
