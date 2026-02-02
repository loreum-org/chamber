import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { formatUnits, parseUnits, maxUint256 } from 'viem'
import {
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiPieChart,
  FiTrendingUp,
  FiLoader,
  FiAlertCircle,
  FiCheck,
  FiUnlock,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { 
  useDeposit, 
  useWithdraw, 
  useChamberInfo, 
  useTokenAllowance, 
  useTokenApprove,
  useTokenBalance,
} from '@/hooks'

interface TreasuryOverviewProps {
  chamberAddress: `0x${string}`
  chamberInfo: ReturnType<typeof useChamberInfo>
  userBalance: bigint | undefined
}

export default function TreasuryOverview({ chamberAddress, chamberInfo, userBalance }: TreasuryOverviewProps) {
  const { address: userAddress } = useAccount()
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  
  // Get user's token balance and allowance
  const { balance: tokenBalance, refetch: refetchTokenBalance } = useTokenBalance(
    chamberInfo.assetToken,
    userAddress
  )
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    chamberInfo.assetToken,
    userAddress,
    chamberAddress
  )
  
  const { approve, isPending: isApproving, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useTokenApprove(chamberInfo.assetToken)
  const { deposit, isPending: isDepositing, isConfirming: isDepositConfirming } = useDeposit(chamberAddress)
  const { withdraw, isPending: isWithdrawing, isConfirming: isWithdrawConfirming } = useWithdraw(chamberAddress)

  // Refetch allowance after approval succeeds
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance()
    }
  }, [isApproveSuccess, refetchAllowance])

  // Calculate if approval is needed
  const depositAmountBigInt = depositAmount ? parseUnits(depositAmount, 18) : 0n
  const needsApproval = allowance !== undefined && depositAmountBigInt > 0n && allowance < depositAmountBigInt

  const handleApprove = async () => {
    if (!chamberAddress) return
    try {
      await approve(chamberAddress, maxUint256) // Approve max for convenience
      toast.success('Approval submitted!')
    } catch (err) {
      console.error(err)
      toast.error('Approval failed')
    }
  }

  const handleDeposit = async () => {
    if (!depositAmount || !userAddress) return
    try {
      const amount = parseUnits(depositAmount, 18)
      await deposit(amount, userAddress)
      toast.success('Deposit submitted!')
      setDepositAmount('')
      refetchTokenBalance()
    } catch (err) {
      console.error(err)
      toast.error('Deposit failed')
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || !userAddress) return
    try {
      const amount = parseUnits(withdrawAmount, 18)
      await withdraw(amount, userAddress, userAddress)
      toast.success('Withdrawal submitted!')
      setWithdrawAmount('')
    } catch (err) {
      console.error(err)
      toast.error('Withdrawal failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Treasury Stats */}
      <div className="grid md:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-container-emerald w-12 h-12">
              <FiPieChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Assets</p>
              <p className="font-heading text-2xl font-bold gradient-text">
                {chamberInfo.totalAssets !== undefined
                  ? parseFloat(formatUnits(chamberInfo.totalAssets, 18)).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : '...'
                }
              </p>
            </div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '75%' }}
              transition={{ duration: 1 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-container bg-blue-500/15 text-blue-400 w-12 h-12">
              <FiTrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Shares</p>
              <p className="font-heading text-2xl font-bold text-slate-100">
                {chamberInfo.totalSupply !== undefined
                  ? parseFloat(formatUnits(chamberInfo.totalSupply, 18)).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : '...'
                }
              </p>
            </div>
          </div>
          <div className="text-slate-500 text-sm">
            1 share = {chamberInfo.totalSupply && chamberInfo.totalAssets && chamberInfo.totalSupply > 0n
              ? (Number(chamberInfo.totalAssets) / Number(chamberInfo.totalSupply)).toFixed(4)
              : '1.0000'
            } assets
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-container-accent w-12 h-12">
              <FiPieChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Your Shares</p>
              <p className="font-heading text-2xl font-bold gradient-text">
                {userBalance !== undefined
                  ? parseFloat(formatUnits(userBalance, 18)).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })
                  : 'Connect Wallet'
                }
              </p>
            </div>
          </div>
          {userBalance !== undefined && chamberInfo.totalSupply && chamberInfo.totalSupply > 0n ? (
            <div className="text-slate-500 text-sm">
              {((Number(userBalance) / Number(chamberInfo.totalSupply)) * 100).toFixed(2)}% of total supply
            </div>
          ) : null}
        </motion.div>
      </div>

      {/* Deposit / Withdraw */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Deposit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-container-emerald">
              <FiArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-slate-100">Deposit</h3>
              <p className="text-slate-500 text-xs">Add assets to receive shares</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Token Balance Display */}
            {tokenBalance !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Your Token Balance:</span>
                <span className="text-slate-300 font-mono">
                  {parseFloat(formatUnits(tokenBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="input pr-20"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="any"
                />
                <button
                  onClick={() => tokenBalance && setDepositAmount(formatUnits(tokenBalance, 18))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Allowance Status */}
            {depositAmount && (
              <div className="flex items-center gap-2 text-sm">
                {needsApproval ? (
                  <>
                    <FiUnlock className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">Approval required before deposit</span>
                  </>
                ) : allowance !== undefined && depositAmountBigInt > 0n ? (
                  <>
                    <FiCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Approved</span>
                  </>
                ) : null}
              </div>
            )}

            {/* Approve or Deposit Button */}
            {needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || isApproveConfirming}
                className="btn btn-secondary w-full border-amber-500/30 hover:border-amber-500/50"
              >
                {isApproving || isApproveConfirming ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    {isApproving ? 'Confirm...' : 'Approving...'}
                  </>
                ) : (
                  <>
                    <FiUnlock className="w-4 h-4" />
                    Approve Token
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={isDepositing || isDepositConfirming || !depositAmount}
                className="btn btn-primary w-full"
              >
                {isDepositing || isDepositConfirming ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    {isDepositing ? 'Confirm...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <FiArrowDownCircle className="w-4 h-4" />
                    Deposit
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Withdraw */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-container bg-red-500/15 text-red-400">
              <FiArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-slate-100">Withdraw</h3>
              <p className="text-slate-500 text-xs">Burn shares to receive assets</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  className="input pr-20"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="0"
                  step="any"
                />
                <button
                  onClick={() => userBalance && setWithdrawAmount(formatUnits(userBalance, 18))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || isWithdrawConfirming || !withdrawAmount}
              className="btn btn-secondary w-full border-red-500/30 hover:border-red-500/50 hover:text-red-400"
            >
              {isWithdrawing || isWithdrawConfirming ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  {isWithdrawing ? 'Confirm...' : 'Processing...'}
                </>
              ) : (
                <>
                  <FiArrowUpCircle className="w-4 h-4" />
                  Withdraw
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Info Box */}
      <div className="panel p-6 bg-cyan-500/5 border-cyan-500/20">
        <div className="flex items-start gap-4">
          <FiAlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-slate-100 mb-1">About ERC4626 Vaults</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              This chamber implements the ERC4626 tokenized vault standard. When you deposit assets, 
              you receive shares that represent your proportional ownership of the vault. You need to 
              approve the Chamber to spend your tokens before depositing.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
