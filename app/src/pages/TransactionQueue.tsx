import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContracts, useChainId } from 'wagmi'
import { formatEther, isAddress, encodeFunctionData, parseAbi } from 'viem'
import {
  FiArrowLeft,
  FiPlus,
  FiCheck,
  FiPlay,
  FiLoader,
  FiExternalLink,
  FiClock,
  FiShield,
  FiAlertCircle,
  FiSend,
  FiCode,
  FiDollarSign,
  FiHash,
  FiX,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useChamberInfo,
  useBoardMembers,
  useSubmitTransaction,
  useConfirmTransaction,
  useExecuteTransaction,
  useRevokeConfirmation,
  useCancelTransaction,
  useTransactionConfirmation,
  useTransactionCancelConfirmation,
  useChamberEvents,
} from '@/hooks'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import { getBlockExplorerAddressUrl, parseDataField } from '@/lib/utils'
import { getProposalMetadata, setProposalMetadata } from '@/lib/proposalMetadata'
import type { Transaction } from '@/types'

type TabType = 'queue' | 'history' | 'new'

export default function TransactionQueue() {
  const { address } = useParams<{ address: string }>()
  const chamberAddress = address as `0x${string}`
  const { address: userAddress } = useAccount()
  const chainId = useChainId()
  
  const [activeTab, setActiveTab] = useState<TabType>('queue')
  const [transactions, setTransactions] = useState<(Transaction & { status: string; cancelled?: boolean; cancelConfirmations?: number })[]>([])
  
  const chamberInfo = useChamberInfo(chamberAddress)
  const { members } = useBoardMembers(chamberAddress, chamberInfo.seats || 5)

  // Fetch all transactions
  const transactionCount = chamberInfo.transactionCount || 0
  const transactionIds = Array.from({ length: transactionCount }, (_, i) => i)
  
  const { data: transactionsData, refetch: refetchTransactions } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getTransaction'; args: [bigint] }[],
    query: {
      enabled: transactionCount > 0,
    },
  })

  const { data: cancelledData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getCancelled',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getCancelled'; args: [bigint] }[],
    query: {
      enabled: transactionCount > 0,
    },
  })

  const { data: cancelConfirmationsData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getCancelConfirmations',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getCancelConfirmations'; args: [bigint] }[],
    query: {
      enabled: transactionCount > 0,
    },
  })

  // Watch for transaction events and auto-refresh when transactions are mined
  useChamberEvents(chamberAddress, {
    onTransactionEvent: () => {
      console.log('Transaction event detected, refetching...')
      refetchTransactions()
    },
  })

  useEffect(() => {
    if (transactionsData) {
      const cancelledList: boolean[] = []
      cancelledData?.forEach((r: { status: string; result?: unknown }, i: number) => {
        cancelledList[i] = r.status === 'success' && r.result === true
      })

      const cancelConfirmationsList: number[] = []
      cancelConfirmationsData?.forEach((r: { status: string; result?: unknown }, i: number) => {
        cancelConfirmationsList[i] = r.status === 'success' && typeof r.result === 'bigint' ? Number(r.result) : 0
      })

      const txs: (Transaction & { status: string; cancelled?: boolean; cancelConfirmations?: number })[] = []
      transactionsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [executed, confirmations, target, value, data] = result.result as [boolean, number, `0x${string}`, bigint, `0x${string}`]
          const cancelled = cancelledList[index] ?? false
          const status = cancelled ? 'cancelled' : executed ? 'executed' : confirmations >= (chamberInfo.quorum || 1) ? 'ready' : 'pending'
          txs.push({
            id: index,
            executed,
            confirmations,
            target,
            value,
            data,
            status,
            cancelled,
            cancelConfirmations: cancelConfirmationsList[index] ?? 0,
          })
        }
      })
      setTransactions(txs)
    }
  }, [transactionsData, cancelledData, cancelConfirmationsData, chamberInfo.quorum])

  const pendingTransactions = transactions.filter(tx => !tx.executed && tx.status !== 'ready' && !tx.cancelled)
  const readyTransactions = transactions.filter(tx => !tx.executed && tx.status === 'ready' && !tx.cancelled)
  const cancelledTransactions = transactions.filter(tx => tx.cancelled)
  const executedTransactions = transactions.filter(tx => tx.executed)

  // Check if user is a director and get their token ID
  // Directors array contains wallet addresses of NFT owners for board member token IDs
  const userTokenId = useMemo(() => {
    if (!userAddress || !chamberInfo.directors || !members.length) return undefined
    
    // Find the index of user's address in the directors array
    const directorIndex = chamberInfo.directors.findIndex(
      (director) => director.toLowerCase() === userAddress.toLowerCase()
    )
    
    // If user is a director, get the corresponding token ID from members
    if (directorIndex >= 0 && directorIndex < members.length) {
      return members[directorIndex].tokenId
    }
    
    return undefined
  }, [userAddress, chamberInfo.directors, members])

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/chamber/${chamberAddress}`}
              className="p-2.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all"
            >
              <FiArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-heading text-2xl font-bold text-slate-100 tracking-tight">
                Proposals & Queue
              </h1>
              <p className="text-slate-500 text-sm">
                {chamberInfo.name} • {chamberInfo.quorum} of {chamberInfo.seats} confirmations required
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('new')}
            className="btn btn-primary"
          >
            <FiPlus className="w-4 h-4" />
            New Proposal
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-700/30">
          <div className="stat-card text-center">
            <div className="font-heading text-xl font-bold text-amber-400">
              {pendingTransactions.length}
            </div>
            <div className="text-slate-500 text-xs mt-1">Pending</div>
          </div>
          <div className="stat-card text-center">
            <div className="font-heading text-xl font-bold text-emerald-400">
              {readyTransactions.length}
            </div>
            <div className="text-slate-500 text-xs mt-1">Ready</div>
          </div>
          <div className="stat-card text-center">
            <div className="font-heading text-xl font-bold text-slate-500">
              {cancelledTransactions.length}
            </div>
            <div className="text-slate-500 text-xs mt-1">Cancelled</div>
          </div>
          <div className="stat-card text-center">
            <div className="font-heading text-xl font-bold text-slate-300">
              {executedTransactions.length}
            </div>
            <div className="text-slate-500 text-xs mt-1">Executed</div>
          </div>
          <div className="stat-card text-center">
            <div className="font-heading text-xl font-bold gradient-text">
              {transactions.length}
            </div>
            <div className="text-slate-500 text-xs mt-1">Total</div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-700/50">
        {[
          { id: 'queue', label: 'Queue', count: pendingTransactions.length + readyTransactions.length },
          { id: 'history', label: 'History', count: executedTransactions.length },
          { id: 'new', label: 'New Proposal', count: 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-1 justify-center text-sm font-medium
              ${activeTab === tab.id ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'}
            `}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`
                px-1.5 py-0.5 rounded-lg text-xs
                ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}
              `}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator-tx"
                className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/30 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'queue' && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Ready to Execute */}
            {readyTransactions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading font-semibold text-emerald-400 flex items-center gap-2">
                  <FiPlay className="w-4 h-4" />
                  Ready to Execute
                </h3>
                {readyTransactions.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    chamberAddress={chamberAddress}
                    quorum={chamberInfo.quorum || 1}
                    userTokenId={userTokenId}
                    chainId={chainId}
                  />
                ))}
              </div>
            )}

            {/* Pending */}
            {pendingTransactions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading font-semibold text-amber-400 flex items-center gap-2">
                  <FiClock className="w-4 h-4" />
                  Pending Confirmations
                </h3>
                {pendingTransactions.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    chamberAddress={chamberAddress}
                    quorum={chamberInfo.quorum || 1}
                    userTokenId={userTokenId}
                    chainId={chainId}
                  />
                ))}
              </div>
            )}

            {/* Cancelled */}
            {cancelledTransactions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-heading font-semibold text-slate-500 flex items-center gap-2">
                  <FiX className="w-4 h-4" />
                  Cancelled
                </h3>
                {cancelledTransactions.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    chamberAddress={chamberAddress}
                    quorum={chamberInfo.quorum || 1}
                    userTokenId={userTokenId}
                    chainId={chainId}
                  />
                ))}
              </div>
            )}

            {pendingTransactions.length === 0 && readyTransactions.length === 0 && cancelledTransactions.length === 0 && (
              <div className="panel p-12 text-center">
                <FiShield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold text-slate-300 mb-2">
                  No Pending Proposals
                </h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                  Create a proposal with a title and description. Directors can confirm and execute once quorum is reached.
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="btn btn-primary inline-flex"
                >
                  <FiPlus className="w-4 h-4" />
                  New Proposal
                </button>
              </div>
            )}

            {/* Non-director banner when there are pending txs */}
            {userTokenId === undefined && (pendingTransactions.length > 0 || readyTransactions.length > 0 || cancelledTransactions.length > 0) && (
              <div className="panel p-4 border-amber-500/30 bg-amber-500/5">
                <p className="text-amber-400 text-sm">
                  You&apos;re not a director. Delegate shares to an NFT to participate in governance.
                </p>
                <Link
                  to={`/chamber/${chamberAddress}/delegation`}
                  className="text-cyan-400 text-sm hover:underline mt-2 inline-block"
                >
                  Go to Delegation →
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {executedTransactions.length > 0 ? (
              executedTransactions.map((tx) => (
                <TransactionCard
                  key={tx.id}
                  transaction={tx}
                  chamberAddress={chamberAddress}
                  quorum={chamberInfo.quorum || 1}
                  userTokenId={userTokenId}
                  chainId={chainId}
                />
              ))
            ) : (
              <div className="panel p-12 text-center">
                <FiCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold text-slate-300 mb-2">
                  No Transaction History
                </h3>
                <p className="text-slate-500">
                  Executed transactions will appear here
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'new' && (
          <motion.div
            key="new"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <NewTransactionForm
              chamberAddress={chamberAddress}
              userTokenId={userTokenId}
              nextTransactionId={transactionCount}
              onSuccess={() => setActiveTab('queue')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Transaction Card Component
interface TransactionCardProps {
  transaction: Transaction & { status: string; cancelled?: boolean; cancelConfirmations?: number }
  chamberAddress: `0x${string}`
  quorum: number
  userTokenId?: bigint
  chainId: number
}

function TransactionCard({ transaction, chamberAddress, quorum, userTokenId, chainId }: TransactionCardProps) {
  const { confirm, isPending: isConfirming } = useConfirmTransaction(chamberAddress)
  const { execute, isPending: isExecuting } = useExecuteTransaction(chamberAddress)
  const { revoke, isPending: isRevoking } = useRevokeConfirmation(chamberAddress)
  const { cancel, isPending: isCancelling } = useCancelTransaction(chamberAddress)
  const { isConfirmed: userHasConfirmed } = useTransactionConfirmation(
    chamberAddress,
    userTokenId,
    transaction.id
  )
  const { hasVotedToCancel } = useTransactionCancelConfirmation(
    chamberAddress,
    userTokenId,
    transaction.id
  )

  const handleConfirm = async () => {
    if (!userTokenId) {
      toast.error('You must be a director to confirm')
      return
    }
    try {
      await confirm(userTokenId, BigInt(transaction.id))
      toast.success('Confirmation submitted!')
    } catch (err) {
      console.error(err)
      toast.error('Confirmation failed')
    }
  }

  const handleExecute = async () => {
    if (!userTokenId) {
      toast.error('You must be a director to execute')
      return
    }
    try {
      await execute(userTokenId, BigInt(transaction.id))
      toast.success('Execution submitted!')
    } catch (err) {
      console.error(err)
      toast.error('Execution failed')
    }
  }

  const handleRevoke = async () => {
    if (!userTokenId) {
      toast.error('You must be a director to revoke')
      return
    }
    try {
      await revoke(userTokenId, BigInt(transaction.id))
      toast.success('Confirmation revoked!')
    } catch (err) {
      console.error(err)
      toast.error('Revoke failed')
    }
  }

  const handleCancel = async () => {
    if (!userTokenId) {
      toast.error('You must be a director to vote to cancel')
      return
    }
    try {
      await cancel(userTokenId, BigInt(transaction.id))
      toast.success('Cancel vote submitted!')
    } catch (err) {
      console.error(err)
      toast.error('Cancel vote failed')
    }
  }

  const shortTarget = `${transaction.target.slice(0, 10)}...${transaction.target.slice(-8)}`
  const hasData = transaction.data !== '0x'
  const decodedData = hasData ? parseDataField(transaction.data) : null
  const proposalMeta = getProposalMetadata(chamberAddress, transaction.id)
  const displayTitle = proposalMeta?.title || (decodedData?.method || 'Transaction')

  const isCancelled = transaction.cancelled === true

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`panel p-4 ${
        isCancelled
          ? 'opacity-60 border-slate-600/50 bg-slate-800/30'
          : transaction.executed
          ? 'opacity-75'
          : transaction.status === 'ready'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Transaction ID */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
          ${isCancelled
            ? 'bg-slate-600/30 text-slate-500'
            : transaction.executed 
            ? 'bg-slate-500/20 text-slate-500' 
            : transaction.status === 'ready'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400'
          }
        `}>
          #{transaction.id}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-slate-100">{displayTitle}</span>
            <span className="font-mono text-slate-500 text-xs">{shortTarget}</span>
            <a
              href={chainId !== 31337 ? getBlockExplorerAddressUrl(transaction.target, chainId) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-cyan-400"
            >
              <FiExternalLink className="w-3 h-3" />
            </a>
            {transaction.executed && (
              <span className="badge badge-success">
                <FiCheck className="w-3 h-3 mr-1" />
                Executed
              </span>
            )}
            {!transaction.executed && transaction.status === 'ready' && !isCancelled && (
              <span className="badge badge-success">Ready</span>
            )}
            {isCancelled && (
              <span className="badge bg-slate-600/50 text-slate-400 border-slate-500/30">
                <FiX className="w-3 h-3 mr-1" />
                Cancelled
              </span>
            )}
          </div>

          {proposalMeta?.description && (
            <p className="text-slate-400 text-sm mb-2 line-clamp-2">{proposalMeta.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <FiDollarSign className="w-3 h-3" />
              {formatEther(transaction.value)} ETH
            </span>
            {hasData && decodedData && (
              <span className="flex items-center gap-1" title={decodedData.decoded}>
                <FiCode className="w-3 h-3" />
                {decodedData.method}
              </span>
            )}
            <span className="flex items-center gap-1">
              <FiCheck className="w-3 h-3" />
              {transaction.confirmations} / {quorum}
            </span>
            {!isCancelled && !transaction.executed && (transaction.cancelConfirmations ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-400/80">
                <FiX className="w-3 h-3" />
                {transaction.cancelConfirmations} / {quorum} cancel votes
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!transaction.executed && !isCancelled && (
            <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(transaction.confirmations / quorum) * 100}%` }}
                className={`h-full rounded-full ${
                  transaction.status === 'ready'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        {!transaction.executed && !isCancelled && userTokenId !== undefined && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isCancelling || hasVotedToCancel}
              className="btn btn-secondary py-2 px-3 border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200"
              title={hasVotedToCancel ? 'You have voted to cancel' : 'Vote to cancel (requires quorum)'}
            >
              {isCancelling ? (
                <FiLoader className="w-4 h-4 animate-spin" />
              ) : hasVotedToCancel ? (
                <>
                  <FiX className="w-4 h-4" />
                  Voted to cancel
                </>
              ) : (
                <>
                  <FiX className="w-4 h-4" />
                  Cancel
                </>
              )}
            </button>
            {userHasConfirmed && (
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="btn btn-secondary py-2 px-3 border-amber-500/30 hover:border-amber-500/50"
                title="Revoke your confirmation"
              >
                {isRevoking ? (
                  <FiLoader className="w-4 h-4 animate-spin" />
                ) : (
                  'Revoke'
                )}
              </button>
            )}
            {transaction.status !== 'ready' && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming || userHasConfirmed}
                className="btn btn-secondary py-2 px-3"
              >
                {isConfirming ? (
                  <FiLoader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            )}
            {transaction.status === 'ready' && (
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="btn btn-primary py-2 px-3"
              >
                {isExecuting ? (
                  <FiLoader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FiPlay className="w-4 h-4" />
                    Execute
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data Preview */}
      {hasData && decodedData && (
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <div className="text-slate-500 text-xs mb-1">Transaction Data</div>
          <div className="text-slate-300 text-sm font-medium mb-1">{decodedData.method}</div>
          <code className="block text-slate-400 text-xs font-mono bg-slate-800/50 p-2 rounded-lg overflow-x-auto break-all">
            {transaction.data}
          </code>
        </div>
      )}
    </motion.div>
  )
}

// Proposal templates for quick creation
const PROPOSAL_TEMPLATES = [
  { id: 'grant', label: 'Grant', title: 'Grant', description: '', txType: 'eth' as const },
  { id: 'token-payment', label: 'Token Payment', title: 'Token Payment', description: '', txType: 'token' as const },
  { id: 'treasury-transfer', label: 'Treasury Transfer', title: 'Treasury Transfer', description: '', txType: 'eth' as const },
  { id: 'custom', label: 'Custom Call', title: '', description: '', txType: 'custom' as const },
]

// New Transaction Form
interface NewTransactionFormProps {
  chamberAddress: `0x${string}`
  userTokenId?: bigint
  nextTransactionId: number
  onSuccess: () => void
}

// Helper to get placeholder text for different parameter types
function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...'
  if (type.startsWith('uint') || type.startsWith('int')) return '0'
  if (type === 'bool') return 'true or false'
  if (type === 'bytes' || type.startsWith('bytes')) return '0x...'
  if (type === 'string') return 'Enter text...'
  if (type.endsWith('[]')) return 'Comma-separated values or JSON array'
  return 'Enter value...'
}

// Helper to parse function signature and extract parameter info
interface ParsedParam {
  name: string
  type: string
}

function parseFunctionSignature(sig: string): { name: string; params: ParsedParam[] } | null {
  try {
    // Match pattern like "functionName(type1,type2)" or "functionName(type1 name1, type2 name2)"
    const match = sig.match(/^(\w+)\((.*)\)$/)
    if (!match) return null

    const name = match[1]
    const paramsStr = match[2].trim()
    
    if (!paramsStr) {
      return { name, params: [] }
    }

    const params: ParsedParam[] = paramsStr.split(',').map((param, index) => {
      const parts = param.trim().split(/\s+/)
      const type = parts[0]
      const paramName = parts[1] || `param${index}`
      return { name: paramName, type }
    })

    return { name, params }
  } catch {
    return null
  }
}

// Helper to convert input value to the correct type for encoding
function parseParamValue(value: string, type: string): unknown {
  if (type === 'address') {
    return value as `0x${string}`
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    // Handle decimals for common token amounts
    if (value.includes('.')) {
      const decimals = type === 'uint256' ? 18 : 0
      return BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)))
    }
    return BigInt(value)
  }
  if (type === 'bool') {
    return value.toLowerCase() === 'true' || value === '1'
  }
  if (type === 'bytes' || type.startsWith('bytes')) {
    return value as `0x${string}`
  }
  if (type.endsWith('[]')) {
    // Array type - parse as JSON
    try {
      return JSON.parse(value)
    } catch {
      return value.split(',').map(v => v.trim())
    }
  }
  return value
}

function NewTransactionForm({ chamberAddress, userTokenId, nextTransactionId, onSuccess }: NewTransactionFormProps) {
  const { address: userAddress } = useAccount()
  const [txType, setTxType] = useState<'eth' | 'token' | 'custom'>('eth')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [data, setData] = useState('0x')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  
  // Custom transaction state
  const [functionSig, setFunctionSig] = useState('')
  const [parsedFunction, setParsedFunction] = useState<{ name: string; params: ParsedParam[] } | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [sigError, setSigError] = useState<string | null>(null)
  const [encodedData, setEncodedData] = useState<string>('0x')

  const { submit, isPending, isConfirming } = useSubmitTransaction(chamberAddress)

  // Parse function signature when it changes
  useEffect(() => {
    if (!functionSig.trim()) {
      setParsedFunction(null)
      setSigError(null)
      setEncodedData('0x')
      return
    }

    const parsed = parseFunctionSignature(functionSig.trim())
    if (parsed) {
      setParsedFunction(parsed)
      setSigError(null)
      // Reset param values when signature changes
      setParamValues({})
    } else {
      setParsedFunction(null)
      setSigError('Invalid function signature. Example: transfer(address,uint256)')
    }
  }, [functionSig])

  // Encode function data when params change
  useEffect(() => {
    if (!parsedFunction) {
      setEncodedData('0x')
      return
    }

    try {
      // Build the ABI from the signature
      const abiStr = `function ${functionSig}`
      const abi = parseAbi([abiStr])
      
      // Parse all param values
      const args = parsedFunction.params.map((param, index) => {
        const value = paramValues[`param${index}`] || ''
        return parseParamValue(value, param.type)
      })

      // Only encode if all required params have values
      const hasAllParams = parsedFunction.params.every((_, index) => paramValues[`param${index}`]?.trim())
      
      if (hasAllParams || parsedFunction.params.length === 0) {
        const encoded = encodeFunctionData({
          abi: abi as any,
          functionName: parsedFunction.name,
          args,
        })
        setEncodedData(encoded)
        setData(encoded)
      } else {
        setEncodedData('0x')
      }
    } catch (err) {
      console.error('Encoding error:', err)
      setEncodedData('0x')
    }
  }, [parsedFunction, paramValues, functionSig])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userTokenId) {
      toast.error('You must be a director to submit transactions')
      return
    }

    if (!isAddress(target)) {
      toast.error('Invalid target address')
      return
    }

    try {
      let txData = data as `0x${string}`
      let txValue = BigInt(0)

      if (txType === 'eth') {
        txValue = BigInt(parseFloat(value) * 1e18)
        txData = '0x'
      } else if (txType === 'token') {
        // Encode ERC20 transfer call
        txData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [target as `0x${string}`, BigInt(parseFloat(tokenAmount) * 1e18)],
        })
        // Target becomes token address
        await submit(userTokenId, tokenAddress as `0x${string}`, 0n, txData)
        const metaTitle = title.trim() || `Send ${tokenAmount} tokens`
        setProposalMetadata(chamberAddress, nextTransactionId, {
          title: metaTitle,
          description: description.trim() || undefined,
        })
        toast.success('Transaction submitted!')
        onSuccess()
        return
      } else if (txType === 'custom') {
        txValue = value ? BigInt(parseFloat(value) * 1e18) : 0n
        txData = encodedData as `0x${string}`
      }

      await submit(userTokenId, target as `0x${string}`, txValue, txData)
      // Store proposal metadata (title/description) for display
      const metaTitle = title.trim() || (txType === 'eth' ? `Send ${value} ETH` : parsedFunction?.name || 'Custom Transaction')
      setProposalMetadata(chamberAddress, nextTransactionId, {
        title: metaTitle,
        description: description.trim() || undefined,
      })
      toast.success('Transaction submitted!')
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit transaction')
    }
  }

  if (!userTokenId) {
    return (
      <div className="panel p-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="font-heading text-xl font-semibold text-slate-100 mb-2">
          Director Access Required
        </h3>
        <p className="text-slate-400 mb-4">
          You must be a board director to submit transactions.
          Delegate shares to your NFT to become a director.
        </p>
        <div className="text-left bg-slate-800/50 rounded-lg p-4 mt-4 text-xs">
          <div className="text-slate-500 mb-2">Debug Info:</div>
          <div className="font-mono text-slate-400 space-y-1">
            <div>Your Address: {userAddress || 'Not connected'}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="icon-container-accent">
          <FiSend className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-slate-100">New Proposal</h3>
          <p className="text-slate-500 text-xs">Create a proposal for board approval</p>
        </div>
      </div>

      {/* Proposal Templates */}
      <div className="mb-6">
        <label className="block text-slate-300 text-sm font-medium mb-2">Template</label>
        <div className="flex flex-wrap gap-2">
          {PROPOSAL_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                setTxType(tpl.txType)
                if (tpl.title) setTitle(tpl.title)
                if (tpl.description) setDescription(tpl.description)
              }}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                ${txType === tpl.txType
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200 hover:border-slate-600'
                }
              `}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            placeholder="e.g., Grant to Builder X"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">Description (optional)</label>
          <textarea
            placeholder="Context for other directors..."
            className="input min-h-[80px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Transaction Type */}
      <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl mb-6">
        {[
          { id: 'eth', label: 'Send ETH', icon: FiDollarSign },
          { id: 'token', label: 'Send Token', icon: FiHash },
          { id: 'custom', label: 'Custom', icon: FiCode },
        ].map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setTxType(type.id as typeof txType)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition-all
                ${txType === type.id 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {txType === 'token' && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Token Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              className="input font-mono"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              required
            />
          </div>
        )}

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            {txType === 'token' ? 'Recipient Address' : 'Target Address'}
          </label>
          <input
            type="text"
            placeholder="0x..."
            className="input font-mono"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </div>

        {txType === 'eth' && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Amount (ETH)
            </label>
            <input
              type="number"
              placeholder="0.0"
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min="0"
              step="any"
              required
            />
          </div>
        )}

        {txType === 'token' && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Token Amount
            </label>
            <input
              type="number"
              placeholder="0.0"
              className="input"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              min="0"
              step="any"
              required
            />
          </div>
        )}

        {txType === 'custom' && (
          <>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                ETH Value (optional)
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min="0"
                step="any"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Function Signature
              </label>
              <input
                type="text"
                placeholder="e.g., transfer(address,uint256) or mint(address to, uint256 amount)"
                className={`input font-mono ${sigError ? 'border-red-500/50' : ''}`}
                value={functionSig}
                onChange={(e) => setFunctionSig(e.target.value)}
              />
              {sigError && (
                <p className="text-red-400 text-xs mt-1">{sigError}</p>
              )}
              <p className="text-slate-500 text-xs mt-1">
                Enter the function signature with parameter types (and optional names)
              </p>
            </div>

            {/* Dynamic Parameter Inputs */}
            {parsedFunction && parsedFunction.params.length > 0 && (
              <div className="space-y-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">
                  Function Parameters
                </div>
                {parsedFunction.params.map((param, index) => (
                  <div key={index}>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      <span className="text-cyan-400">{param.type}</span>
                      <span className="text-slate-500 ml-2">{param.name}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={getPlaceholder(param.type)}
                      className="input font-mono"
                      value={paramValues[`param${index}`] || ''}
                      onChange={(e) => setParamValues(prev => ({
                        ...prev,
                        [`param${index}`]: e.target.value
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Encoded Data Preview */}
            {encodedData && encodedData !== '0x' && (
              <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                    Encoded Transaction Data
                  </span>
                  <span className="badge badge-success text-xs">Valid</span>
                </div>
                <code className="block text-slate-400 text-xs font-mono bg-slate-900/50 p-2 rounded-lg overflow-x-auto break-all">
                  {encodedData}
                </code>
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="btn btn-primary w-full py-3"
        >
          {isPending || isConfirming ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              {isPending ? 'Confirm in Wallet...' : 'Submitting...'}
            </>
          ) : (
            <>
              <FiSend className="w-4 h-4" />
              Submit Transaction
            </>
          )}
        </button>
      </form>
    </div>
  )
}
