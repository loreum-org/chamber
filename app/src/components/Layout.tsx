import { Outlet, Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'
import { FiHome, FiPlus, FiGithub, FiBook } from 'react-icons/fi'

const navItems = [
  { path: '/', label: 'Chambers', icon: FiHome },
  { path: '/deploy', label: 'Deploy', icon: FiPlus },
  { path: '/docs', label: 'Docs', icon: FiBook },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img src="/logo.svg" alt="Chamber Logo" className="w-10 h-10 object-contain transition-all" />
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-sm font-medium ${
                      isActive
                        ? 'text-cyan-400'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 border border-cyan-500/30 rounded-xl bg-cyan-500/5"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Connect Button */}
            <div className="flex items-center gap-4">
              <ConnectButton 
                chainStatus="icon"
                showBalance={false}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <img src="/logo.svg" alt="Chamber Logo" className="w-6 h-6 object-contain opacity-80" />
              <span className="font-medium">Chamber Protocol</span>
              <span className="text-slate-700">|</span>
              <span>Decentralized Treasury Governance</span>
            </div>
            <div className="flex items-center gap-6 text-slate-500 text-sm">
              <a 
                href="https://github.com/loreum-org/chamber" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
              >
                <FiGithub className="w-4 h-4" />
                GitHub
              </a>
              <Link to="/docs" className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                <FiBook className="w-4 h-4" />
                Docs
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
