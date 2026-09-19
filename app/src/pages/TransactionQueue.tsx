import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContracts, useChainId, useReadContract } from 'wagmi'
import { formatEther, isAddress, encodeFunctionData, parseAbi, parseEther, parseUnits } from 'viem'
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
  FiUsers,
  FiX,
  FiChevronDown,
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
  useReceiptRefresh,
  useSeatUpdate,
  useUpdateSeats,
  useExecuteSeatsUpdate,
  useCancelSeatUpdate,
  useDirectorActionGate,
  useUserNFTs,
  useChamberRegistryImplementationSync,
  useProposalCalldata,
  queueWriteErrorMessage,
  queueWritePendingLabel,
  queueWriteSuccessMessage,
  type QueueWriteKind,
} from '@/hooks'
import { chamberAbi, erc20Abi } from '@/contracts/abis'
import {
  formatWalletSendError,
  getBlockExplorerAddressUrl,
  getBlockExplorerTxUrl,
  hasProposalCalldata,
  shortenAddress,
} from '@/lib/utils'
import { ChamberRouteGate } from '@/components/ChamberRouteGate'
import { DirectorCallerStatus } from '@/components/DirectorCallerStatus'
import {
  UPGRADE_SELECTOR,
  PAUSE_SELECTOR,
  UNPAUSE_SELECTOR,
  SEAT_UPDATE_TIMELOCK_SEC,
  SEAT_UPDATE_EXPIRY_SEC,
  DEFAULT_TRANSACTION_MAX_AGE_SEC,
  isProposalDeadlineUrgent,
  isAllowedChamberSelfCall,
  isChamberSelfCall,
  isUnpauseCall,
  selectorOf,
  requiredExecuteConfirmations,
  computeQueueTxStatus,
} from '@/lib/chamberGovernance'
import type { TransactionQueueItem } from '@/types'
import {
  createProposalMetadataURI,
  getProposalMetadata,
  parseProposalMetadataURI,
  setProposalMetadata,
} from '@/lib/proposalMetadata'
import {
  decodeProposalAction,
  normalizeCalldataHex,
  proposalCalldataMatchesHash,
  setStoredProposalCalldata,
} from '@/lib/proposalCalldata'
import type { SeatUpdate } from '@/types'

type TabType = 'queue' | 'history' | 'new'

type RiskLevel = 'low' | 'medium' | 'high'

type QueueWriteFlight = {
  kind: QueueWriteKind
  hash?: `0x${string}`
}

type QueueWriteReporters = {
  onWriteStart: (kind: QueueWriteKind) => void
  onWriteSent: (hash: `0x${string}`, kind: QueueWriteKind) => void
  onWriteClear: () => void
}

const MAX_BOARD_SEATS = 20

function tokenHasLiveConfirmation(
  txId: number,
  tokenId: bigint | undefined,
  directorTokenIds: readonly bigint[],
  rows: readonly { status: string; result?: unknown }[] | undefined,
): boolean {
  if (tokenId === undefined || !rows || directorTokenIds.length === 0) return false
  const directorIndex = directorTokenIds.findIndex((id) => id === tokenId)
  if (directorIndex < 0) return false
  const row = rows[txId * directorTokenIds.length + directorIndex]
  return row?.status === 'success' && row.result === true
}

function queueHeaderCta(needsYourConfirmation: number, readyToExecute: number): string {
  if (needsYourConfirmation > 0) {
    return needsYourConfirmation === 1
      ? '1 proposal needs your confirmation.'
      : `${needsYourConfirmation} proposals need your confirmation.`
  }
  if (readyToExecute > 0) {
    return readyToExecute === 1
      ? '1 proposal is ready to execute.'
      : `${readyToExecute} proposals are ready to execute.`
  }
  return 'Nothing needs you right now.'
}

