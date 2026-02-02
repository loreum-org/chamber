import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { FiBox, FiAlertCircle, FiCheck, FiLoader } from 'react-icons/fi'
import { useCreateChamberWithStatus } from '@/hooks'
import { useRegistryAddress } from '@/hooks/useRegistry'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function DeployChamber() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const registryAddress = useRegistryAddress()
  const queryClient = useQueryClient()
  
  // Use enhanced hook with transaction status tracking
  const {
    createChamber,
    status,
    isPending,
    isConfirming,
    error,
    hash,
    reset,
  } = useCreateChamberWithStatus(registryAddress, {
    onSuccess: () => {
      // Invalidate and refetch queries related to the registry
      // This ensures the Dashboard will show the newly created chamber
      if (registryAddress) {
        const registryAddrLower = registryAddress.toLowerCase()
        
        // Invalidate all queries that include the registry address
        // This is a broad invalidation that catches all registry-related queries
        queryClient.invalidateQueries({
          predicate: (query) => {
            try {
              const queryKey = query.queryKey
              const keyStr = JSON.stringify(queryKey).toLowerCase()
              return keyStr.includes(registryAddrLower)
            } catch (e) {
              return false
            }
          },
        })
        
        // Small delay to ensure transaction is fully processed, then refetch
        setTimeout(() => {
          queryClient.refetchQueries({
            predicate: (query) => {
              try {
                const queryKey = query.queryKey
                const keyStr = JSON.stringify(queryKey).toLowerCase()
                return keyStr.includes(registryAddrLower) && 
                       (keyStr.includes('getallchambers') || 
                        keyStr.includes('getchambercount'))
              } catch (e) {
                return false
              }
            },
          })
        }, 500)
      }
      
      // Navigate after successful deployment
      setTimeout(() => navigate('/'), 2000)
    },
    onError: (err) => {
      console.error('Chamber deployment failed:', err)
      // Reset after error so user can try again
      setTimeout(() => reset(), 3000)
    },
    successMessage: 'Chamber deployed successfully!',
    errorMessage: 'Failed to deploy chamber. Please try again.',
    showNotifications: true,
    autoReset: false, // Don't auto-reset so we can show success state
  })

  const [formData, setFormData] = useState({
    erc20Token: '',
    erc721Token: '',
    seats: '5',
    name: '',
    symbol: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.erc20Token || !formData.erc721Token || !formData.name || !formData.symbol) {
      return
    }

    const seats = parseInt(formData.seats)
    if (seats < 1 || seats > 20) {
      return
    }

    try {
      // Reset any previous transaction state
      reset()
      
      await createChamber(
        formData.erc20Token as `0x${string}`,
        formData.erc721Token as `0x${string}`,
        seats,
        formData.name,
        formData.symbol
      )
    } catch (err) {
      console.error('Failed to initiate deployment:', err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glow">
            <FiBox className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-slate-100 mb-2 tracking-tight">
            Deploy New Chamber
          </h1>
          <p className="text-slate-400">
            Create a new treasury governance instance with board-based control
          </p>
        </div>

        {/* Form */}
        <div className="panel p-8">
          {!isConnected ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <FiAlertCircle className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-slate-100 mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-slate-400 mb-6">
                Connect your wallet to deploy a new Chamber
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Chamber Name */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Chamber Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Treasury Alpha"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  The name for the chamber's share token
                </p>
              </div>

              {/* Symbol */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Symbol *
                </label>
                <input
                  type="text"
                  placeholder="e.g., ALPHA"
                  className="input"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  maxLength={10}
                  required
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  Short symbol for the share token (max 10 characters)
                </p>
              </div>

              {/* ERC20 Token */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Asset Token (ERC20) *
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="input font-mono"
                  value={formData.erc20Token}
                  onChange={(e) => setFormData({ ...formData, erc20Token: e.target.value })}
                  pattern="^0x[a-fA-F0-9]{40}$"
                  required
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  The ERC20 token that will be managed by this chamber
                </p>
              </div>

              {/* ERC721 Token */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Membership NFT (ERC721) *
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="input font-mono"
                  value={formData.erc721Token}
                  onChange={(e) => setFormData({ ...formData, erc721Token: e.target.value })}
                  pattern="^0x[a-fA-F0-9]{40}$"
                  required
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  NFT holders can become board members by receiving delegations
                </p>
              </div>

              {/* Seats */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Board Seats
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    className="flex-1 cyan-cyan-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    value={formData.seats}
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                  />
                  <div className="w-16 text-center">
                    <span className="text-2xl font-heading font-bold gradient-text">
                      {formData.seats}
                    </span>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-1.5">
                  Number of board seats (directors). Quorum will be calculated automatically.
                </p>
              </div>

              {/* Quorum Preview */}
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Calculated Quorum:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {Math.floor(parseInt(formData.seats) / 2) + 1} of {formData.seats}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-2">
                  Transactions require this many director confirmations
                </p>
              </div>

              {/* Transaction Status Display */}
              {status !== 'idle' && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${
                  status === 'error' 
                    ? 'bg-red-500/10 border border-red-500/30' 
                    : status === 'success'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-cyan-500/10 border border-cyan-500/30'
                }`}>
                  {status === 'error' ? (
                    <FiAlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : status === 'success' ? (
                    <FiCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <FiLoader className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5 animate-spin" />
                  )}
                  <div className="flex-1">
                    {status === 'error' && (
                      <>
                        <p className="text-red-400 font-medium">Deployment Error</p>
                        <p className="text-red-400/80 text-sm">
                          {error?.message || 'An error occurred during deployment'}
                        </p>
                        {hash && (
                          <p className="text-red-400/60 text-xs mt-1 font-mono">
                            Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
                          </p>
                        )}
                      </>
                    )}
                    {status === 'success' && (
                      <>
                        <p className="text-green-400 font-medium">Chamber Deployed!</p>
                        <p className="text-green-400/80 text-sm">
                          Your chamber has been successfully deployed to the blockchain.
                        </p>
                        {hash && (
                          <p className="text-green-400/60 text-xs mt-1 font-mono">
                            Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
                          </p>
                        )}
                      </>
                    )}
                    {(status === 'pending' || status === 'confirming') && (
                      <>
                        <p className="text-cyan-400 font-medium">
                          {status === 'pending' ? 'Waiting for Wallet Confirmation...' : 'Transaction Confirming...'}
                        </p>
                        <p className="text-cyan-400/80 text-sm">
                          {status === 'pending' 
                            ? 'Please confirm the transaction in your wallet.'
                            : 'Waiting for blockchain confirmation. This may take a few moments.'}
                        </p>
                        {hash && (
                          <p className="text-cyan-400/60 text-xs mt-1 font-mono">
                            Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || isConfirming || status === 'success'}
                className="btn btn-primary w-full py-3.5 text-base"
              >
                {isPending || isConfirming ? (
                  <>
                    <FiLoader className="w-5 h-5 animate-spin" />
                    {status === 'pending' ? 'Confirm in Wallet...' : 'Deploying...'}
                  </>
                ) : status === 'success' ? (
                  <>
                    <FiCheck className="w-5 h-5" />
                    Chamber Deployed!
                  </>
                ) : (
                  <>
                    <FiBox className="w-5 h-5" />
                    Deploy Chamber
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h4 className="font-heading font-semibold text-slate-100 mb-2">What is a Chamber?</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              A Chamber is a smart vault that combines ERC4626 tokenized treasury with 
              board-based governance. NFT holders can receive delegations to compete 
              for board seats and control transactions.
            </p>
          </div>
          <div className="card">
            <h4 className="font-heading font-semibold text-slate-100 mb-2">How does voting work?</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Share holders delegate voting power to NFT token IDs. The top delegated 
              NFTs become board directors and can submit, confirm, and execute 
              transactions once quorum is reached.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
