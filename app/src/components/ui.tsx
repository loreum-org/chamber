import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiCopy, FiExternalLink } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { getBlockExplorerAddressUrl, shortenAddress } from '@/lib/utils'
import { getNetworkName } from '@/lib/supportedChain'

/*
 * Shared layout primitives. Every page is built from the same handful of
 * pieces so screens read the same way: a flat page header, a single tab row,
 * flat stat tiles, and sections with one title line.
 */

export function PageHeader({
  overline,
  title,
  description,
  actions,
  back,
  className = '',
}: {
  overline?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  className?: string
}) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors mb-2"
          >
            <FiArrowLeft className="w-3.5 h-3.5" aria-hidden />
            {back.label}
          </Link>
        )}
        {overline && <p className="eyebrow mb-1">{overline}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="text-slate-400 text-sm mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}

export type TabItem<T extends string = string> = {
  id: T
  label: string
  count?: number
  /** When set, the tab is a route link instead of a button. */
  to?: string
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
  className = '',
}: {
  items: TabItem<T>[]
  active: T | null
  onChange?: (id: T) => void
  ariaLabel?: string
  className?: string
}) {
  return (
    <nav className={`tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === active
        const cls = `tab ${isActive ? 'tab-active' : ''}`
        const inner = (
          <>
            <span>{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className={`badge ${isActive ? 'badge-primary' : ''} px-1.5 py-0 text-[11px]`}>
                {item.count > 99 ? '99+' : item.count}
              </span>
            )}
          </>
        )
        if (item.to) {
          return (
            <Link key={item.id} to={item.to} className={cls} role="tab" aria-selected={isActive}>
              {inner}
            </Link>
          )
        }
        return (
          <button
            key={item.id}
            type="button"
            className={cls}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(item.id)}
          >
            {inner}
          </button>
        )
      })}
    </nav>
  )
}

export function Segmented<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
}: {
  items: { id: T; label: string; count?: number }[]
  active: T | null
  onChange: (id: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`segment ${isActive ? 'segment-active' : ''}`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className="ml-1.5 text-xs text-slate-500 tabular-nums">{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Small chain label, e.g. on a chamber card. */
export function NetworkBadge({ chainId }: { chainId: number }) {
  return <span className="badge badge-muted">{getNetworkName(chainId)}</span>
}

export function Section({
  title,
  description,
  actions,
  children,
  className = '',
  flush = false,
  id,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Content sits edge to edge (lists, tables) instead of padded. */
  flush?: boolean
  id?: string
}) {
  return (
    <section id={id} className={`panel min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-line">
          <div className="min-w-0">
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="text-slate-500 text-xs mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = 'default',
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'warn' | 'ok' | 'muted'
}) {
  const toneCls =
    tone === 'warn'
      ? 'text-amber-400'
      : tone === 'ok'
        ? 'text-emerald-400'
        : tone === 'muted'
          ? 'text-slate-400'
          : 'text-slate-100'
  return (
    <div className="stat-card min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className={`mt-1 font-heading text-[22px] font-light tabular-nums leading-tight ${toneCls} truncate`}>
        {value}
        {unit && <span className="text-sm text-slate-400 font-normal ml-1.5">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1 truncate">{hint}</div>}
    </div>
  )
}

export function StatRow({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
  return <div className={`grid grid-cols-2 ${grid} gap-3`}>{children}</div>
}

export function Banner({
  tone = 'info',
  title,
  children,
  icon,
  actions,
  className = '',
  role = 'status',
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok' | 'accent'
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
  role?: string
}) {
  return (
    <div className={`banner banner-${tone} ${className}`} role={role}>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 mt-3">{actions}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`panel px-6 py-12 text-center ${className}`}>
      <h3 className="font-heading text-lg font-semibold text-slate-200">{title}</h3>
      {description && <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap gap-2 justify-center">{action}</div>}
    </div>
  )
}

/** Mono address with copy + explorer actions, used in headers and detail lists. */
export function AddressChip({
  address,
  chainId,
  chars = 6,
  className = '',
  label,
}: {
  address: `0x${string}`
  chainId: number
  chars?: number
  className?: string
  label?: string
}) {
  const copy = () => {
    void navigator.clipboard.writeText(address).then(
      () => toast.success('Address copied'),
      () => toast.error('Could not copy'),
    )
  }
  const explorer = chainId !== 31337 ? getBlockExplorerAddressUrl(address, chainId) : undefined
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 ${className}`}>
      <span title={address}>{shortenAddress(address, chars)}</span>
      <button
        type="button"
        onClick={copy}
        className="text-slate-500 hover:text-slate-200 transition-colors"
        aria-label={label ? `Copy ${label}` : 'Copy address'}
      >
        <FiCopy className="w-3.5 h-3.5" aria-hidden />
      </button>
      {explorer && (
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-200 transition-colors"
          aria-label={label ? `${label} on block explorer` : 'View on block explorer'}
        >
          <FiExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      )}
    </span>
  )
}
