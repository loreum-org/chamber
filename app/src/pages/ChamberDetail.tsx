import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useBalance } from 'wagmi'
import { formatUnits } from 'viem'
import {
  FiArrowLeft,
  FiCopy,
  FiExternalLink,
  FiLayers,
  FiUsers,
  FiShield,
  FiActivity,
  FiSend,
  FiPlus,
  FiCheck,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useChamberInfo,
  useChamberBalance,
  useBoardMembers,
  useDelegations,
} from '@/hooks'
import BoardVisualization from '@/components/BoardVisualization'
import TreasuryOverview from '@/components/TreasuryOverview'
import DelegationManager from '@/components/DelegationManager'

type Tab = 'overview' | 'board' | 'treasury' | 'delegation'

export default function ChamberDetail() {
  const { address } = useParams<{ address: string }>()
  const chamberAddress = address as `0x${string}`
  const { address: userAddress } = useAccount()
  
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const chamberInfo = useChamberInfo(chamberAddress)
  const { balance: userBalance } = useChamberBalance(chamberAddress, userAddress)
  const { members } = useBoardMembers(chamberAddress, 20)
  const { delegations } = useDelegations(chamberAddress, userAddress)
  
  // ETH balance of chamber
  const { data: ethBalance } = useBalance({
    address: chamberAddress,
  })

  const copyAddress = () => {
    navigator.clipboard.writeText(chamberAddress)
    toast.success('Address copied!')
  }

  const shortAddress = chamberAddress
    ? `${chamberAddress.slice(0, 10)}...${chamberAddress.slice(-8)}`
    : ''

  // Calculate total delegated
  const totalDelegated = members.reduce((sum, m) => sum + m.amount, 0n)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiActivity },
    { id: 'board', label: 'Board', icon: FiUsers },
    { id: 'treasury', label: 'Treasury', icon: FiLayers },
    { id: 'delegation', label: 'Delegation', icon: FiSend },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel p-6"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              to="/"
              className="p-2.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all"
            >
              <FiArrowLeft className="w-5 h-5" />
            </Link>
            
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-heading text-2xl font-bold text-slate-100 tracking-tight">
                  {chamberInfo.name || 'Loading...'}
                </h1>
                <span className="badge badge-primary">{chamberInfo.symbol}</span>
                <span className="badge bg-slate-800 text-slate-400 border-slate-700">
                  v{chamberInfo.version}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-mono text-sm">{shortAddress}</span>
                <button onClick={copyAddress} className="hover:text-cyan-400 transition-colors">
                  <FiCopy className="w-4 h-4" />
                </button>
                <a
                  href={`https://etherscan.io/address/${chamberAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  <FiExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/chamber/${chamberAddress}/transactions`}
              className="btn btn-secondary"
            >
              <FiShield className="w-4 h-4" />
              Transactions
              {chamberInfo.transactionCount !== undefined && chamberInfo.transactionCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs">
                  {chamberInfo.transactionCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/30">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
              <FiLayers className="w-3.5 h-3.5" />
              Total Assets
            </div>
            <div className="font-heading text-xl font-bold gradient-text">
              {chamberInfo.totalAssets !== undefined
                ? parseFloat(formatUnits(chamberInfo.totalAssets, 18)).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })
                : '...'}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
              <FiUsers className="w-3.5 h-3.5" />
              Board Seats
            </div>
            <div className="font-heading text-xl font-bold text-slate-100">
              {chamberInfo.seats} / 20
            </div>
          </div>
          
          <div className="stat-card">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
              <FiCheck className="w-3.5 h-3.5" />
              Quorum
            </div>
            <div className="font-heading text-xl font-bold text-slate-100">
              {chamberInfo.quorum} confirmations
            </div>
          </div>
          
          <div className="stat-card">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
              <FiActivity className="w-3.5 h-3.5" />
              ETH Balance
            </div>
            <div className="font-heading text-xl font-bold text-slate-100">
              {ethBalance 
                ? parseFloat(formatUnits(ethBalance.value, 18)).toFixed(4)
                : '0'
              } ETH
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-1 justify-center text-sm font-medium
                ${isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/30 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' && (
          <OverviewTab
            chamberAddress={chamberAddress}
            chamberInfo={chamberInfo}
            members={members}
            totalDelegated={totalDelegated}
            userBalance={userBalance}
          />
        )}
        
        {activeTab === 'board' && (
          <BoardVisualization
            members={members}
            seats={chamberInfo.seats || 5}
            totalDelegated={totalDelegated}
          />
        )}
        
        {activeTab === 'treasury' && (
          <TreasuryOverview
            chamberAddress={chamberAddress}
            chamberInfo={chamberInfo}
            userBalance={userBalance}
          />
        )}
        
        {activeTab === 'delegation' && (
          <DelegationManager
            chamberAddress={chamberAddress}
            userBalance={userBalance}
            delegations={delegations}
            members={members}
          />
        )}
      </motion.div>
    </div>
  )
}