function PendingTxBanner({
  kind,
  hash,
  chainId,
}: {
  kind: QueueWriteKind
  hash?: `0x${string}`
  chainId: number
}) {
  const phase = hash ? 'chain' : 'wallet'
  const explorerUrl = hash && chainId !== 31337 ? getBlockExplorerTxUrl(hash, chainId) : undefined

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-start gap-2">
        <FiLoader className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-amber-400" />
        <div className="min-w-0">
          <p>{queueWritePendingLabel(kind, phase)}</p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 hover:underline inline-flex items-center gap-1 mt-1"
            >
              View on explorer
              <FiExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function classifyTransactionRisk(chamberAddress: `0x${string}`, target: `0x${string}`, value: bigint, data: `0x${string}`) {
  const isSelfCall = isChamberSelfCall(chamberAddress, target)
  const selector = selectorOf(data)
  const isUpgrade = isSelfCall && selector === UPGRADE_SELECTOR
  const isPause = isSelfCall && selector === PAUSE_SELECTOR
  const isUnpause = isSelfCall && selector === UNPAUSE_SELECTOR
  const hasUnknownCallData = data !== '0x' && !isUpgrade && !isPause && !isUnpause
  const sendsEth = value > 0n

  if (isUpgrade) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: protocol upgrade',
      summary: 'Changes Chamber implementation. Confirm implementation address, audit status, and migration notes before approval.',
    }
  }

  if (isPause) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: pause vault',
      summary: 'Halts deposits, withdrawals, and wallet execute until the board unpauses.',
    }
  }

  if (isUnpause) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: unpause vault',
      summary: 'Restores deposits, withdrawals, and wallet execute after a pause.',
    }
  }

  if (isSelfCall) {
    return {
      level: 'high' as RiskLevel,
      label: 'Invalid: Chamber self-call',
      summary: 'The wallet queue rejects Chamber self-calls except upgrades. Use the Board seats panel for seat changes.',
    }
  }

  if (sendsEth && hasUnknownCallData) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: ETH + contract call',
      summary: 'Transfers ETH while executing calldata. Review the target contract and decoded selector carefully.',
    }
  }

  if (sendsEth || hasUnknownCallData) {
    return {
      level: 'medium' as RiskLevel,
      label: sendsEth ? 'Medium risk: treasury transfer' : 'Medium risk: contract call',
      summary: sendsEth
        ? 'Moves treasury ETH. Verify recipient, amount, and proposal rationale.'
        : 'Executes calldata on an external contract. Verify function selector and target contract.',
    }
  }

  return {
    level: 'low' as RiskLevel,
    label: 'Low risk: no calldata',
    summary: 'Plain transaction with no calldata. Still verify recipient and amount before approval.',
  }
}

/** Risk summary when `getTransaction` only returns `dataHash` (no preimage in RPC). */
function classifyTransactionRiskFromDataHash(
  chamberAddress: `0x${string}`,
  target: `0x${string}`,
  value: bigint,
  dataHash: `0x${string}`
) {
  const isSelfCall = target.toLowerCase() === chamberAddress.toLowerCase()
  const hasCalldata = hasProposalCalldata(dataHash)
  const sendsEth = value > 0n

  if (isSelfCall && !hasCalldata) {
    return {
      level: 'high' as RiskLevel,
      label: 'Invalid: Chamber self-call',
      summary:
        'The wallet queue rejects Chamber self-calls except upgrades. Use the Board seats panel for seat changes.',
    }
  }

  if (isSelfCall && hasCalldata) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: Chamber self-call',
      summary:
        'Calls this Chamber from the treasury queue. Verify calldata matches the intended action (e.g. upgrade) before approving.',
    }
  }

  if (sendsEth && hasCalldata) {
    return {
      level: 'high' as RiskLevel,
      label: 'High risk: ETH + contract call',
      summary:
        'Sends ETH with contract calldata. Review target, amount, and the exact calldata used at execution.',
    }
  }

  if (sendsEth || hasCalldata) {
    return {
      level: 'medium' as RiskLevel,
      label: sendsEth ? 'Medium risk: treasury transfer' : 'Medium risk: contract call',
      summary: sendsEth
        ? 'Moves treasury ETH. Verify recipient and amount before approval.'
        : 'Executes calldata on an external contract. The proposer must share the exact hex for execution.',
    }
  }

  return {
    level: 'low' as RiskLevel,
    label: 'Low risk: no calldata',
    summary: 'Plain ETH transfer with no calldata. Still verify recipient and amount.',
  }
}

