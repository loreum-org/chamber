import { motion } from 'framer-motion'
import { FiUser, FiStar, FiAward, FiTrendingUp } from 'react-icons/fi'
import { formatUnits } from 'viem'
import type { BoardMember } from '@/types'

interface BoardVisualizationProps {
  members: BoardMember[]
  seats: number
  totalDelegated: bigint
}

export default function BoardVisualization({ members, seats, totalDelegated }: BoardVisualizationProps) {
  return (
    <div className="space-y-6">
      {/* Board Visualization */}
      <div className="relative panel p-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-mesh-gradient pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h3 className="font-heading text-2xl font-bold text-slate-100 mb-2 tracking-tight">
            Board of Directors
          </h3>
          <p className="text-slate-400 text-sm">
            {seats} seats • {members.filter((_, i) => i < seats).length} filled
          </p>
        </div>

        {/* Semi-circular Board Layout */}
        <div className="relative h-[320px] max-w-3xl mx-auto">
          {/* Center podium */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-16 bg-gradient-to-t from-cyan-500/20 to-cyan-500/5 rounded-t-full border-t border-l border-r border-cyan-500/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <FiAward className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Seat positions in semi-circle */}
          {Array.from({ length: seats }).map((_, index) => {
            const member = members[index]
            const isDirector = index < seats && !!member
            const angle = 180 - (180 / (seats + 1)) * (index + 1) // Semi-circle distribution
            const radius = 140 // Distance from center
            const x = Math.cos((angle * Math.PI) / 180) * radius
            const y = Math.sin((angle * Math.PI) / 180) * radius * 0.7 // Flatten the arc

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, type: 'spring', bounce: 0.4 }}
                className="absolute"
                style={{
                  left: `calc(50% + ${x}px)`,
                  bottom: `${60 + y}px`,
                  transform: 'translate(-50%, 0)',
                }}
              >
                <SeatCard
                  seatNumber={index + 1}
                  member={member}
                  isDirector={isDirector}
                  totalDelegated={totalDelegated}
                />
              </motion.div>
            )
          })}

          {/* Decorative arcs */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 320">
            {/* Outer arc */}
            <path
              d="M 50 280 Q 300 0 550 280"
              fill="none"
              stroke="url(#accentGradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.3"
            />
            {/* Inner arc */}
            <path
              d="M 100 280 Q 300 50 500 280"
              fill="none"
              stroke="url(#accentGradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.2"
            />
            <defs>
              <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Member List */}
      <div className="panel">
        <div className="p-4 border-b border-slate-700/30">
          <h4 className="font-heading font-semibold text-slate-100">Leaderboard</h4>
          <p className="text-slate-500 text-xs mt-1">All delegated members ranked by voting power</p>
        </div>
        <div className="divide-y divide-slate-700/30">
          {members.length > 0 ? (
            members.map((member, index) => (
              <MemberRow
                key={member.tokenId.toString()}
                member={member}
                rank={index + 1}
                isDirector={index < seats}
                totalDelegated={totalDelegated}
              />
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              No members have received delegations yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface SeatCardProps {
  seatNumber: number
  member?: BoardMember
  isDirector: boolean
  totalDelegated: bigint
}

function SeatCard({ seatNumber, member, isDirector, totalDelegated }: SeatCardProps) {
  const votingPower = member && totalDelegated > 0n
    ? (Number(member.amount) / Number(totalDelegated)) * 100
    : 0

  return (
    <motion.div
      whileHover={{ scale: 1.1, y: -5 }}
      className={`
        w-16 h-20 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
        ${isDirector 
          ? 'bg-gradient-to-b from-cyan-500/20 to-violet-500/10 border border-cyan-500/40 shadow-glow' 
          : 'bg-slate-800/80 border border-slate-700/50'
        }
      `}
    >
      {member ? (
        <>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1
            ${isDirector ? 'bg-cyan-500/30' : 'bg-slate-700'}`}
          >
            <FiUser className={`w-4 h-4 ${isDirector ? 'text-cyan-400' : 'text-slate-500'}`} />
          </div>
          <span className="text-xs font-mono text-slate-300">#{member.tokenId.toString()}</span>
          <span className="text-[10px] text-slate-500">{votingPower.toFixed(1)}%</span>
        </>
      ) : (
        <>
          <div className="w-8 h-8 rounded-lg bg-slate-800/50 border border-dashed border-slate-600/50 flex items-center justify-center mb-1">
            <span className="text-slate-600 text-xs">{seatNumber}</span>
          </div>
          <span className="text-[10px] text-slate-600">Empty</span>
        </>
      )}
    </motion.div>
  )
}

interface MemberRowProps {
  member: BoardMember
  rank: number
  isDirector: boolean
  totalDelegated: bigint
}

function MemberRow({ member, rank, isDirector, totalDelegated }: MemberRowProps) {
  const percentage = 100
  const votingPower = totalDelegated > 0n 
    ? (Number(member.amount) / Number(totalDelegated)) * 100 
    : 0
  const shortOwner = member.owner 
    ? `${member.owner.slice(0, 6)}...${member.owner.slice(-4)}`
    : 'Unknown'

  return (
    <div className={`p-4 flex items-center gap-4 ${isDirector ? 'bg-cyan-500/5' : ''}`}>
      {/* Rank */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
        ${rank === 1 ? 'bg-gradient-to-br from-cyan-500 to-violet-500 text-white' : 
          rank === 2 ? 'bg-slate-300 text-slate-900' :
          rank === 3 ? 'bg-amber-600 text-white' :
          'bg-slate-800 text-slate-400'
        }
      `}>
        {rank}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-100">Token #{member.tokenId.toString()}</span>
          {isDirector && (
            <span className="badge badge-primary text-[10px]">
              <FiStar className="w-3 h-3 mr-1" />
              Director
            </span>
          )}
        </div>
        <div className="text-slate-500 text-xs mt-0.5">{shortOwner}</div>
      </div>

      {/* Voting Power */}
      <div className="text-right">
        <div className="font-mono text-slate-100">
          {parseFloat(formatUnits(member.amount, 18)).toFixed(2)}
        </div>
        <div className="text-slate-500 text-xs flex items-center gap-1 justify-end">
          <FiTrendingUp className="w-3 h-3" />
          {votingPower.toFixed(1)}% power
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            isDirector 
              ? 'bg-gradient-to-r from-cyan-500 to-violet-500' 
              : 'bg-slate-600'
          }`}
        />
      </div>
    </div>
  )
}
