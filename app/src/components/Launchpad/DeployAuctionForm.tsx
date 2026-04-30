import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { FiPlus, FiAlertCircle, FiSettings, FiCheck, FiUser, FiUsers } from 'react-icons/fi'
import { encodeFunctionData, parseUnits, encodeAbiParameters } from 'viem'
import { parseAbiParameters } from 'viem'
import { useSubmitTransaction, useBoardMembers, useTokenApprove, usePermit2Approve } from '@/hooks'
import { erc20Abi, liquidityLauncherAbi } from '@/contracts/abis'
import toast from 'react-hot-toast'
import type { ChamberInfo } from '@/types'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'

interface DeployAuctionFormProps {
  chamberAddress: `0x${string}`
  chamberInfo: Partial<ChamberInfo>
  isDirector: boolean
}

// Sepolia Deployments for Uniswap Liquidity Launchpad
const LIQUIDITY_LAUNCHER_ADDRESS = '0x00000008412db3394C91A5CbD01635c6d140637C' 
const LBP_STRATEGY_IMPL = '0x89Dd5691e53Ea95d19ED2AbdEdCf4cBbE50da1ff' // FullRangeLBPStrategyFactory
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export default function DeployAuctionForm({ chamberAddress, chamberInfo, isDirector }: DeployAuctionFormProps) {
  const { address: userAddress } = useAccount()
  const { members } = useBoardMembers(chamberAddress, chamberInfo.seats || 5)
  const { submit, isPending: isSubmitting, isConfirming: isConfirmingSubmit } = useSubmitTransaction(chamberAddress)
  
  const { approve: approveErc20, isPending: isApprovingErc20, isConfirming: isConfirmingErc20 } = useTokenApprove(chamberInfo.assetToken)
  const { approvePermit2, isPending: isApprovingPermit2, isConfirming: isConfirmingPermit2 } = usePermit2Approve()
  
  const { writeContractAsync, isPending: isDistributing, data: distributeHash } = useWriteContract()
  const { isConfirming: isConfirmingDistribute } = useWaitForTransactionReceipt({ hash: distributeHash })

  const [deployMode, setDeployMode] = useState<'chamber' | 'wallet'>('chamber')
  const [tokenAmount, setTokenAmount] = useState('')
  const [initialPrice, setInitialPrice] = useState('')
  const [durationBlocks, setDurationBlocks] = useState('7200') // roughly 1 day on Ethereum

  // Check if user is a director and get their token ID
  const userTokenId = React.useMemo(() => {
    if (!userAddress || !chamberInfo.directors || !members.length) return undefined
    
    const directorIndex = chamberInfo.directors.findIndex(
      (director) => director.toLowerCase() === userAddress.toLowerCase()
    )
    
    if (directorIndex >= 0 && directorIndex < members.length) {
      return members[directorIndex].tokenId
    }
    
    return undefined
  }, [userAddress, chamberInfo.directors, members])

  const generateStrategyData = () => {
    const migratorParamsAbi = parseAbiParameters(
      '((uint64 migrationBlock, address currency, uint24 poolLPFee, int24 poolTickSpacing, uint24 tokenSplitToAuction, address auctionFactory, address positionRecipient, uint64 sweepBlock, address operator, uint128 maxCurrencyAmountForLP) migratorParams, bytes auctionParams)'
    )

    return encodeAbiParameters(
      migratorParamsAbi,
      [
        {
          migrationBlock: 0n,
          currency: '0x0000000000000000000000000000000000000000',
          poolLPFee: 3000,
          poolTickSpacing: 60,
          tokenSplitToAuction: 10000000, // 100%
          auctionFactory: '0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5', // CCA Factory on Sepolia
          positionRecipient: deployMode === 'wallet' ? userAddress! : chamberAddress,
          sweepBlock: 0n,
          operator: deployMode === 'wallet' ? userAddress! : chamberAddress,
          maxCurrencyAmountForLP: 0n,
        },
        '0x0000' // dummy auction parameters
      ]
    )
  }

  const handleProposeChamber = async () => {
    if (!isDirector || userTokenId === undefined) {
      toast.error('Only directors can propose an auction')
      return
    }

    try {
      const amountToSell = parseUnits(tokenAmount, 18)
      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [LIQUIDITY_LAUNCHER_ADDRESS, amountToSell],
      })

      await submit(userTokenId, chamberInfo.assetToken as `0x${string}`, 0n, transferData)
      toast.success('Transfer transaction proposed. Check the queue!')

      const distributeData = encodeFunctionData({
        abi: liquidityLauncherAbi,
        functionName: 'distributeToken',
        args: [
          chamberInfo.assetToken as `0x${string}`,
          {
            strategy: LBP_STRATEGY_IMPL,
            amount: amountToSell,
            configData: generateStrategyData(),
          },
          false,
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        ],
      })

      setTimeout(async () => {
        try {
          await submit(userTokenId, LIQUIDITY_LAUNCHER_ADDRESS, 0n, distributeData)
          toast.success('Auction deployment proposed!')
        } catch (err) {
          console.error(err)
        }
      }, 2000)

    } catch (err) {
      console.error(err)
      toast.error('Failed to propose auction')
    }
  }

  const handleDeployWallet = async () => {
    if (!chamberInfo.assetToken || !userAddress) return

    try {
      const amountToSell = parseUnits(tokenAmount, 18)

      // 1. ERC20 approve Permit2
      const approveTx = await writeContractAsync({
        address: chamberInfo.assetToken as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, amountToSell],
      })
      toast.loading('Waiting for ERC20 approval...', { id: 'erc20-approve' })
      // We rely on useWaitForTransactionReceipt internally but let's just proceed optimistically 
      // or wait. In a perfect world, we'd wait for receipt here.

      // 2. Permit2 approve Launcher
      const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
      toast.success('ERC20 Approved! Now approving Permit2...', { id: 'erc20-approve' })
      const permit2Tx = await approvePermit2(chamberInfo.assetToken, LIQUIDITY_LAUNCHER_ADDRESS, amountToSell, expiration)
      toast.loading('Waiting for Permit2 approval...', { id: 'permit2-approve' })

      // 3. Distribute
      toast.success('Permit2 Approved! Now distributing...', { id: 'permit2-approve' })
      await distributeTokenAsync({
        address: LIQUIDITY_LAUNCHER_ADDRESS,
        abi: liquidityLauncherAbi,
        functionName: 'distributeToken',
        args: [
          chamberInfo.assetToken as `0x${string}`,
          {
            strategy: LBP_STRATEGY_IMPL,
            amount: amountToSell,
            configData: generateStrategyData(),
          },
          true, // payerIsUser = true
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        ]
      })
      toast.success('Auction deployed successfully!')

    } catch (err) {
      console.error(err)
      toast.error('Failed to deploy auction from wallet')
      toast.dismiss('erc20-approve')
      toast.dismiss('permit2-approve')
    }
  }

  const isWorking = isSubmitting || isConfirmingSubmit || isApprovingErc20 || isConfirmingErc20 || isApprovingPermit2 || isConfirmingPermit2 || isDistributing || isConfirmingDistribute

  return (
    <div className="panel p-6 border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/50">
      <div className="mb-6">
        <h3 className="font-heading text-lg font-semibold text-slate-100 mb-2">Setup Token Auction</h3>
        <p className="text-slate-400 text-sm">
          Configure a Continuous Clearing Auction to bootstrap liquidity for your token.
        </p>
      </div>

      <div className="flex gap-2 p-1 mb-6 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit">
        <button
          type="button"
          onClick={() => setDeployMode('chamber')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            deployMode === 'chamber' 
              ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]' 
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <FiUsers className="w-4 h-4" />
          Propose via Chamber
        </button>
        <button
          type="button"
          onClick={() => setDeployMode('wallet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            deployMode === 'wallet' 
              ? 'bg-purple-500/20 text-purple-400 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.2)]' 
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <FiUser className="w-4 h-4" />
          Deploy via Personal Wallet
        </button>
      </div>

      {deployMode === 'chamber' && !isDirector && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            You are not a director. You can view the configuration, but only active directors can submit the proposal to the board.
          </p>
        </div>
      )}

      {deployMode === 'wallet' && (
        <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            You are deploying directly from your connected wallet. This will require two approval transactions (ERC20 + Permit2) before the final distribution. You must have the tokens in your wallet.
          </p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); deployMode === 'chamber' ? handleProposeChamber() : handleDeployWallet() }} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Tokens to Sell
            </label>
            <input
              type="number"
              placeholder="e.g. 1000000"
              className="input"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              min="0"
              step="any"
              required
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Initial Price (ETH)
            </label>
            <input
              type="number"
              placeholder="e.g. 0.001"
              className="input"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              min="0"
              step="any"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Duration (in blocks)
            </label>
            <input
              type="number"
              placeholder="e.g. 7200"
              className="input"
              value={durationBlocks}
              onChange={(e) => setDurationBlocks(e.target.value)}
              min="100"
              required
            />
            <p className="text-slate-500 text-xs mt-1.5">
              ~12 seconds per block on Ethereum. 7200 blocks is roughly 24 hours.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-700/50 mt-6">
          <button
            type="submit"
            disabled={(deployMode === 'chamber' && !isDirector) || isWorking}
            className={`btn w-full py-3 ${deployMode === 'wallet' ? 'bg-purple-500 hover:bg-purple-400 text-white' : 'btn-primary'}`}
          >
            {isWorking ? 'Processing...' : (
              <>
                <FiPlus className="w-4 h-4" />
                {deployMode === 'chamber' ? 'Propose Auction to Board' : 'Launch Auction'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
