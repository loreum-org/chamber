import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContracts } from 'wagmi'
import { formatEther, isAddress, encodeFunctionData } from 'viem'
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
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useChamberInfo,
  useBoardMembers,
  useSubmitTransaction,
  useConfirmTransaction,
  useExecuteTransaction,
} from '@/hooks'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import type { Transaction } from '@/types'

type TabType = 'queue' | 'history' | 'new'

export default function TransactionQueue() {
  const { address } = useParams<{ address: string }>()
  const chamberAddress = address as `0x${string}`
  useAccount()
  
  const [activeTab, setActiveTab] = useState<TabType>('queue')
  const [transactions, setTransactions] = useState<(Transaction & { status: string })[]>([])
  
  const chamberInfo = useChamberInfo(chamberAddress)
  const { members } = useBoardMembers(chamberAddress, chamberInfo.seats || 5)

  // Fetch all transactions
  const transactionCount = chamberInfo.transactionCount || 0
  const transactionIds = Array.from({ length: transactionCount }, (_, i) => i)
  
  const { data: transactionsData } = useReadContracts({
    contracts: transactionIds.map(id => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction',
      args: [BigInt(id)],
    })),
  })

  useEffect(() => {
    if (transactionsData) {
      const txs: (Transaction & { status: string })[] = []
      transactionsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [executed, confirmations, target, value, data] = result.result as [boolean, number, `0x${string}`, bigint, `0x${string}`]
          const status = executed ? 'executed' : confirmations >= (chamberInfo.quorum || 1) ? 'ready' : 'pending'
          txs.push({
            id: index,
            executed,
            confirmations,
            target,
            value,
            data,
            status,
          })
        }
      })
      setTransactions(txs)
    }
  }, [transactionsData, chamberInfo.quorum])

  const pendingTransactions = transactions.filter(tx => !tx.executed && tx.status !== 'ready')
  const readyTransactions = transactions.filter(tx => !tx.executed && tx.status === 'ready')
  const executedTransactions = transactions.filter(tx => tx.executed)

  // Check if user is a director
  const userTokenId = members.find(m => chamberInfo.directors?.includes(m.owner as `0x${string}`))?.tokenId

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
                Transaction Queue
              </h1>
              <p className="text-slate-500 text-sm">
                {chamberInfo.name} • {chamberInfo.quorum} of {chamberInfo.seats} required
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('new')}
            className="btn btn-primary"
          >
            <FiPlus className="w-4 h-4" />
            New Transaction
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/30">
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
          { id: 'new', label: 'New Transaction', count: 0 },
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
                  />
                ))}
              </div>
            )}

            {pendingTransactions.length === 0 && readyTransactions.length === 0 && (
              <div className="panel p-12 text-center">
                <FiShield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold text-slate-300 mb-2">
                  No Pending Transactions
                </h3>
                <p className="text-slate-500 mb-6">
                  Create a new transaction to manage treasury assets
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="btn btn-primary inline-flex"
                >
                  <FiPlus className="w-4 h-4" />
                  New Transaction
                </button>
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
  transaction: Transaction & { status: string }
  chamberAddress: `0x${string}`
  quorum: number
  userTokenId?: bigint
}

function TransactionCard({ transaction, chamberAddress, quorum, userTokenId }: TransactionCardProps) {
  const { confirm, isPending: isConfirming } = useConfirmTransaction(chamberAddress)
  const { execute, isPending: isExecuting } = useExecuteTransaction(chamberAddress)

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

  const shortTarget = `${transaction.target.slice(0, 10)}...${transaction.target.slice(-8)}`
  const hasData = transaction.data !== '0x'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`panel p-4 ${
        transaction.executed
          ? 'opacity-75'
          : transaction.status === 'ready'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Transaction ID */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold
          ${transaction.executed 
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
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-slate-100">{shortTarget}</span>
            <a
              href={`https://etherscan.io/address/${transaction.target}`}
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
            {!transaction.executed && transaction.status === 'ready' && (
              <span className="badge badge-success">Ready</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <FiDollarSign className="w-3 h-3" />
              {formatEther(transaction.value)} ETH
            </span>
            {hasData && (
              <span className="flex items-center gap-1">
                <FiCode className="w-3 h-3" />
                Contract Call
              </span>
            )}
            <span className="flex items-center gap-1">
              <FiCheck className="w-3 h-3" />
              {transaction.confirmations} / {quorum}
            </span>
          </div>

          {/* Progress bar */}
          {!transaction.executed && (
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
        {!transaction.executed && userTokenId !== undefined && (
          <div className="flex items-center gap-2">
            {transaction.status !== 'ready' && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
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
      {hasData && (
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <div className="text-slate-500 text-xs mb-1">Transaction Data</div>
          <code className="block text-slate-400 text-xs font-mono bg-slate-800/50 p-2 rounded-lg overflow-x-auto">
            {transaction.data.slice(0, 66)}...
          </code>
        </div>
      )}
    </motion.div>
  )
}

// New Transaction Form
interface NewTransactionFormProps {
  chamberAddress: `0x${string}`
  userTokenId?: bigint
  onSuccess: () => void
}

function NewTransactionForm({ chamberAddress, userTokenId, onSuccess }: NewTransactionFormProps) {
  const [txType, setTxType] = useState<'eth' | 'token' | 'custom'>('eth')
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [data, setData] = useState('0x')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')

  const { submit, isPending, isConfirming } = useSubmitTransaction(chamberAddress)

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
        toast.success('Transaction submitted!')
        onSuccess()
        return
      }

      await submit(userTokenId, target as `0x${string}`, txValue, txData)
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
          <h3 className="font-heading font-semibold text-slate-100">New Transaction</h3>
          <p className="text-slate-500 text-xs">Create a new multisig transaction</p>
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
                ETH Value
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
                Transaction Data (hex)
              </label>
              <textarea
                placeholder="0x..."
                className="input font-mono h-24 resize-none"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
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
