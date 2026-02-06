import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { FiAlertCircle, FiCheck, FiLoader, FiCpu } from 'react-icons/fi'
import { useCreateAgentWithStatus } from '@/hooks'
import { useRegistryAddress } from '@/hooks/useRegistry'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function DeployAgent() {
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  const registryAddress = useRegistryAddress()
  const queryClient = useQueryClient()
  
  const {
    createAgent,
    status,
    isPending,
    isConfirming,
    error,
    hash,
    reset,
  } = useCreateAgentWithStatus(registryAddress, {
    onSuccess: () => {
      // Invalidate queries if needed
       if (registryAddress) {
        queryClient.invalidateQueries({
          predicate: (_query) => {
             // Should match agent related queries
             return true
          },
        })
      }
      // Navigate after successful deployment
      setTimeout(() => navigate('/'), 2000)
    },
    onError: (err) => {
      console.error('Agent deployment failed:', err)
      setTimeout(() => reset(), 3000)
    },
    successMessage: 'Agent deployed successfully!',
    errorMessage: 'Failed to deploy agent.',
    showNotifications: true,
  })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model: 'gpt-4o', // Default model
    policyAddress: '', // Optional: if empty, maybe use a default or address(0)
    metadataURI: '', // Or we generate this from name/desc/model
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.description) {
      return
    }

    // Construct metadata URI (mock for now, ideally upload to IPFS)
    // For ERC-8004, this should be a JSON file.
    const metadata = {
        name: formData.name,
        description: formData.description,
        model: formData.model,
        // supportedInterfaces: ['A2A', 'MCP']
    }
    const metadataURI = `data:application/json;base64,${btoa(JSON.stringify(metadata))}`

    try {
      reset()
      
      if (!address) return;

      await createAgent(
        address, // Owner is current user
        (formData.policyAddress as `0x${string}`) || '0x0000000000000000000000000000000000000000',
        metadataURI
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
          <div className="w-20 h-20 bg-space-800 rounded-full flex items-center justify-center mx-auto mb-5 border border-white/10">
            <FiCpu className="w-10 h-10 text-space-accent" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-slate-100 mb-2 tracking-tight">
            Deploy Autonomous Agent
          </h1>
          <p className="text-slate-400">
            Launch an ERC-8004 compliant agent with on-chain identity
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
                Connect your wallet to deploy a new Agent
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent Name */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Treasury Manager Bot"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Description *
                </label>
                <textarea
                  placeholder="Describe the agent's role and capabilities..."
                  className="input min-h-[100px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  AI Model
                </label>
                <select
                  className="input"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="llama-3-70b">Llama 3 (70B)</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="custom">Custom / Other</option>
                </select>
              </div>

              {/* Policy Address */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Policy Contract (Optional)
                </label>
                <input
                  type="text"
                  placeholder="0x... (Leave empty for no initial policy)"
                  className="input font-mono"
                  value={formData.policyAddress}
                  onChange={(e) => setFormData({ ...formData, policyAddress: e.target.value })}
                  pattern="^0x[a-fA-F0-9]{40}$"
                />
                <p className="text-slate-500 text-xs mt-1.5">
                  The smart contract that defines what this agent allows/rejects
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
                        <p className="text-green-400 font-medium">Agent Deployed!</p>
                        <p className="text-green-400/80 text-sm">
                          Your agent has been successfully registered on the blockchain.
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
                            : 'Waiting for blockchain confirmation...'}
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
                    Agent Deployed!
                  </>
                ) : (
                  <>
                    <FiCpu className="w-5 h-5" />
                    Deploy Agent
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h4 className="font-heading font-semibold text-slate-100 mb-2">ERC-8004 Identity</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every agent receives a unique Identity NFT. This allows the agent to build reputation, 
              receive credentials, and be verified by external auditors.
            </p>
          </div>
          <div className="card">
            <h4 className="font-heading font-semibold text-slate-100 mb-2">Trustless Coordination</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Agents can join Chambers, propose transactions, and vote on governance proposals 
              based on their programmed policies and identity verification.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
