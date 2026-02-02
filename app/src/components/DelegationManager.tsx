import { useState } from 'react'
import { motion } from 'framer-motion'
import { formatUnits, parseUnits } from 'viem'
import {
  FiSend,
  FiArrowRight,
  FiArrowLeft,
  FiUser,
  FiLoader,
  FiInfo,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useDelegate, useUndelegate } from '@/hooks'
import type { BoardMember } from '@/types'

interface DelegationManagerProps {
  chamberAddress: `0x${string}`
  userBalance: bigint | undefined
  delegations: { tokenId: bigint; amount: bigint }[]
  members: BoardMember[]
}

export default function DelegationManager({
  chamberAddress,
  userBalance,
  delegations,
  members,
}: DelegationManagerProps) {
  const [delegateTokenId, setDelegateTokenId] = useState('')
  const [delegateAmount, setDelegateAmount] = useState('')
  const [undelegateTokenId, setUndelegateTokenId] = useState('')
  const [undelegateAmount, setUndelegateAmount] = useState('')

  const { delegate, isPending: isDelegating, isConfirming: isDelegateConfirming } = useDelegate(chamberAddress)
  const { undelegate, isPending: isUndelegating, isConfirming: isUndelegateConfirming } = useUndelegate(chamberAddress)

  const totalDelegated = delegations.reduce((sum, d) => sum + d.amount, 0n)
  const availableBalance = userBalance ? userBalance - totalDelegated : 0n

  const handleDelegate = async () => {
    if (!delegateTokenId || !delegateAmount) return
    try {
      await delegate(BigInt(delegateTokenId), parseUnits(delegateAmount, 18))
      toast.success('Delegation submitted!')
      setDelegateTokenId('')
      setDelegateAmount('')
    } catch (err) {
      console.error(err)
      toast.error('Delegation failed')
    }
  }

  const handleUndelegate = async () => {
    if (!undelegateTokenId || !undelegateAmount) return
    try {
      await undelegate(BigInt(undelegateTokenId), parseUnits(undelegateAmount, 18))
      toast.success('Undelegation submitted!')
      setUndelegateTokenId('')
      setUndelegateAmount('')
    } catch (err) {
      console.error(err)
      toast.error('Undelegation failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-5"
        >
          <div className="text-slate-500 text-xs mb-1.5">Total Balance</div>
          <div className="font-heading text-xl font-bold text-slate-100">
            {userBalance !== undefined
              ? parseFloat(formatUnits(userBalance, 18)).toFixed(4)
              : '0.0000'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel p-5"
        >
          <div className="text-slate-500 text-xs mb-1.5">Delegated</div>
          <div className="font-heading text-xl font-bold gradient-text">
            {parseFloat(formatUnits(totalDelegated, 18)).toFixed(4)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel p-5"
        >
          <div className="text-slate-500 text-xs mb-1.5">Available</div>
          <div className="font-heading text-xl font-bold text-emerald-400">
            {parseFloat(formatUnits(availableBalance, 18)).toFixed(4)}
          </div>
        </motion.div>
      </div>

      {/* Delegate / Undelegate */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Delegate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-container-accent">
              <FiArrowRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-slate-100">Delegate</h3>
              <p className="text-slate-500 text-xs">Give voting power to an NFT</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                NFT Token ID
              </label>
              <input
                type="number"
                placeholder="Enter token ID"
                className="input"
                value={delegateTokenId}
                onChange={(e) => setDelegateTokenId(e.target.value)}
                min="1"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Amount to Delegate
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="input pr-20"
                  value={delegateAmount}
                  onChange={(e) => setDelegateAmount(e.target.value)}
                  min="0"
                  step="any"
                />
                <button
                  onClick={() => setDelegateAmount(formatUnits(availableBalance, 18))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            <button
              onClick={handleDelegate}
              disabled={isDelegating || isDelegateConfirming || !delegateTokenId || !delegateAmount}
              className="btn btn-primary w-full"
            >
              {isDelegating || isDelegateConfirming ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  {isDelegating ? 'Confirm...' : 'Processing...'}
                </>
              ) : (
                <>
                  <FiSend className="w-4 h-4" />
                  Delegate
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Undelegate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-container bg-red-500/15 text-red-400">
              <FiArrowLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-slate-100">Undelegate</h3>
              <p className="text-slate-500 text-xs">Reclaim voting power</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                NFT Token ID
              </label>
              <select
                className="input"
                value={undelegateTokenId}
                onChange={(e) => setUndelegateTokenId(e.target.value)}
              >
                <option value="">Select delegated NFT...</option>
                {delegations.map((d) => (
                  <option key={d.tokenId.toString()} value={d.tokenId.toString()}>
                    #{d.tokenId.toString()} - {parseFloat(formatUnits(d.amount, 18)).toFixed(4)} delegated
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Amount to Undelegate
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="input pr-20"
                  value={undelegateAmount}
                  onChange={(e) => setUndelegateAmount(e.target.value)}
                  min="0"
                  step="any"
                />
                <button
                  onClick={() => {
                    const del = delegations.find(d => d.tokenId.toString() === undelegateTokenId)
                    if (del) setUndelegateAmount(formatUnits(del.amount, 18))
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            <button
              onClick={handleUndelegate}
              disabled={isUndelegating || isUndelegateConfirming || !undelegateTokenId || !undelegateAmount}
              className="btn btn-secondary w-full border-red-500/30 hover:border-red-500/50 hover:text-red-400"
            >
              {isUndelegating || isUndelegateConfirming ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  {isUndelegating ? 'Confirm...' : 'Processing...'}
                </>
              ) : (
                <>
                  <FiArrowLeft className="w-4 h-4" />
                  Undelegate
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Current Delegations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="panel"
      >
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold text-slate-100">Your Delegations</h3>
            <p className="text-slate-500 text-xs mt-0.5">NFTs you've delegated voting power to</p>
          </div>
          <span className="badge badge-primary">{delegations.length} active</span>
        </div>

        {delegations.length > 0 ? (
          <div className="divide-y divide-slate-700/30">
            {delegations.map((delegation) => {
              const member = members.find(m => m.tokenId === delegation.tokenId)
              return (
                <div key={delegation.tokenId.toString()} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-cyan-500/15 rounded-xl flex items-center justify-center">
                    <FiUser className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-slate-100">
                      Token #{delegation.tokenId.toString()}
                    </div>
                    {member && member.rank && member.rank <= 5 && (
                      <span className="badge badge-primary text-[10px] mt-1">
                        Rank #{member.rank}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-slate-100">
                      {parseFloat(formatUnits(delegation.amount, 18)).toFixed(4)}
                    </div>
                    <div className="text-slate-500 text-xs">delegated</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <FiInfo className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">You haven't delegated to any NFTs yet</p>
            <p className="text-slate-600 text-sm mt-1">
              Delegate your shares to give voting power to board candidates
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
