/**
 * Frame-07: green dot on a supported chain; amber "Test network · Sepolia"
 * chip (nav AND panel) on Sepolia; red dot on unsupported. Label always comes
 * from the connected chain — never hardcoded.
 */
export type NetworkChipState = 'supported' | 'test' | 'unsupported'

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`w-[7px] h-[7px] rounded-full ${className}`} />
}

export function NetworkChip({
  state,
  label,
  className = '',
}: {
  state: NetworkChipState
  label: string
  className?: string
}) {
  if (state === 'test') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400 ${className}`}
      >
        <Dot className="bg-amber-400" />
        {label}
      </span>
    )
  }
  const dot = state === 'supported' ? 'bg-emerald-400' : 'bg-red-400'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700/40 px-2.5 py-1 text-xs text-slate-400 ${className}`}
    >
      <Dot className={dot} />
      {label}
    </span>
  )
}
