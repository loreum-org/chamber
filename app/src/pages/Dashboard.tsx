import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, usePublicClient, useChainId, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { multicall } from 'viem/actions'
import { useQuery } from '@tanstack/react-query'
import { FiLayers, FiPlus, FiAlertTriangle, FiGrid, FiBriefcase, FiShield, FiUser } from 'react-icons/fi'
import { useAllChambers, useChamberCount, useHasValidConfig, useOrganizationsByNFT } from '@/hooks'
import { erc721Abi } from '@/contracts'
import { chamberAbi } from '@/contracts/abis'
import ChamberCard from '@/components/ChamberCard'

export default function Dashboard() {
  const { isConnected, address: userAddress } = useAccount()
  const location = useLocation()
  const chainId = useChainId()
  const [viewMode, setViewMode] = useState<'all' | 'organizations'>('all')

  const { chambers, isLoading, refetch: refetchChambers, error: chambersError } = useAllChambers()
  const { count: chamberCount, refetch: refetchCount, isLoading: countLoading, error: countError, registryAddress } = useChamberCount()
  const { organizations, isLoading: orgsLoading } = useOrganizationsByNFT()
  const { isValid } = useHasValidConfig()

  // Refetch when navigating to dashboard so newly created chambers appear immediately
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

  const validChambers = chambers || []

  const publicClient = usePublicClient()
  const participationQuery = useQuery({
    queryKey: ['dashboard-chamber-participation', chainId, userAddress, validChambers.join()],
    enabled: !!publicClient && !!userAddress && validChambers.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      if (!publicClient || !userAddress) throw new Error('Missing client or account')
      const directorReads = validChambers.map((address) => ({
        address,
        abi: chamberAbi,
        functionName: 'getDirectors' as const,
      }))
      const balanceReads = validChambers.map((address) => ({
        address,
        abi: chamberAbi,
        functionName: 'balanceOf' as const,
        args: [userAddress] as const,
      }))
      const [dirs, bals] = await Promise.all([
        multicall(publicClient, { contracts: directorReads, allowFailure: true }),
        multicall(publicClient, { contracts: balanceReads, allowFailure: true }),
      ])
      return { dirs, bals }
    },
  })

  const allDirectors = participationQuery.data?.dirs.map((r) =>
    r.status === 'success'
      ? ({ status: 'success' as const, result: r.result })
      : ({ status: 'failure' as const }),
  )
  const allBalances = participationQuery.data?.bals.map((r) =>
    r.status === 'success'
      ? ({ status: 'success' as const, result: r.result })
      : ({ status: 'failure' as const }),
  )

  const myChambers = validChambers.filter((_addr, i) => {
    const dirs = allDirectors?.[i]?.result as `0x${string}`[] | undefined
    const bal = allBalances?.[i]?.result as bigint | undefined
    const isDirector = dirs?.some((d) => d.toLowerCase() === userAddress?.toLowerCase())
    const hasBalance = bal !== undefined && bal > 0n
    return isDirector || hasBalance
  })

  const myChambersReady =
    !!userAddress && validChambers.length > 0 && participationQuery.isSuccess && participationQuery.data !== undefined

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
                    {' '}Deploy contracts to Anvil and update your <code className="text-accent-400">.env</code> file:
                    <code className="block mt-2 p-2 bg-slate-800/50 rounded text-xs">
                      VITE_LOCALHOST_REGISTRY=0x...your_registry_address
                    </code>
                  </>
                ) : (
                  <> Update your <code className="text-accent-400">.env</code> file with the contract addresses.</>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dev debug info – only shown when there are errors */}
      {import.meta.env.DEV && (countError || chambersError || !isValid) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-4 border-slate-700/50 bg-slate-800/30"
        >
          <div className="text-xs font-mono text-slate-400 space-y-1">
            <div><strong>Chain ID:</strong> {chainId} ({getNetworkName(chainId)})</div>
            <div><strong>Registry Address:</strong> {registryAddress || 'Not set'}</div>
            <div><strong>Config Valid:</strong> {isValid ? 'Yes' : 'No'}</div>
            {countError && <div className="text-red-400"><strong>Count Error:</strong> {countError.message}</div>}
            {chambersError && <div className="text-red-400"><strong>Chambers Error:</strong> {chambersError.message}</div>}
            <div><strong>Chamber Count:</strong> {chamberCount}</div>
            <div><strong>Chambers Array Length:</strong> {validChambers.length}</div>
          </div>
        </motion.div>
      )}

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden panel p-8 md:p-10"
      >
        <div className="absolute inset-0 bg-mesh-gradient pointer-events-none opacity-[0.85]" />
        <div className="absolute top-0 right-0 w-[480px] h-[420px] bg-gradient-radial from-accent-600/[0.07] via-transparent to-transparent pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <img src="https://cdn.loreum.org/logos/white.svg" alt="Chamber Logo" className="w-20 h-20 object-contain" />
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Governance</p>
                <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-100 tracking-tight">
                  Loreum Chambers
                </h1>
              </div>
            </div>

            <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">
              Rules-bound governance for organizations. Chambers combine vault custody with an elected board of directors who oversee fiduciary operations and approve transactions through configurable quorum and timelocked controls.
            </p>
          </div>

          <div className="flex flex-col gap-6 md:min-w-[200px] md:pt-2">
            <div>
              <div className="text-3xl font-heading font-bold gradient-text">
                {countLoading ? '...' : validChambers.length}
              </div>
              <div className="text-slate-500 text-sm mt-1">Active Chambers</div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <span className="text-xl font-heading font-semibold text-slate-100">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="text-slate-500 text-sm mt-1">Wallet Status</div>
            </div>
            <div>
              <div className="text-3xl font-heading font-bold gradient-text">v1.1.3</div>
              <div className="text-slate-500 text-sm mt-1">Protocol Version</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* My Participation — only when connected and has involvement */}
      {isConnected && userAddress && myChambersReady && myChambers.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <FiUser className="w-4 h-4 text-accent-400" />
            <h2 className="font-heading text-lg font-semibold text-slate-100">Your Participation</h2>
            <span className="badge badge-primary">{myChambers.length}</span>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
            {myChambers.map((addr) => {
              const idx = validChambers.indexOf(addr)
              const dirs = allDirectors?.[idx]?.result as `0x${string}`[] | undefined
              const bal = allBalances?.[idx]?.result as bigint | undefined
              const isDirector = dirs?.some((d) => d.toLowerCase() === userAddress.toLowerCase())
              return (
                <div key={addr} className="relative">
                  {isDirector && (
                    <div className="absolute -top-2 -left-2 z-10">
                      <span className="badge bg-accent-600/80 text-white border-accent-500/40 text-[10px]">
                        <FiShield className="w-3 h-3 mr-1" />
                        Director
                      </span>
                    </div>
                  )}
                  {bal !== undefined && bal > 0n && !isDirector && (
                    <div className="absolute -top-2 -left-2 z-10">
                      <span className="badge bg-slate-700 text-slate-300 border-slate-600 text-[10px]">
                        {parseFloat(formatUnits(bal, 18)).toFixed(2)} shares
                      </span>
                    </div>
                  )}
                  <ChamberCard address={addr as `0x${string}`} />
                </div>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* Chambers List */}
      <section id="chambers" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-100">Registry</h2>
            <p className="text-slate-500 text-sm mt-1">Active governance instances</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'all' ? 'bg-accent-500/10 text-accent-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FiGrid className="w-4 h-4" />
                All
              </button>
              <button
                onClick={() => setViewMode('organizations')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'organizations' ? 'bg-accent-500/10 text-accent-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FiBriefcase className="w-4 h-4" />
                Organizations
              </button>
            </div>

            <Link to="/deploy" className="btn btn-primary text-sm">
              <FiPlus className="w-4 h-4" />
              New Chamber
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'all' ? (
            <motion.div
              key="all-chambers"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card animate-pulse">
                      <div className="h-5 bg-slate-800 rounded-lg w-1/3 mb-4" />
                      <div className="h-4 bg-slate-800 rounded-lg w-full mb-2" />
                      <div className="h-4 bg-slate-800 rounded-lg w-2/3" />
                    </div>
                  ))}
                </div>
              ) : validChambers.length > 0 ? (
                <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
                  {validChambers.map((address, index) => (
                    <motion.div
                      key={address}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ChamberCard address={address as `0x${string}`} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyChambers />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="org-chambers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {orgsLoading ? (
                <div className="space-y-8">
                  {[1, 2].map(i => (
                    <div key={i} className="space-y-4">
                      <div className="h-8 bg-slate-800 rounded-lg w-1/4 animate-pulse" />
                      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
                        {[1, 2].map(j => (
                          <div key={j} className="card h-40 animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : organizations && organizations.length > 0 ? (
                organizations.map((org, index) => (
                  <OrganizationGroup key={org.nft} nftToken={org.nft} chambers={org.chambers} index={index} />
                ))
              ) : (
                <EmptyChambers />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}

function OrganizationGroup({ nftToken, chambers, index }: { nftToken: `0x${string}`; chambers: `0x${string}`[]; index: number }) {
  const { data: symbol } = useReadContracts({
    contracts: [
      { address: nftToken, abi: erc721Abi, functionName: 'symbol' as const },
      { address: nftToken, abi: erc721Abi, functionName: 'name' as const },
    ],
  })

  const nftSymbol = symbol?.[0]?.result as string | undefined
  const nftName = symbol?.[1]?.result as string | undefined
  const shortNft = `${nftToken.slice(0, 8)}…${nftToken.slice(-6)}`

  if (!chambers || chambers.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-lg bg-slate-800/90 flex items-center justify-center border border-slate-600/45">
          <FiBriefcase className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold text-slate-100 flex items-center gap-2">
            {nftName || 'Loading...'}
            {nftSymbol && <span className="text-slate-500 text-sm font-normal">({nftSymbol})</span>}
          </h3>
          <p className="text-slate-500 text-xs font-mono">
            Member Token: {shortNft}
          </p>
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
        {chambers.map((address) => (
          <ChamberCard key={address} address={address} />
        ))}
      </div>
    </motion.div>
  )
}

function EmptyChambers() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="panel p-12 text-center"
    >
      <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <FiLayers className="w-8 h-8 text-slate-600" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-slate-300 mb-2">No Chambers Yet</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-6">
        No Chambers have been deployed yet. Deploy the first one to get started.
      </p>
      <Link to="/deploy" className="btn btn-primary inline-flex">
        <FiPlus className="w-4 h-4" />
        Deploy Your First Chamber
      </Link>
    </motion.div>
  )
}
