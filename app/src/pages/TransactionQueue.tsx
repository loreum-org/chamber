import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContracts } from 'wagmi'
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
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  useChamberInfo,
  useBoardMembers,
  useSubmitTransaction,
  useConfirmTransaction,
  useExecuteTransaction,
  useChamberEvents,
} from '@/hooks'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import type { Transaction } from '@/types'

type TabType = 'queue' | 'history' | 'new'

export default function TransactionQueue() {
  const { address } = useParams<{ address: string }>()
  const chamberAddress = address as `0x${string}`
  const { address: userAddress } = useAccount()
  
  const [activeTab, setActiveTab] = useState<TabType>('queue')
  const [transactions, setTransactions] = useState<(Transaction & { status: string })[]>([])
  
  const chamberInfo = useChamberInfo(chamberAddress)
  const { members } = useBoardMembers(chamberAddress, chamberInfo.seats || 5)

  // Fetch all transactions
  const transactionCount = chamberInfo.transactionCount || 0
  const transactionIds = Array.from({ length: transactionCount }, (_, i) => i)
  
  const { data: transactionsData, refetch: refetchTransactions } = useReadContracts({
    contracts: transactionIds.map(id => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransaction',
      args: [BigInt(id)],
    })),
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

function NewTransactionForm({ chamberAddress, userTokenId, onSuccess }: NewTransactionFormProps) {
  const { address: userAddress } = useAccount()
  const [txType, setTxType] = useState<'eth' | 'token' | 'custom'>('eth')
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
          abi,
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
        toast.success('Transaction submitted!')
        onSuccess()
        return
      } else if (txType === 'custom') {
        txValue = value ? BigInt(parseFloat(value) * 1e18) : 0n
        txData = encodedData as `0x${string}`
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
