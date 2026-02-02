import { Link } from 'react-router-dom'
import { FiArrowRight, FiUsers, FiLayers, FiCheckCircle } from 'react-icons/fi'
import { useChamberInfo } from '@/hooks'
import { formatUnits } from 'viem'

interface ChamberCardProps {
  address: `0x${string}`
}

export default function ChamberCard({ address }: ChamberCardProps) {
  const { 
    name, 
    symbol, 
    totalAssets, 
    seats, 
    quorum, 
    directors, 
    transactionCount,
  } = useChamberInfo(address)

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <Link to={`/chamber/${address}`} className="card-hover group block relative">
      {/* Pending Transactions Badge */}
      {transactionCount !== undefined && transactionCount > 0 && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="badge badge-pending">
            {transactionCount} pending
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-heading text-lg font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
            {name || 'Loading...'}
          </h3>
          <p className="text-slate-500 text-sm font-mono mt-0.5">{shortAddress}</p>
        </div>
        <span className="badge badge-primary">{symbol || '...'}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiLayers className="w-3.5 h-3.5" />
            <span>Total Assets</span>
          </div>
          <div className="font-mono text-slate-100 font-medium">
            {totalAssets !== undefined 
              ? `${parseFloat(formatUnits(totalAssets, 18)).toFixed(2)}`
              : '...'
            }
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1.5">
            <FiUsers className="w-3.5 h-3.5" />
            <span>Board Seats</span>
          </div>
          <div className="font-mono text-slate-100 font-medium">
            {seats !== undefined ? seats : '...'}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="flex items-center justify-between text-sm border-t border-slate-700/30 pt-4">
        <div className="flex items-center gap-4 text-slate-500">
          <span className="flex items-center gap-1.5">
            <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>{quorum} quorum</span>
          </span>
          <span className="flex items-center gap-1.5">
            <FiUsers className="w-3.5 h-3.5 text-violet-500" />
            <span>{directors?.length || 0} directors</span>
          </span>
        </div>
        <FiArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  )
}