export default function TransactionQueue() {
  const { address } = useParams<{ address: string }>()
  return (
    <ChamberRouteGate address={address}>
      {(chamberAddress) => <TransactionQueueContent chamberAddress={chamberAddress} />}
    </ChamberRouteGate>
  )
}

function TransactionQueueContent({ chamberAddress }: { chamberAddress: `0x${string}` }) {
  const { address: userAddress } = useAccount()
  const chainId = useChainId()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<TabType>('queue')
  const [inFlight, setInFlight] = useState<QueueWriteFlight | null>(null)
  type QueueTx = TransactionQueueItem & {
    cancelled?: boolean
    cancelConfirmations?: number
    metadataURI?: string
    leftoverTokenId?: bigint
  }

  const [transactions, setTransactions] = useState<QueueTx[]>([])
  
  const chamberInfo = useChamberInfo(chamberAddress)
  const implSync = useChamberRegistryImplementationSync(chamberAddress)
  const { members, isFetched: boardFetched } = useBoardMembers(chamberAddress, chamberInfo.seats || 5)
  const boardEmpty = boardFetched && members.length === 0
  const { seatUpdate, refetch: refetchSeatUpdate } = useSeatUpdate(chamberAddress)
  const { tokenIds: ownedTokenIds } = useUserNFTs(chamberInfo.nftToken, userAddress, {
    chamberAddress,
  })
  const directorGate = useDirectorActionGate(
    chamberAddress,
    userAddress,
    chamberInfo.directors,
    members,
  )
  const canAct = directorGate.canAct
  const userTokenId = directorGate.tokenId

  const upgradeProposalIntent = searchParams.get('proposal') === 'upgrade'
  const registryUpgradeDraft =
    upgradeProposalIntent &&
    implSync.implMismatch &&
    implSync.registryImplementation
      ? ({
          newImplementation: implSync.registryImplementation,
          chamberVersionLabel: implSync.chamberVersionLabel,
          registryVersionLabel: implSync.registryImplementationVersionLabel,
        } as const)
      : undefined

  const upgradeProposalHandledRef = useRef(false)
  useEffect(() => {
    if (!upgradeProposalIntent) {
      upgradeProposalHandledRef.current = false
      return
    }
    if (implSync.isLoading || upgradeProposalHandledRef.current) return

    upgradeProposalHandledRef.current = true

    if (!registryUpgradeDraft?.newImplementation) {
      toast('This chamber already matches the Registry’s default implementation.', { duration: 4500 })
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('proposal')
          return next
        },
        { replace: true },
      )
      return
    }

    setActiveTab('new')
  }, [
    upgradeProposalIntent,
    implSync.isLoading,
    registryUpgradeDraft?.newImplementation,
    registryUpgradeDraft,
    setSearchParams,
  ])

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

  const { data: metadataData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransactionMetadata',
      args: [BigInt(id)],
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'getTransactionMetadata'; args: [bigint] }[],
    query: {
      enabled: transactionCount > 0,
    },
  })

  const directorTokenKey = members.map((m) => m.tokenId.toString()).join(',')
  const directorTokenIds = useMemo(
    () => (directorTokenKey ? directorTokenKey.split(',').map((id) => BigInt(id)) : []),
    [directorTokenKey],
  )
  const ownedTokenKey = ownedTokenIds.map((id) => id.toString()).join(',')
  const ownedTokenIdsStable = useMemo(
    () => (ownedTokenKey ? ownedTokenKey.split(',').map((id) => BigInt(id)) : []),
    [ownedTokenKey],
  )

  const { data: requiredQuorumData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransactionRequiredQuorum' as const,
      args: [BigInt(id)] as const,
    })),
    query: { enabled: transactionCount > 0, retry: false },
  })

  const { data: expiredData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'isTransactionExpired' as const,
      args: [BigInt(id)] as const,
    })),
    query: { enabled: transactionCount > 0, retry: false },
  })

  const { data: deadlineData } = useReadContracts({
    contracts: transactionIds.map((id) => ({
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'getTransactionDeadline' as const,
      args: [BigInt(id)] as const,
    })),
    query: { enabled: transactionCount > 0, retry: false },
  })

  const { data: liveConfirmData } = useReadContracts({
    contracts: transactionIds.flatMap((id) =>
      directorTokenIds.map((tokenId) => ({
        address: chamberAddress,
        abi: chamberAbi,
        functionName: 'getConfirmation' as const,
        args: [tokenId, BigInt(id)] as const,
      })),
    ),
    query: { enabled: transactionCount > 0 && directorTokenIds.length > 0 },
  })

  const { data: leftoverConfirmData } = useReadContracts({
    contracts: transactionIds.flatMap((id) =>
      ownedTokenIdsStable.map((tokenId) => ({
        address: chamberAddress,
        abi: chamberAbi,
        functionName: 'getConfirmation' as const,
        args: [tokenId, BigInt(id)] as const,
      })),
    ),
    query: { enabled: transactionCount > 0 && ownedTokenIdsStable.length > 0 },
  })

  // Event watches are a fast path only. Receipt + refetch below is the source of truth.
  useChamberEvents(chamberAddress, {
    onTransactionEvent: () => {
      refetchTransactions()
    },
    onBoardEvent: () => {
      refetchSeatUpdate()
    },
  })

  const startQueueWrite = (kind: QueueWriteKind) => {
    setInFlight({ kind })
  }
  const sentQueueWrite = (hash: `0x${string}`, kind: QueueWriteKind) => {
    setInFlight({ kind, hash })
  }
  const clearQueueWrite = () => {
    setInFlight(null)
  }
  const writeReporters: QueueWriteReporters = {
    onWriteStart: startQueueWrite,
    onWriteSent: sentQueueWrite,
    onWriteClear: clearQueueWrite,
  }

  useReceiptRefresh({
    chamberAddress,
    hash: inFlight?.hash,
    successMessage: inFlight ? queueWriteSuccessMessage(inFlight.kind) : 'Transaction confirmed',
    errorMessage: inFlight ? queueWriteErrorMessage(inFlight.kind) : 'Transaction failed',
    onSuccess: () => {
      const kind = inFlight?.kind
      setInFlight(null)
      if (kind === 'submit' || kind === 'upgrade' || kind === 'seat-propose') {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('proposal')
            return next
          },
          { replace: true },
        )
        setActiveTab('queue')
      }
      void chamberInfo.refetchTransactionCount()
      void refetchTransactions()
      void refetchSeatUpdate()
    },
    onError: () => {
      setInFlight(null)
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

      const metadataList: string[] = []
      metadataData?.forEach((r: { status: string; result?: unknown }, i: number) => {
        metadataList[i] = r.status === 'success' && typeof r.result === 'string' ? r.result : ''
      })

      const liveQuorum = chamberInfo.quorum || 1
      const directorCount = directorTokenIds.length
      const ownedCount = ownedTokenIdsStable.length

      const txs: QueueTx[] = []
      transactionsData.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [executed, confirmations, target, value, dataHash] = result.result as [
            boolean,
            number,
            `0x${string}`,
            bigint,
            `0x${string}`,
          ]
          const cancelled = cancelledList[index] ?? false
          const snapshotResult = requiredQuorumData?.[index]
          const snapshot =
            snapshotResult?.status === 'success' && snapshotResult.result !== undefined
              ? Number(snapshotResult.result)
              : undefined
          const required = requiredExecuteConfirmations(snapshot, liveQuorum)

          let liveConfirmations = 0
          if (directorCount > 0 && liveConfirmData) {
            const offset = index * directorCount
            for (let i = 0; i < directorCount; i++) {
              const row = liveConfirmData[offset + i]
              if (row?.status === 'success' && row.result === true) liveConfirmations += 1
            }
          } else {
            liveConfirmations = confirmations
          }

          const expiredResult = expiredData?.[index]
          const expired =
            expiredResult?.status === 'success' ? expiredResult.result === true : false
          const deadlineResult = deadlineData?.[index]
          const deadline =
            deadlineResult?.status === 'success' && typeof deadlineResult.result === 'bigint'
              ? deadlineResult.result
              : undefined

          let leftoverTokenId: bigint | undefined
          if (ownedCount > 0 && leftoverConfirmData) {
            const offset = index * ownedCount
            for (let i = 0; i < ownedCount; i++) {
              const row = leftoverConfirmData[offset + i]
              if (row?

... [OUTPUT TRUNCATED - 59,988 chars omitted out of 109,914 total] ...

ll

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
    if (value.includes('.')) {
      // Use parseUnits for decimal input to avoid float precision loss
      try {
        return parseUnits(value, 18)
      } catch {
        return BigInt(Math.trunc(Number(value)))
      }
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

function NewTransactionForm({
  chamberAddress,
  userTokenId,
  nextTransactionId,
  currentSeats,
  hasSeatProposal,
  boardEmpty,
  registryUpgradeDraft,
  onWriteStart,
  onWriteSent,
  onWriteClear,
}: NewTransactionFormProps) {
  const chainId = useChainId()
  const [proposalType, setProposalType] = useState<'transaction' | 'seats'>('transaction')
  const [txType, setTxType] = useState<'eth' | 'token' | 'custom'>('eth')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('')
  const [data, setData] = useState('0x')
  const [tokenAddress, setTokenAddress] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  const [seatDraft, setSeatDraft] = useState(String(currentSeats))

  // Fetch decimals for the token being proposed — avoids hardcoding 18
  const { data: tokenDecimalsData } = useReadContract({
    address: isAddress(tokenAddress) ? tokenAddress as `0x${string}` : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: isAddress(tokenAddress) },
  })
  const tokenDecimals = typeof tokenDecimalsData === 'number' ? tokenDecimalsData : 18
  
  // Custom transaction state
  const [functionSig, setFunctionSig] = useState('')
  const [parsedFunction, setParsedFunction] = useState<{ name: string; params: ParsedParam[] } | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [sigError, setSigError] = useState<string | null>(null)
  const [encodedData, setEncodedData] = useState<string>('0x')

  const { submit, isPending, isConfirming, hash: submitHash } = useSubmitTransaction(chamberAddress)
  const {
    updateSeats: proposeSeats,
    isPending: isSeatPending,
    isConfirming: isSeatConfirming,
    hash: seatHash,
  } = useUpdateSeats(chamberAddress)

  const previewTarget = (txType === 'token' ? tokenAddress : target) as `0x${string}`
  const previewValue = txType === 'eth' && value ? (() => { try { return parseEther(value) } catch { return 0n } })() : 0n
  const previewData = txType === 'custom' ? (encodedData as `0x${string}`) : txType === 'token' ? (data as `0x${string}`) : '0x'
  const previewRisk = proposalType === 'transaction' && isAddress(previewTarget)
    ? classifyTransactionRisk(chamberAddress, previewTarget, previewValue, previewData)
    : null
  const busy = isPending || isConfirming || isSeatPending || isSeatConfirming

  const registryUpgradePrefilledRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!registryUpgradeDraft?.newImplementation) {
      registryUpgradePrefilledRef.current = undefined
      return
    }
    const impl = registryUpgradeDraft.newImplementation
    if (registryUpgradePrefilledRef.current === impl) return
    registryUpgradePrefilledRef.current = impl

    setProposalType('transaction')
    setTxType('custom')
    setTarget(chamberAddress)
    setValue('0')

    const regV = registryUpgradeDraft.registryVersionLabel
    const curV = registryUpgradeDraft.chamberVersionLabel
    setTitle(`Upgrade Chamber to Registry implementation${regV ? ` v${regV}` : ''}`)
    setDescription(
      `Multisig: upgradeImplementation(${impl}, 0x). Current proxy implementation VERSION reports ${curV ?? 'unknown'}. Confirm audit status and migrations before approving; init calldata left empty.`,
    )
    setFunctionSig('upgradeImplementation(address,bytes)')
  }, [
    chamberAddress,
    registryUpgradeDraft?.newImplementation,
    registryUpgradeDraft?.registryVersionLabel,
    registryUpgradeDraft?.chamberVersionLabel,
    registryUpgradeDraft,
  ])

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

  // After Registry-upgrade prefill parses, repopulate params (signature effect resets param maps).
  useEffect(() => {
    const impl = registryUpgradeDraft?.newImplementation
    if (!impl) return
    if (parsedFunction?.name !== 'upgradeImplementation') return
    setParamValues({ param0: impl, param1: '0x' })
  }, [registryUpgradeDraft?.newImplementation, parsedFunction])

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
        // parseAbi returns a fully validated ABI; cast needed for dynamic function names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (userTokenId === undefined) {
      toast.error('You must be a director to submit transactions')
      return
    }

    if (proposalType === 'seats') {
      if (hasSeatProposal) {
        toast.error('A board seat proposal is already active. Support or execute it from the queue.')
        return
      }
      const n = Number(seatDraft)
      if (!Number.isInteger(n) || n < 1) {
        toast.error('Invalid seat count')
        return
      }
      if (n > MAX_BOARD_SEATS) {
        toast.error(`Seat count cannot exceed ${MAX_BOARD_SEATS}`)
        return
      }
      if (n === currentSeats) {
        toast.error('Choose a different seat count than the current configuration')
        return
      }

      onWriteStart('seat-propose')
      try {
        const hash = await proposeSeats(userTokenId, BigInt(n))
        if (hash) onWriteSent(hash, 'seat-propose')
        else onWriteClear()
      } catch (err) {
        console.error(err)
        onWriteClear()
        toast.error(formatWalletSendError(err, 'Board proposal failed'))
      }
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
        try {
          txValue = parseEther(value)
        } catch {
          toast.error('Invalid ETH amount')
          return
        }
        txData = '0x'
      } else if (txType === 'token') {
        if (!isAddress(tokenAddress)) {
          toast.error('Invalid token contract address')
          return
        }
        let parsedTokenAmount: bigint
        try {
          parsedTokenAmount = parseUnits(tokenAmount, tokenDecimals ?? 18)
        } catch {
          toast.error('Invalid token amount')
          return
        }
        // Encode ERC20 transfer call
        txData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [target as `0x${string}`, parsedTokenAmount],
        })
        if (!isAllowedChamberSelfCall(chamberAddress, tokenAddress, txData)) {
          toast.error('Chamber self-calls are only allowed for upgrades. Use the Board seats panel for seat changes.')
          return
        }
        // Target becomes token address
        const metaTitle = title.trim() || `Send ${tokenAmount} tokens`
        const metadata = {
          title: metaTitle,
          description: description.trim() || undefined,
          templateId: txType,
          target: tokenAddress,
          valueEth: '0',
          functionName: 'transfer',
          calldata: txData,
          riskLevel: 'medium' as RiskLevel,
          riskSummary: 'Token transfer proposal. Verify token contract, recipient, amount, and treasury balance.',
        }
        const metadataURI = createProposalMetadataURI(metadata)
        onWriteStart('submit')
        const hash = await submit(userTokenId, tokenAddress as `0x${string}`, 0n, txData, metadataURI)
        setStoredProposalCalldata(chamberAddress, nextTransactionId, txData)
        setProposalMetadata(chamberAddress, nextTransactionId, { ...metadata, metadataURI })
        if (hash) onWriteSent(hash, 'submit')
        else onWriteClear()
        return
      } else if (txType === 'custom') {
        try {
          txValue = value ? parseEther(value) : 0n
        } catch {
          toast.error('Invalid ETH value')
          return
        }
        txData = encodedData as `0x${string}`
      }

      if (!isAllowedChamberSelfCall(chamberAddress, target, txData)) {
        toast.error('Chamber self-calls are only allowed for upgrades. Use the Board seats panel for seat changes.')
        return
      }

      // Store proposal metadata (title/description) for display
      const metaTitle = title.trim() || (txType === 'eth' ? `Send ${value} ETH` : parsedFunction?.name || 'Custom Transaction')
      const risk = classifyTransactionRisk(chamberAddress, target as `0x${string}`, txValue, txData)
      const metadata = {
        title: metaTitle,
        description: description.trim() || undefined,
        templateId: txType,
        target,
        valueEth: formatEther(txValue),
        functionName: txType === 'custom' ? parsedFunction?.name : undefined,
        calldata: txData !== '0x' ? txData : undefined,
        riskLevel: risk.level,
        riskSummary: risk.summary,
      }
      const metadataURI = createProposalMetadataURI(metadata)
      const writeKind: QueueWriteKind =
        parsedFunction?.name === 'upgradeImplementation' || selectorOf(txData) === UPGRADE_SELECTOR
          ? 'upgrade'
          : 'submit'
      onWriteStart(writeKind)
      const hash = await submit(userTokenId, target as `0x${string}`, txValue, txData, metadataURI)
      if (txData !== '0x') {
        setStoredProposalCalldata(chamberAddress, nextTransactionId, txData)
      }
      setProposalMetadata(chamberAddress, nextTransactionId, { ...metadata, metadataURI })
      if (hash) onWriteSent(hash, writeKind)
      else onWriteClear()
    } catch (err) {
      console.error(err)
      onWriteClear()
      toast.error(formatWalletSendError(err, 'Failed to submit transaction'))
    }
  }

  if (userTokenId === undefined) {
    return (
      <NewProposalDirectorGate
        chamberAddress={chamberAddress}
        boardEmpty={boardEmpty}
      />
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
          <p className="text-slate-500 text-xs">Create a treasury, contract, or board proposal</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {[
          {
            id: 'transaction',
            icon: FiDollarSign,
            title: 'Treasury / contract proposal',
            description: 'Submit a wallet transaction for director confirmation.',
          },
          {
            id: 'seats',
            icon: FiUsers,
            title: 'Board seat change',
            description: 'Use the Chamber native seat proposal and timelock flow.',
          },
        ].map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setProposalType(type.id as typeof proposalType)}
              className={`
                text-left rounded-xl border p-4 transition-all
                ${proposalType === type.id
                  ? 'bg-accent-500/20 text-accent-400 border-accent-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200 hover:border-slate-600'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{type.title}</div>
                  <p className="text-xs text-slate-500 mt-1">{type.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {proposalType === 'seats' ? (
          <>
            <div className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4">
              <div className="flex items-start gap-3">
                <FiUsers className="w-5 h-5 text-accent-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-slate-100 text-sm">Board Proposal</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Directors propose and support seat changes directly. Once quorum is reached, execution unlocks after the 7-day timelock. The proposer can cancel anytime; any current director can cancel after 14 days.
                  </p>
                </div>
              </div>
            </div>

            {hasSeatProposal && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
                A board seat proposal is already active. Return to the queue to support or execute it.
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-slate-300 text-sm font-medium">Proposed seat count</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSeatDraft((s) => String(Math.max(1, Number(s) - 1)))}
                  disabled={busy || Number(seatDraft) <= 1}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors text-xl font-bold disabled:opacity-40"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="font-heading text-3xl font-bold text-slate-100">{seatDraft}</span>
                  <span className="text-slate-500 text-sm ml-2">seats</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSeatDraft((s) => String(Math.min(MAX_BOARD_SEATS, Number(s) + 1)))}
                  disabled={busy || Number(seatDraft) >= MAX_BOARD_SEATS}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors text-xl font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p className="text-slate-500 text-xs">
                Current seats: <span className="text-slate-300 font-mono">{currentSeats}</span>. Maximum seats: {MAX_BOARD_SEATS}.
              </p>
            </div>
          </>
        ) : (
          <>
            {registryUpgradeDraft && (
              <div className="rounded-xl border border-accent-400/35 bg-accent-500/[0.08] px-4 py-3 text-sm text-slate-100/95">
                <p className="font-medium text-accent-300 mb-1">Prefilled Registry upgrade proposal</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Target is this Chamber. Calldata invokes <span className="font-mono">upgradeImplementation</span> using
                  the Registry’s default implementation{' '}
                  <span className="font-mono text-slate-300">
                    {shortenAddress(registryUpgradeDraft.newImplementation, 6)}
                  </span>
                  {registryUpgradeDraft.registryVersionLabel
                    ? ` (VERSION ${registryUpgradeDraft.registryVersionLabel})`
                    : ''}
                  . Other directors still need to confirm until quorum before execution.
                </p>
                <p className="mt-2">
                  <Link
                    to="/docs/protocol/architecture"
                    className="text-accent-400 hover:text-accent-300"
                  >
                    How Chamber upgrades work →
                  </Link>
                </p>
              </div>
            )}

            {/* Proposal Templates */}
            <div>
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
                        ? 'bg-accent-500/20 text-accent-400 border-accent-500/30'
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
            <div className="space-y-4">
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
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
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
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30' 
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

        {(txType === 'eth' || txType === 'custom') && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              {txType === 'eth' ? 'Amount (ETH)' : 'ETH Value (optional)'}
            </label>
            <input
              type="number"
              placeholder="0.0"
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min="0"
              step="any"
              required={txType === 'eth'}
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
                      <span className="text-accent-400">{param.type}</span>
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

        <div className={`rounded-xl border p-4 ${
          previewRisk?.level === 'high'
            ? 'border-red-500/30 bg-red-500/5'
            : previewRisk?.level === 'medium'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-slate-700/50 bg-slate-800/30'
        }`}>
          <div className="flex items-start gap-3">
            <FiAlertCircle className={`w-5 h-5 mt-0.5 ${
              previewRisk?.level === 'high'
                ? 'text-red-400'
                : previewRisk?.level === 'medium'
                ? 'text-amber-400'
                : 'text-slate-400'
            }`} />
            <div>
              <div className="text-sm font-medium text-slate-200">
                {previewRisk ? previewRisk.label : 'Risk preview pending'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {previewRisk
                  ? previewRisk.summary
                  : 'Enter a valid target address to generate a governance risk summary for directors.'}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Proposal title, description, and risk summary will be committed onchain as metadata for auditability.
              </p>
              {/* Deadline input is out of scope: useSubmitTransaction calls the no-deadline
                  overloads, which apply WalletTypes.DEFAULT_TRANSACTION_MAX_AGE (30 days). */}
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <FiClock className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  Expires {DEFAULT_TRANSACTION_MAX_AGE_SEC / 86400} days after submit (Chamber default).
                  Confirm, revoke, and execute revert after the deadline.
                </span>
              </p>
            </div>
          </div>
        </div>
          </>
        )}

        {busy && (
          <PendingTxBanner
            kind={
              proposalType === 'seats'
                ? 'seat-propose'
                : parsedFunction?.name === 'upgradeImplementation' || !!registryUpgradeDraft
                  ? 'upgrade'
                  : 'submit'
            }
            hash={isSeatPending || isSeatConfirming ? seatHash : submitHash}
            chainId={chainId}
          />
        )}

        <button
          type="submit"
          disabled={busy || (proposalType === 'seats' && hasSeatProposal)}
          className="btn btn-primary w-full py-3"
        >
          {busy ? (
            <>
              <FiLoader className="w-4 h-4 animate-spin" />
              {isPending || isSeatPending ? 'Confirm in Wallet...' : 'Waiting for confirmation...'}
            </>
          ) : (
            <>
              <FiSend className="w-4 h-4" />
              {proposalType === 'seats' ? 'Create Board Proposal' : 'Submit Transaction'}
            </>
          )}
        </button>
      </form>
    </div>
  )
}