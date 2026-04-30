import React from 'react'
import { motion } from 'framer-motion'
import { FiTrendingUp, FiAlertCircle, FiLoader } from 'react-icons/fi'
import { useChamberAuction } from '@/hooks/useLaunchpad'
import DeployAuctionForm from './DeployAuctionForm'
import ActiveAuctionView from './ActiveAuctionView'
import type { ChamberInfo, BoardMember } from '@/types'
import { useAccount } from 'wagmi'

interface AuctionTabProps {
  chamberAddress: `0x${string}`
  chamberInfo: Partial<ChamberInfo>
  userBalance: bigint | undefined
  members: BoardMember[]
}

export default function AuctionTab({ chamberAddress, chamberInfo, userBalance, members }: AuctionTabProps) {
  const { address: userAddress } = useAccount()
  const { strategyAddress, isLoading } = useChamberAuction(chamberAddress, chamberInfo.assetToken as `0x${string}`)

  // Check if user is a director
  const isDirector = React.useMemo(() => {
    if (!userAddress || !chamberInfo.directors) return false
    return chamberInfo.directors.some((d: string) => d.toLowerCase() === userAddress.toLowerCase())
  }, [userAddress, chamberInfo.directors])

  if (isLoading) {
    return (
      <div className="panel p-12 text-center flex flex-col items-center justify-center">
        <FiLoader className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
        <p className="text-slate-400">Scanning for active auctions...</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="icon-container-accent">
            <FiTrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-100">Liquidity Launchpad</h2>
            <p className="text-slate-500 text-sm">
              Powered by Uniswap Continuous Clearing Auctions (CCA)
            </p>
          </div>
        </div>
      </div>

      {!strategyAddress ? (
        <DeployAuctionForm
          chamberAddress={chamberAddress}
          chamberInfo={chamberInfo}
          isDirector={isDirector}
        />
      ) : (
        <ActiveAuctionView 
          strategyAddress={strategyAddress} 
          chamberInfo={chamberInfo} 
        />
      )}
    </motion.div>
  )
}
