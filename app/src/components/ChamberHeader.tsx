import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import { AddressChip, Tabs } from '@/components/ui'

import { chamberTabHref, type ChamberTab } from '@/lib/chamberTabs'

export type { ChamberTab }

/**
 * The one chamber header. Overview, Board, Treasury, Delegation and Proposals
 * all render under it, so moving between them never changes the frame.
 */
export function ChamberHeader({
  chamberAddress,
  chainId,
  name,
  symbol,
  versionTag,
  seats,
  quorum,
  activeTab,
  proposalCount,
  actions,
  children,
}: {
  chamberAddress: `0x${string}`
  chainId: number
  name?: string
  symbol?: string
  versionTag?: string
  seats?: number
  quorum?: number
  activeTab: ChamberTab
  proposalCount?: number
  actions?: ReactNode
  /** Status lines (who you act as, pending tx) rendered between the title and the tabs. */
  children?: ReactNode
}) {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', to: chamberTabHref(chamberAddress, 'overview') },
    { id: 'board' as const, label: 'Board', to: chamberTabHref(chamberAddress, 'board') },
    { id: 'staking' as const, label: 'Treasury', to: chamberTabHref(chamberAddress, 'staking') },
    { id: 'delegation' as const, label: 'Delegation', to: chamberTabHref(chamberAddress, 'delegation') },
    {
      id: 'proposals' as const,
      label: 'Proposals',
      to: chamberTabHref(chamberAddress, 'proposals'),
      count: proposalCount,
    },
  ]

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors"
      >
        <FiArrowLeft className="w-3.5 h-3.5" aria-hidden />
        My chambers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">{name || 'Loading…'}</h1>
            {symbol && <span className="badge badge-primary">{symbol}</span>}
            {versionTag && versionTag !== '…' && (
              <span className="badge font-mono tabular-nums" title="Chamber implementation version">
                {versionTag}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <AddressChip address={chamberAddress} chainId={chainId} chars={6} label="chamber address" />
            {seats !== undefined && quorum !== undefined && (
              <span className="tabular-nums">
                {seats} seats · quorum {quorum} of {seats}
              </span>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {children}

      <Tabs items={tabs} active={activeTab} ariaLabel="Chamber sections" />
    </div>
  )
}
