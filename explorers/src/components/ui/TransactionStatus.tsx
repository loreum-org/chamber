import { Link } from 'react-router-dom'
import { Button } from './Button'

type TransactionStep = 'pending' | 'confirming' | 'confirmed' | 'failed'

interface TransactionStatusProps {
  step: TransactionStep
  txHash?: `0x${string}`
  explorerUrl?: string
  quantity: number
  tokenIds?: bigint[]
  onTryAgain?: () => void
  onClaimMore?: () => void
}

export function TransactionStatus({
  step,
  txHash,
  explorerUrl,
  quantity,
  tokenIds,
  onTryAgain,
  onClaimMore,
}: TransactionStatusProps) {
  const steps = [
    { id: 'pending', label: 'Waiting for wallet' },
    { id: 'confirming', label: 'Confirming on-chain' },
    { id: 'confirmed', label: 'Complete' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === step)
  const isFailed = step === 'failed'

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="space-y-3">
        {steps.map((s, i) => {
          const isComplete = i < currentStepIndex || step === 'confirmed'
          const isCurrent = i === currentStepIndex && !isFailed
          const isPending = i > currentStepIndex && !isFailed

          return (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                  isComplete
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : isCurrent
                      ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                      : 'border-slate-700 bg-slate-800/40 text-slate-600'
                }`}
              >
                {isComplete ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <div className="h-3 w-3 animate-pulse rounded-full bg-current" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  isComplete
                    ? 'text-emerald-400'
                    : isCurrent
                      ? 'text-slate-100'
                      : isPending
                        ? 'text-slate-500'
                        : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Transaction details */}
      {txHash && (
        <div className="rounded-lg border border-white/[0.06] bg-slate-900/40 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
            Transaction
          </div>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-accent-300 hover:text-accent-200 break-all transition-colors"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
            </a>
          ) : (
            <div className="font-mono text-xs text-slate-400 break-all">
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      {step === 'pending' && (
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-amber-400">Confirm in your wallet</div>
              <div className="mt-1 text-sm text-slate-300">
                A wallet popup should appear. Confirm the transaction to mint {quantity} Explorer
                {quantity > 1 ? 's' : ''}.
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'confirming' && (
        <div className="rounded-lg border border-accent-700/30 bg-accent-950/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-accent-400">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-accent-300">Confirming on-chain</div>
              <div className="mt-1 text-sm text-slate-300">
                Your transaction has been submitted. Waiting for confirmation on Ethereum...
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'confirmed' && (
        <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium text-emerald-400">Successfully minted!</div>
              <div className="mt-1 text-sm text-slate-300">
                You claimed {quantity} Explorer{quantity > 1 ? 's' : ''}
                {tokenIds && tokenIds.length > 0 && (
                  <>
                    {' '}
                    (Token{tokenIds.length > 1 ? 's' : ''} #{tokenIds.map((id) => id.toString()).join(', ')})
                  </>
                )}
                .
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  to="/gallery"
                  className="inline-flex items-center justify-center rounded-lg border border-accent-600 bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-500"
                >
                  View my Explorers →
                </Link>
                {onClaimMore && (
                  <Button variant="ghost" size="sm" onClick={onClaimMore}>
                    Claim more
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="rounded-lg border border-red-700/30 bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-red-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-red-400">Transaction failed</div>
              <div className="mt-1 text-sm text-slate-300">
                Your transaction was rejected or failed. Your quantity selection is preserved.
              </div>
              {onTryAgain && (
                <div className="mt-3">
                  <Button size="sm" onClick={onTryAgain}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
