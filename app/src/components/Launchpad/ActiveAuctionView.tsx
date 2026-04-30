import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { formatEther, formatUnits, parseEther } from 'viem'
import { FiTrendingUp, FiClock, FiActivity, FiDollarSign, FiArrowRight } from 'react-icons/fi'
import { useAuctionStatus, useBuyTokens, useMigrateLiquidity, useClaimTokens } from '@/hooks/useLaunchpad'
import { useBlockNumber } from 'wagmi'
import toast from 'react-hot-toast'
import type { ChamberInfo } from '@/types'

interface ActiveAuctionViewProps {
  strategyAddress: `0x${string}`
  chamberInfo: Partial<ChamberInfo>
}

export default function ActiveAuctionView({ strategyAddress, chamberInfo }: ActiveAuctionViewProps) {
  const { data: currentBlock } = useBlockNumber()
  
  const {
    auctionAddress,
    clearingPrice,
    tokensRemaining,
    fundsRaised,
    claimBlock,
    refetch,
  } = useAuctionStatus(strategyAddress)

  const { bid, isPending: isBidding } = useBuyTokens(auctionAddress)
  const { migrate, isPending: isMigrating } = useMigrateLiquidity(strategyAddress)
  const { claim, isPending: isClaiming } = useClaimTokens(auctionAddress)

  const [bidAmount, setBidAmount] = useState('')

  const isAuctionEnded = claimBlock && currentBlock ? currentBlock >= claimBlock : false

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bidAmount || isNaN(Number(bidAmount)) || Number(bidAmount) <= 0) return

    try {
      await bid(parseEther(bidAmount))
      toast.success('Bid submitted successfully!')
      setBidAmount('')
      setTimeout(refetch, 3000) // Refetch after a moment
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit bid')
    }
  }

  const handleMigrate = async () => {
    try {
      await migrate()
      toast.success('Liquidity migration initiated!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to migrate liquidity')
    }
  }

  const handleClaim = async () => {
    try {
      await claim()
      toast.success('Tokens claimed successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to claim tokens')
    }
  }

  // Formatting helpers
  const formattedPrice = clearingPrice ? formatEther(clearingPrice) : '0.00'
  const formattedRemaining = tokensRemaining ? formatUnits(tokensRemaining as bigint, 18) : '0.00'
  const formattedRaised = fundsRaised ? formatEther(fundsRaised as bigint) : '0.00'

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiTrendingUp className="w-3.5 h-3.5" />
            Current Clearing Price
          </div>
          <div className="font-heading text-xl font-bold text-cyan-400">
            {formattedPrice} ETH
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiActivity className="w-3.5 h-3.5" />
            Tokens Remaining
          </div>
          <div className="font-heading text-xl font-bold text-slate-100">
            {parseFloat(formattedRemaining).toLocaleString()}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiDollarSign className="w-3.5 h-3.5" />
            Funds Raised
          </div>
          <div className="font-heading text-xl font-bold text-slate-100">
            {parseFloat(formattedRaised).toLocaleString()} ETH
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiClock className="w-3.5 h-3.5" />
            Status
          </div>
          <div className="font-heading text-xl font-bold">
            {isAuctionEnded ? (
              <span className="text-emerald-400">Ended</span>
            ) : (
              <span className="text-amber-400">Active</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Participate Panel */}
        <div className="panel p-6">
          <h3 className="font-heading text-lg font-semibold text-slate-100 mb-4">
            Participate in Auction
          </h3>
          
          {isAuctionEnded ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                The auction has concluded. Participants can now claim their tokens.
              </div>
              <button 
                onClick={handleClaim}
                disabled={isClaiming}
                className="btn btn-primary w-full py-3"
              >
                {isClaiming ? 'Claiming...' : 'Claim Purchased Tokens'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleBid} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Bid Amount (ETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input pr-16"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min="0"
                    step="any"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                    ETH
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">
                  Your bid determines how many tokens you get at the final clearing price.
                </p>
              </div>

              <button
                type="submit"
                disabled={isBidding}
                className="btn btn-primary w-full py-3"
              >
                {isBidding ? 'Submitting Bid...' : (
                  <>
                    Bid / Purchase Tokens
                    <FiArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Administration Panel */}
        <div className="panel p-6 bg-slate-800/30">
          <h3 className="font-heading text-lg font-semibold text-slate-100 mb-4">
            Post-Auction Administration
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            Once the auction ends, anyone can migrate the raised liquidity to a Uniswap V4 pool. 
            This seeds the new pool at the discovered price and mints the LP NFT to the Chamber treasury.
          </p>
          
          <button
            onClick={handleMigrate}
            disabled={!isAuctionEnded || isMigrating}
            className={`btn w-full py-3 ${
              isAuctionEnded && !isMigrating
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isMigrating ? 'Migrating...' : 'Migrate Liquidity to V4'}
          </button>

          {claimBlock && currentBlock && !isAuctionEnded && (
            <div className="mt-4 text-center text-xs text-slate-500 font-mono">
              Migration available at block {claimBlock.toString()} 
              (Current: {currentBlock.toString()})
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
