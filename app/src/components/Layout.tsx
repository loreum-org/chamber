import { Outlet, Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'
import { FiHome, FiGithub, FiBook, FiCpu, FiPlus } from 'react-icons/fi'
import { useAccount, useWriteContract } from 'wagmi'
import { getContractAddresses } from '@/lib/wagmi'
import { erc721Abi } from '@/contracts'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/', label: 'Chambers', icon: FiHome },
  { path: '/deploy', label: 'Deploy Chamber', icon: FiPlus },
  { path: '/deploy-agent', label: 'Deploy Agent', icon: FiCpu },
  { path: '/docs', label: 'Docs', icon: FiBook },
]

export default function Layout() {
  const location = useLocation()
  const { chainId, address } = useAccount()
  const { writeContract, isPending } = useWriteContract()

  const handleMintLocal = () => {
    if (!address || chainId !== 31337) return
    const addresses = getContractAddresses(chainId)
    if (!addresses.mockERC721) return
    
    writeContract({
      address: addresses.mockERC721 as `0x${string}`,
      abi: erc721Abi,
      functionName: 'mint',
      args: [address],
    }, {
      onSuccess: () => toast.success('Test NFT minted successfully!'),
      onError: (err) => toast.error('Failed to mint: ' + err.message)
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img src="https://cdn.loreum.org/logos/white.svg" alt="Chamber Logo" className="w-10 h-10 object-contain transition-all" />
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
              {chainId === 31337 && address && (
                <button 
                  onClick={handleMintLocal} 
                  disabled={isPending} 
                  className="hidden md:block text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors whitespace-nowrap"
                >
                  {isPending ? 'Minting...' : 'Mint Test NFT'}
                </button>
              )}
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
      <footer className="border-t border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <img src="https://cdn.loreum.org/logos/white.svg" alt="Chamber Logo" className="w-6 h-6 object-contain opacity-80" />
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