// Overview Tab Component
interface OverviewTabProps {
  chamberAddress: `0x${string}`
  chamberInfo: ReturnType<typeof useChamberInfo>
  members: ReturnType<typeof useBoardMembers>['members']
  totalDelegated: bigint
  userBalance: bigint | undefined
}

function OverviewTab({ chamberAddress, chamberInfo, members, totalDelegated, userBalance }: OverviewTabProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Directors */}
      <div className="panel">
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-semibold text-slate-100">Current Directors</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Top {chamberInfo.seats} members by delegation
            </p>
          </div>
          <span className="badge badge-primary">{chamberInfo.directors?.length || 0} active</span>
        </div>
        <div className="divide-y divide-slate-700/30">
          {chamberInfo.directors?.slice(0, 5).map((director, index) => (
            <div key={index} className="p-4 flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                ${index === 0 
                  ? 'bg-gradient-to-br from-cyan-500 to-violet-500 text-white' 
                  : 'bg-slate-800 text-slate-400'}
              `}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-slate-100 text-sm">
                  {director === '0x0000000000000000000000000000000000000000' 
                    ? 'Empty Seat'
                    : `${director.slice(0, 8)}...${director.slice(-6)}`
                  }
                </span>
              </div>
              {members[index] && (
                <span className="text-slate-500 text-xs font-mono">
                  #{members[index].tokenId.toString()}
                </span>
              )}
            </div>
          )) || (
            <div className="p-8 text-center text-slate-500">
              No directors yet
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="panel">
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-heading font-semibold text-slate-100">Quick Actions</h3>
          <p className="text-slate-500 text-xs mt-0.5">Common operations</p>
        </div>
        <div className="p-4 space-y-3">
          <Link
            to={`/chamber/${chamberAddress}/transactions`}
            className="btn btn-secondary w-full justify-start"
          >
            <FiShield className="w-4 h-4" />
            View Transaction Queue
            <FiArrowLeft className="w-4 h-4 rotate-180 ml-auto" />
          </Link>
          
          <button className="btn btn-secondary w-full justify-start">
            <FiPlus className="w-4 h-4" />
            Deposit Assets
            <FiArrowLeft className="w-4 h-4 rotate-180 ml-auto" />
          </button>
          
          <button className="btn btn-secondary w-full justify-start">
            <FiSend className="w-4 h-4" />
            Delegate Votes
            <FiArrowLeft className="w-4 h-4 rotate-180 ml-auto" />
          </button>
        </div>

        {/* User Balance */}
        {userBalance !== undefined && (
          <div className="p-4 border-t border-slate-700/30 bg-cyan-500/5">
            <div className="text-slate-400 text-xs mb-1">Your Balance</div>
            <div className="font-heading text-xl font-bold gradient-text">
              {parseFloat(formatUnits(userBalance, 18)).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })} shares
            </div>
          </div>
        )}
      </div>

      {/* Contract Info */}
      <div className="panel lg:col-span-2">
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-heading font-semibold text-slate-100">Contract Details</h3>
        </div>
        <div className="p-4 grid md:grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="text-slate-500 text-xs mb-1.5">Asset Token</div>
            <div className="font-mono text-slate-100 text-sm break-all">
              {chamberInfo.assetToken}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-slate-500 text-xs mb-1.5">Membership NFT</div>
            <div className="font-mono text-slate-100 text-sm break-all">
              {chamberInfo.nftToken}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-slate-500 text-xs mb-1.5">Total Supply (Shares)</div>
            <div className="font-mono text-slate-100 text-sm">
              {chamberInfo.totalSupply !== undefined
                ? parseFloat(formatUnits(chamberInfo.totalSupply, 18)).toLocaleString()
                : '...'}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-slate-500 text-xs mb-1.5">Total Delegated</div>
            <div className="font-mono text-slate-100 text-sm">
              {parseFloat(formatUnits(totalDelegated, 18)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
