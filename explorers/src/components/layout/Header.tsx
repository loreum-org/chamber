import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { mainnet, sepolia } from '@/wagmi'
import { NetworkChip, type NetworkChipState } from '../ui'

function getNetworkChipProps(chainId: number, chainName: string): { state: NetworkChipState; label: string } {
  if (chainId === mainnet.id) {
    return { state: 'supported', label: chainName }
  }
  if (chainId === sepolia.id) {
    return { state: 'test', label: `Test network · ${chainName}` }
  }
  return { state: 'unsupported', label: chainName }
}

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/claim', label: 'Claim', end: false },
  { to: '/gallery', label: 'My Explorers', end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `nav-link ${isActive ? 'nav-link-active' : ''}`
}

export function Header() {
  const { chain } = useAccount()
  const chainId = chain?.id ?? mainnet.id
  const chainName = chain?.name ?? 'Ethereum'
  const { state, label } = getNetworkChipProps(chainId, chainName)

  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <NavLink to="/" className="flex items-center gap-2.5">
          <img
            src="https://cdn.loreum.org/logos/white.svg"
            alt="Loreum"
            className="h-8 w-8"
          />
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-semibold tracking-tight text-slate-100">
              Explorers
            </span>
            <span className="hidden text-xs font-medium text-slate-500 sm:inline">by Loreum</span>
          </span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            <NetworkChip state={state} label={label} />
          </span>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] text-slate-300 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M4 7h16" strokeLinecap="round" />
                  <path d="M4 12h16" strokeLinecap="round" />
                  <path d="M4 17h16" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav className="border-t border-white/[0.06] bg-void/95 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                    isActive ? 'bg-white/[0.05] text-slate-100' : 'text-slate-400 hover:text-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="px-3 py-3 sm:hidden">
              <NetworkChip state={state} label={label} />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
