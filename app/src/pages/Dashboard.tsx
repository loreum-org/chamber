import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { FiArrowRight, FiUsers, FiLayers, FiShield, FiPlus, FiBox, FiAlertTriangle } from 'react-icons/fi'
import { useAllChambers, useChamberCount, useHasValidConfig } from '@/hooks'
import ChamberCard from '@/components/ChamberCard'

export default function Dashboard() {
  const { isConnected } = useAccount()
  const location = useLocation()
  const { chambers, isLoading, refetch: refetchChambers, error: chambersError } = useAllChambers()
  const { count: chamberCount, refetch: refetchCount, isLoading: countLoading, error: countError, registryAddress } = useChamberCount()
  const { isValid, chainId } = useHasValidConfig()

  // Debug logging
  useEffect(() => {
    console.log('Dashboard Debug:', {
      chamberCount,
      chambersCount: chambers?.length,
      isLoading,
      countLoading,
      chambersError,
      countError,
      registryAddress,
      isValid,
      chainId,
    })
  }, [chamberCount, chambers, isLoading, countLoading, chambersError, countError, registryAddress, isValid, chainId])

  // Refetch chambers when navigating to the dashboard
  // This ensures newly created chambers appear immediately
  useEffect(() => {
    if (location.pathname === '/') {
      refetchChambers()
      refetchCount()
    }
  }, [location.pathname, refetchChambers, refetchCount])

  const getNetworkName = (id: number) => {
    switch (id) {
      case 1: return 'Mainnet'
      case 11155111: return 'Sepolia'
      case 31337: return 'Localhost'
      default: return `Chain ${id}`
    }
  }

  return (
    <div className="space-y-10">
      {/* Configuration Warning */}
      {!isValid && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-4 border-amber-500/30 bg-amber-500/5"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-400 mb-1">Contract Addresses Not Configured</h4>
              <p className="text-slate-400 text-sm">
                No Registry contract address configured for <strong>{getNetworkName(chainId)}</strong> (Chain ID: {chainId}).
                {chainId === 31337 ? (
                  <>
                    {' '}Deploy contracts to Anvil and update your <code className="text-cyan-400">.env</code> file:
                    <code className="block mt-2 p-2 bg-slate-800/50 rounded text-xs">
                      VITE_LOCALHOST_REGISTRY=0x...your_registry_address
                    </code>
                  </>
                ) : (
                  <> Update your <code className="text-cyan-400">.env</code> file with the contract addresses.</>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Debug Info - Remove in production */}
      {(countError || chambersError || !isValid) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-4 border-slate-700/50 bg-slate-800/30"
        >
          <div className="text-xs font-mono text-slate-400 space-y-1">
            <div><strong>Chain ID:</strong> {chainId} ({getNetworkName(chainId)})</div>
            <div><strong>Registry Address:</strong> {registryAddress || 'Not set'}</div>
            <div><strong>Config Valid:</strong> {isValid ? 'Yes' : 'No'}</div>
            <div><strong>Chamber Count Loading:</strong> {countLoading ? 'Yes' : 'No'}</div>
            <div><strong>Chambers Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
            {countError && <div className="text-red-400"><strong>Count Error:</strong> {countError.message}</div>}
            {chambersError && <div className="text-red-400"><strong>Chambers Error:</strong> {chambersError.message}</div>}
            <div><strong>Chamber Count:</strong> {chamberCount}</div>
            <div><strong>Chambers Array Length:</strong> {chambers?.length ?? 'undefined'}</div>
          </div>
        </motion.div>
      )}

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden panel p-8 md:p-10"
      >
        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-mesh-gradient pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-glow">
              <FiBox className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">Treasury Governance</p>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-100 tracking-tight">
                Chamber Protocol
              </h1>
            </div>
          </div>
          
          <p className="text-slate-400 text-lg mb-8 leading-relaxed max-w-2xl">
            A decentralized smart vault system combining ERC4626 treasury management with 
            board-based governance. Delegate voting power to NFT holders and execute 
            transactions through secure multi-signature mechanisms.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/deploy" className="btn btn-primary">
              <FiPlus className="w-4 h-4" />
              Deploy Chamber
            </Link>
            <a href="#chambers" className="btn btn-secondary">
              <FiLayers className="w-4 h-4" />
              View Chambers
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-10 pt-8 border-t border-slate-700/30">
          <div>
            <div className="text-3xl font-heading font-bold gradient-text">
              {countLoading ? '...' : chamberCount}
            </div>
            <div className="text-slate-500 text-sm mt-1">Active Chambers</div>
            {countError && (
              <div className="text-red-400 text-xs mt-1">
                Error: {countError.message}
              </div>
            )}
            {!isValid && (
              <div className="text-amber-400 text-xs mt-1">
                Registry not configured
              </div>
            )}
          </div>
          <div className="border-l border-slate-700/30 pl-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-xl font-heading font-semibold text-slate-100">
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="text-slate-500 text-sm mt-1">Wallet Status</div>
          </div>
          <div className="border-l border-slate-700/30 pl-6">
            <div className="text-3xl font-heading font-bold gradient-text">v1.1.3</div>
            <div className="text-slate-500 text-sm mt-1">Protocol Version</div>
          </div>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card group"
        >
          <div className="icon-container-emerald mb-4">
            <FiLayers className="w-5 h-5" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-slate-100 mb-2">ERC4626 Vault</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Standard tokenized vault for managing treasury assets with share-based accounting.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card group"
        >
          <div className="icon-container-accent mb-4">
            <FiUsers className="w-5 h-5" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-slate-100 mb-2">Board Governance</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Delegate voting power to NFT holders who compete for board seats based on stake.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card group"
        >
          <div className="icon-container-violet mb-4">
            <FiShield className="w-5 h-5" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-slate-100 mb-2">Multi-Sig Wallet</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Execute transactions with quorum-based approval from board directors.
          </p>
        </motion.div>
      </div>

      {/* Chambers List */}
      <section id="chambers" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Chambers</h2>
            <p className="text-slate-500 text-sm mt-1">Active treasury governance instances</p>
          </div>
          <Link to="/deploy" className="btn btn-secondary text-sm">
            <FiPlus className="w-4 h-4" />
            New Chamber
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-5 bg-slate-800 rounded-lg w-1/3 mb-4" />
                <div className="h-4 bg-slate-800 rounded-lg w-full mb-2" />
                <div className="h-4 bg-slate-800 rounded-lg w-2/3" />
              </div>
            ))}
          </div>
        ) : chambers && chambers.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {chambers
              .filter((address) => 
                address && 
                address !== '0x0000000000000000000000000000000000000000' &&
                address.startsWith('0x') &&
                address.length === 42
              )
              .map((address, index) => (
                <motion.div
                  key={address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ChamberCard address={address as `0x${string}`} />
                </motion.div>
              ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="panel p-12 text-center"
          >
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <FiLayers className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-slate-300 mb-2">No Chambers Yet</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Deploy your first Chamber to start managing treasury assets with board governance.
            </p>
            <Link to="/deploy" className="btn btn-primary inline-flex">
              <FiPlus className="w-4 h-4" />
              Deploy Chamber
              <FiArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </section>
    </div>
  )
}
