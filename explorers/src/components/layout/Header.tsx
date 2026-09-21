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
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const connected = mounted && account && chain

              return (
                <div
                  {...(!connected && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-accent-600/30 bg-accent-600 px-4 text-sm font-medium text-white transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                        >
                          Connect
                        </button>
                      )
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-700/30 bg-red-950/40 px-4 text-sm font-medium text-red-400 transition-colors hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                        >
                          Wrong network
                        </button>
                      )
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              className="h-5 w-5 rounded-full"
                            />
                          )}
                        </button>
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                        >
                          {account.ensName ?? account.displayName}
                          {account.displayBalance && (
                            <span className="text-xs text-slate-400">
                              ({account.displayBalance})
                            </span>
                          )}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            }}
          </ConnectButton.Custom>
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
