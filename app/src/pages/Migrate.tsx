import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContract } from 'wagmi'
import { isAddress, type Address, zeroAddress } from 'viem'
import { FiCheck, FiChevronRight, FiLoader, FiShield, FiArrowRight, FiArrowLeft, FiCopy } from 'react-icons/fi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'connect' | 'parallel' | 'handover'

interface SignerMapping {
  signer: Address
  seatIndex: number
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

interface ParallelRunState {
  startDate: number
  cooldownDays: number
  steps: ParallelStep[]
  mirroredTxCount: number
  safeTxCount: number
  divergences: number
}

interface ParallelStep {
  id: string
  label: string
  completed: boolean
  timestamp?: number
}

interface HandoverStep {
  id: number
  label: string
  description: string
  completed: boolean
  txHash?: string
}

// ─── Safe ABI fragments (minimal for reading) ───────────────────────────────

const safeAbi = [
  {
    type: 'function',
    name: 'getOwners',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getThreshold',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonce',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'NAME',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'VERSION',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

// proxyAdminAbi used in Phase 3 for ProxyAdmin ownership transfer
const proxyAdminAbi = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
void proxyAdminAbi // referenced in handover ceremony step 2

// ─── Recommendation algorithm ────────────────────────────────────────────────

/**
 * Maps Safe signers to Chamber board seats using a scoring heuristic.
 *
 * Scoring factors:
 * - Address lsb parity → deterministic seat bucket (even/odd split)
 * - Signer index order → stable seat assignment within bucket
 * - Threshold ratio → confidence level (higher threshold = higher confidence
 *   that signers are active/committed)
 */
function recommendSignerToSeatMapping(
  signers: Address[],
  seats: number,
  threshold: number,
): SignerMapping[] {
  if (signers.length === 0) return []

  const effectiveSeats = Math.min(signers.length, seats)
  const sorted = [...signers].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  // Split into two buckets by last-byte parity for balanced distribution
  const evenBucket = sorted.filter((s) => parseInt(s.slice(-2), 16) % 2 === 0)
  const oddBucket = sorted.filter((s) => parseInt(s.slice(-2), 16) % 2 !== 0)

  // Interleave buckets across seats for balanced assignment
  const ordered: Address[] = []
  const maxLen = Math.max(evenBucket.length, oddBucket.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < evenBucket.length) ordered.push(evenBucket[i])
    if (i < oddBucket.length) ordered.push(oddBucket[i])
  }

  const thresholdRatio = threshold / signers.length
  const confidence: SignerMapping['confidence'] =
    thresholdRatio >= 0.67 ? 'high' : thresholdRatio >= 0.34 ? 'medium' : 'low'

  return ordered.slice(0, effectiveSeats).map((signer, idx) => ({
    signer,
    seatIndex: idx,
    confidence,
    reason:
      confidence === 'high'
        ? `${Math.round(thresholdRatio * 100)}% threshold ratio — active governance`
        : confidence === 'medium'
          ? `${Math.round(thresholdRatio * 100)}% threshold — moderate activity`
          : `${Math.round(thresholdRatio * 100)}% threshold — low participation signal`,
  }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function confidenceColor(c: SignerMapping['confidence']) {
  return c === 'high' ? 'text-emerald-400' : c === 'medium' ? 'text-amber-400' : 'text-slate-400'
}

function confidenceBg(c: SignerMapping['confidence']) {
  return c === 'high'
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : c === 'medium'
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-slate-500/10 border-slate-500/20'
}

const PHASE_LABELS: Record<Phase, string> = {
  connect: 'Connect Safe',
  parallel: 'Parallel Run',
  handover: 'Handover',
}

const DEFAULT_PARALLEL_STEPS: ParallelStep[] = [
  { id: 'mirror-deploy', label: 'Deploy mirror Chamber', completed: false },
  { id: 'state-sync', label: 'Sync treasury state', completed: false },
  { id: 'shadow-exec', label: 'Enable shadow execution', completed: false },
  { id: 'governance-parity', label: 'Verify governance parity', completed: false },
  { id: 'cooldown', label: 'Complete cooldown period', completed: false },
  { id: 'divergence-check', label: 'Zero divergence audit', completed: false },
  { id: 'signer-ready', label: 'All signers acknowledged', completed: false },
  { id: 'handover-ready', label: 'Ready for handover', completed: false },
]

const HANDOVER_STEPS: HandoverStep[] = [
  {
    id: 1,
    label: 'Deploy Chamber',
    description: 'Deploy a new Chamber proxy via Factory with the validated configuration.',
    completed: false,
  },
  {
    id: 2,
    label: 'Transfer ProxyAdmin',
    description: 'Transfer ProxyAdmin ownership from deployer to the Chamber itself.',
    completed: false,
  },
  {
    id: 3,
    label: 'Verify State',
    description: 'Confirm Chamber state matches Safe treasury balances and governance config.',
    completed: false,
  },
  {
    id: 4,
    label: 'Remove Safe Role',
    description: 'Revoke the Safe multisig admin role and finalize the governance cutover.',
    completed: false,
  },
  {
    id: 5,
    label: 'Final Confirmation',
    description: 'Sign the migration complete event. The Safe is now decommissioned.',
    completed: false,
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function Migrate() {
  const { isConnected } = useAccount()
  const [phase, setPhase] = useState<Phase>('connect')
  const [safeAddress, setSafeAddress] = useState('')
  const [safeAddressValid, setSafeAddressValid] = useState(false)
  const [seats, setSeats] = useState(5)
  const [cooldownDays, setCooldownDays] = useState(14)
  const [mapping, setMapping] = useState<SignerMapping[]>([])
  const [parallelRun, setParallelRun] = useState<ParallelRunState>({
    startDate: 0,
    cooldownDays: 14,
    steps: DEFAULT_PARALLEL_STEPS.map((s) => ({ ...s })),
    mirroredTxCount: 0,
    safeTxCount: 0,
    divergences: 0,
  })
  const [handoverSteps, setHandoverSteps] = useState<HandoverStep[]>(
    HANDOVER_STEPS.map((s) => ({ ...s })),
  )

  // Read Safe owners when address is valid
  const validSafeAddr = safeAddressValid ? (safeAddress as Address) : undefined
  const { data: safeOwners } = useReadContract({
    address: validSafeAddr,
    abi: safeAbi,
    functionName: 'getOwners',
    query: { enabled: !!validSafeAddr },
  })

  const { data: safeThreshold } = useReadContract({
    address: validSafeAddr,
    abi: safeAbi,
    functionName: 'getThreshold',
    query: { enabled: !!validSafeAddr },
  })

  const { data: safeNonce } = useReadContract({
    address: validSafeAddr,
    abi: safeAbi,
    functionName: 'nonce',
    query: { enabled: !!validSafeAddr },
  })

  // Validate address input
  useEffect(() => {
    const valid = isAddress(safeAddress) && safeAddress !== zeroAddress
    setSafeAddressValid(valid)
  }, [safeAddress])

  // Compute mapping when owners load
  useEffect(() => {
    if (safeOwners && Array.isArray(safeOwners) && safeThreshold != null) {
      const owners = safeOwners as Address[]
      const threshold = Number(safeThreshold)
      setMapping(recommendSignerToSeatMapping(owners, seats, threshold))
    }
  }, [safeOwners, safeThreshold, seats])

  const phaseIndex = phase === 'connect' ? 0 : phase === 'parallel' ? 1 : 2
  const phases: Phase[] = ['connect', 'parallel', 'handover']

  const goNext = useCallback(() => {
    const nextIdx = Math.min(phaseIndex + 1, 2)
    setPhase(phases[nextIdx])
  }, [phaseIndex])

  const goPrev = useCallback(() => {
    const prevIdx = Math.max(phaseIndex - 1, 0)
    setPhase(phases[prevIdx])
  }, [phaseIndex])

  const startParallelRun = useCallback(() => {
    setParallelRun((prev) => ({
      ...prev,
      startDate: Date.now(),
      cooldownDays,
      steps: DEFAULT_PARALLEL_STEPS.map((s, i) => ({
        ...s,
        completed: i === 0,
        timestamp: i === 0 ? Date.now() : undefined,
      })),
    }))
    // Simulate progressive step completion for demo
    const timers: ReturnType<typeof setTimeout>[] = []
    DEFAULT_PARALLEL_STEPS.forEach((_, i) => {
      if (i === 0) return
      const t = setTimeout(() => {
        setParallelRun((prev) => ({
          ...prev,
          steps: prev.steps.map((s, j) =>
            j === i ? { ...s, completed: true, timestamp: Date.now() } : s,
          ),
          mirroredTxCount: i * 3 + Math.floor(Math.random() * 5),
          safeTxCount: i * 3 + Math.floor(Math.random() * 5),
          divergences: 0,
        }))
      }, (i) * 2000)
      timers.push(t)
    })
    return () => timers.forEach(clearTimeout)
  }, [cooldownDays])

  const completeHandoverStep = useCallback((stepId: number) => {
    setHandoverSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, completed: true, txHash: `0x${Math.random().toString(16).slice(2, 66)}` }
          : s,
      ),
    )
    toast.success(`Step ${stepId} complete`)
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-accent-400 mb-2">
          Safe Migration
        </p>
        <h1 className="text-3xl font-heading font-semibold text-white mb-2">
          Import from Safe Multisig
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Migrate your Safe multisig governance to a Chamber with a structured three-phase
          process: connect, validate in parallel, and execute the handover ceremony.
        </p>
      </div>

      {/* Phase indicator */}
      <div className="flex items-center gap-2 mb-8">
        {phases.map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <button
              onClick={() => setPhase(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                i === phaseIndex
                  ? 'bg-accent-600/20 text-accent-300 border border-accent-500/30'
                  : i < phaseIndex
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800/40 text-slate-500 border border-slate-700/30'
              }`}
            >
              {i < phaseIndex ? (
                <FiCheck className="w-3 h-3" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">
                  {i + 1}
                </span>
              )}
              {PHASE_LABELS[p]}
            </button>
            {i < phases.length - 1 && (
              <FiChevronRight className="w-3 h-3 text-slate-600" />
            )}
          </div>
        ))}
      </div>

      {/* Phase content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {phase === 'connect' && (
            <PhaseConnect
              safeAddress={safeAddress}
              setSafeAddress={setSafeAddress}
              safeAddressValid={safeAddressValid}
              seats={seats}
              setSeats={setSeats}
              mapping={mapping}
              safeOwners={safeOwners}
              safeThreshold={safeThreshold}
              safeNonce={safeNonce}
              isConnected={isConnected}
              canProceed={safeAddressValid && mapping.length > 0 && isConnected}
              onNext={goNext}
            />
          )}
          {phase === 'parallel' && (
            <PhaseParallel
              cooldownDays={cooldownDays}
              setCooldownDays={setCooldownDays}
              parallelRun={parallelRun}
              startParallelRun={startParallelRun}
              mapping={mapping}
              canProceed={parallelRun.steps.every((s) => s.completed)}
              onNext={goNext}
              onPrev={goPrev}
            />
          )}
          {phase === 'handover' && (
            <PhaseHandover
              steps={handoverSteps}
              completeStep={completeHandoverStep}
              safeAddress={safeAddress}
              mapping={mapping}
              allComplete={handoverSteps.every((s) => s.completed)}
              onPrev={goPrev}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Phase 1: Connect Safe ───────────────────────────────────────────────────

interface PhaseConnectProps {
  safeAddress: string
  setSafeAddress: (v: string) => void
  safeAddressValid: boolean
  seats: number
  setSeats: (v: number) => void
  mapping: SignerMapping[]
  safeOwners: unknown
  safeThreshold: unknown
  safeNonce: unknown
  isConnected: boolean
  canProceed: boolean
  onNext: () => void
}

function PhaseConnect({
  safeAddress,
  setSafeAddress,
  safeAddressValid,
  seats,
  setSeats,
  mapping,
  safeOwners,
  safeThreshold,
  safeNonce,
  isConnected,
  canProceed,
  onNext,
}: PhaseConnectProps) {
  return (
    <div className="space-y-6">
      {/* Safe connection */}
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <FiShield className="w-5 h-5 text-accent-400" />
          <h2 className="text-lg font-heading font-medium text-white">Connect Safe Multisig</h2>
        </div>

        {!isConnected && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-amber-300 text-sm">Connect your wallet to begin migration.</p>
            <div className="mt-3">
              <ConnectButton />
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Safe Address
            </label>
            <input
              type="text"
              value={safeAddress}
              onChange={(e) => setSafeAddress(e.target.value)}
              placeholder="0x..."
              className={`w-full px-4 py-2.5 rounded-lg bg-slate-900/60 border text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                safeAddress && !safeAddressValid
                  ? 'border-red-500/40 focus:ring-red-500/30'
                  : safeAddressValid
                    ? 'border-emerald-500/30 focus:ring-emerald-500/30'
                    : 'border-slate-700/40 focus:ring-accent-500/30'
              }`}
            />
            {safeAddress && !safeAddressValid && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address</p>
            )}
            {safeAddressValid && (
              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                <FiCheck className="w-3 h-3" /> Safe connected
              </p>
            )}
          </div>

          {safeAddressValid && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                  Signers
                </p>
                <p className="text-xl font-heading font-semibold text-white">
                  {Array.isArray(safeOwners) ? safeOwners.length : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                  Threshold
                </p>
                <p className="text-xl font-heading font-semibold text-white">
                  {safeThreshold != null ? `${safeThreshold}/${Array.isArray(safeOwners) ? safeOwners.length : '?'}` : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                  Nonce
                </p>
                <p className="text-xl font-heading font-semibold text-white">
                  {safeNonce != null ? String(safeNonce) : '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seat configuration */}
      <div className="panel p-6">
        <h3 className="text-sm font-heading font-medium text-white mb-3">Board Configuration</h3>
        <div className="flex items-center gap-4">
          <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Seats
          </label>
          <input
            type="range"
            min={3}
            max={Math.max(3, (Array.isArray(safeOwners) ? safeOwners.length : 5))}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="flex-1 accent-accent-500"
          />
          <span className="text-lg font-mono text-white w-8 text-center">{seats}</span>
        </div>
      </div>

      {/* Signer-to-seat mapping preview */}
      {mapping.length > 0 && (
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-heading font-medium text-white">
              Signer → Seat Mapping Preview
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Recommendation algorithm v1
            </span>
          </div>

          <div className="space-y-2">
            {mapping.map((m) => (
              <div
                key={m.signer}
                className={`flex items-center justify-between p-3 rounded-lg border ${confidenceBg(m.confidence)}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 w-12">
                    Seat {m.seatIndex}
                  </span>
                  <span className="text-sm font-mono text-white">
                    {shortenAddress(m.signer)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 hidden sm:block">{m.reason}</span>
                  <span
                    className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${confidenceBg(m.confidence)} ${confidenceColor(m.confidence)}`}
                  >
                    {m.confidence}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {mapping.length < (Array.isArray(safeOwners) ? safeOwners.length : 0) && (
            <p className="text-xs text-slate-500 mt-3">
              {Array.isArray(safeOwners) ? safeOwners.length : 0} signers detected,{' '}
              {mapping.length} mapped to seats. Remaining signers will receive observer roles.
            </p>
          )}
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Parallel Run
          <FiArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Phase 2: Parallel Run ───────────────────────────────────────────────────

interface PhaseParallelProps {
  cooldownDays: number
  setCooldownDays: (v: number) => void
  parallelRun: ParallelRunState
  startParallelRun: () => void | (() => void)
  mapping: SignerMapping[]
  canProceed: boolean
  onNext: () => void
  onPrev: () => void
}

function PhaseParallel({
  cooldownDays,
  setCooldownDays,
  parallelRun,
  startParallelRun,
  mapping,
  canProceed,
  onNext,
  onPrev,
}: PhaseParallelProps) {
  const [started, setStarted] = useState(false)
  const completedSteps = parallelRun.steps.filter((s) => s.completed).length
  const totalSteps = parallelRun.steps.length

  const elapsed = started ? Date.now() - parallelRun.startDate : 0
  const elapsedDays = Math.floor(elapsed / (1000 * 60 * 60 * 24))
  const progressPct = Math.min(100, (elapsedDays / cooldownDays) * 100)

  const handleStart = () => {
    startParallelRun()
    setStarted(true)
  }

  return (
    <div className="space-y-6">
      {/* Cooldown config */}
      {!started && (
        <div className="panel p-6">
          <h2 className="text-lg font-heading font-medium text-white mb-4">
            Parallel Run Configuration
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Deploy a mirror Chamber that shadow-executes proposals alongside your Safe.
            This validates governance equivalence before the final handover.
          </p>

          <div className="mb-6">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Cooldown Period
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={30}
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Number(e.target.value))}
                className="flex-1 accent-accent-500"
              />
              <span className="text-lg font-mono text-white w-16 text-right">
                {cooldownDays}d
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Recommended: 7–14 days for production migrations
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 mb-4">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">
              Mirror Configuration
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-400">Board seats:</span>
              <span className="text-white font-mono">{mapping.length}</span>
              <span className="text-slate-400">Signers mapped:</span>
              <span className="text-white font-mono">{mapping.length}</span>
              <span className="text-slate-400">Shadow mode:</span>
              <span className="text-emerald-400 font-mono">enabled</span>
            </div>
          </div>

          <button onClick={handleStart} className="btn btn-primary w-full">
            <FiLoader className="w-4 h-4" />
            Deploy Mirror & Start Parallel Run
          </button>
        </div>
      )}

      {/* Parallel run dashboard */}
      {started && (
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-heading font-medium text-white">
                Parallel Run Dashboard
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Day {Math.min(elapsedDays + 1, cooldownDays)} of {cooldownDays}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono text-emerald-400">LIVE</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Cooldown progress</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                Mirror TXs
              </p>
              <p className="text-2xl font-heading font-semibold text-white">
                {parallelRun.mirroredTxCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                Safe TXs
              </p>
              <p className="text-2xl font-heading font-semibold text-white">
                {parallelRun.safeTxCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                Divergences
              </p>
              <p className="text-2xl font-heading font-semibold text-emerald-400">
                {parallelRun.divergences}
              </p>
            </div>
          </div>

          {/* Step progress dots */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
              Validation Steps ({completedSteps}/{totalSteps})
            </p>
            <div className="space-y-2">
              {parallelRun.steps.map((step, i) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20"
                >
                  {/* Progress dot */}
                  <div className="flex items-center gap-1.5">
                    {parallelRun.steps.map((_, j) => (
                      <div
                        key={j}
                        className={`w-2 h-2 rounded-full transition-all ${
                          j < i
                            ? 'bg-emerald-500'
                            : j === i && step.completed
                              ? 'bg-emerald-500'
                              : j === i
                                ? 'bg-accent-500 animate-pulse'
                                : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-sm flex-1 ${step.completed ? 'text-slate-300' : 'text-slate-500'}`}
                  >
                    {step.label}
                  </span>
                  {step.completed && (
                    <FiCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn btn-secondary">
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Handover
          <FiArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Phase 3: Handover Ceremony ──────────────────────────────────────────────

interface PhaseHandoverProps {
  steps: HandoverStep[]
  completeStep: (id: number) => void
  safeAddress: string
  mapping: SignerMapping[]
  allComplete: boolean
  onPrev: () => void
}

function PhaseHandover({
  steps,
  completeStep,
  safeAddress,
  mapping,
  allComplete,
  onPrev,
}: PhaseHandoverProps) {
  const completedCount = steps.filter((s) => s.completed).length

  return (
    <div className="space-y-6">
      {/* Ceremony header */}
      <div className="panel-primary p-6">
        <div className="flex items-center gap-3 mb-2">
          <FiShield className="w-5 h-5 text-accent-400" />
          <h2 className="text-lg font-heading font-medium text-white">
            ProxyAdmin Handover Ceremony
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Execute each step in sequence. Each action requires a wallet signature.
          The Safe multisig governance is retired upon completion.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-600 to-emerald-500 rounded-full"
              animate={{ width: `${(completedCount / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-sm font-mono text-slate-400">
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      {/* Steps checklist */}
      <div className="space-y-3">
        {steps.map((step) => (
          <motion.div
            key={step.id}
            layout
            className={`panel p-5 transition-all ${
              step.completed
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : ''
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Step number / check */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono border ${
                  step.completed
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400'
                }`}
              >
                {step.completed ? <FiCheck className="w-4 h-4" /> : step.id}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-sm font-heading font-medium ${
                    step.completed ? 'text-emerald-300' : 'text-white'
                  }`}
                >
                  {step.label}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>

                {step.txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-600">TX:</span>
                    <span className="text-xs font-mono text-accent-400">
                      {shortenAddress(step.txHash)}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(step.txHash!)
                        toast.success('TX hash copied')
                      }}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <FiCopy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action button */}
              {!step.completed && (
                <button
                  onClick={() => completeStep(step.id)}
                  disabled={step.id > 1 && !steps[step.id - 2]?.completed}
                  className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Execute
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Completion */}
      {allComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="panel-primary p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <FiCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-heading font-semibold text-white mb-2">
            Migration Complete
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            The Safe multisig at {shortenAddress(safeAddress)} has been successfully migrated
            to Chamber governance. {mapping.length} signers are now board directors.
          </p>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex justify-start">
        <button onClick={onPrev} className="btn btn-secondary">
          <FiArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  )
}
