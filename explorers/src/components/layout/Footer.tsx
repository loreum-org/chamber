import { NavLink } from 'react-router-dom'

const INTERNAL = [
  { to: '/', label: 'Home', end: true },
  { to: '/claim', label: 'Claim', end: false },
  { to: '/gallery', label: 'My Explorers', end: false },
]

const EXTERNAL = [
  { href: 'https://loreum.org', label: 'loreum.org' },
  { href: 'https://github.com/loreum-org', label: 'GitHub' },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[0.06] bg-void-900/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <img
                src="https://cdn.loreum.org/logos/white.svg"
                alt="Loreum"
                className="h-8 w-8"
              />
              <span className="font-display text-lg font-semibold tracking-tight text-slate-100">
                Explorers
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              A public, on-chain NFT collection by Loreum. Art on IPFS, claimable
              directly from the contract.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <div>
              <div className="eyebrow !text-slate-500">Explore</div>
              <ul className="mt-4 space-y-3">
                {INTERNAL.map((l) => (
                  <li key={l.to}>
                    <NavLink
                      to={l.to}
                      end={l.end}
                      className="text-sm text-slate-400 transition-colors hover:text-accent-300"
                    >
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow !text-slate-500">Loreum</div>
              <ul className="mt-4 space-y-3">
                {EXTERNAL.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-400 transition-colors hover:text-accent-300"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/[0.05] pt-6">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Loreum DAO LLC. On-chain governance infrastructure.
          </p>
        </div>
      </div>
    </footer>
  )
}
