import { FiShield } from 'react-icons/fi'
import type { DirectorCallerRole } from '@/hooks/useChamber'

/**
 * One quiet line that says who the connected wallet acts as on this chamber.
 * Sits under the chamber title; it is context, not an alert.
 */
export function DirectorCallerStatus({
  role,
  tokenId,
}: {
  role: DirectorCallerRole | null
  tokenId?: bigint
}) {
  if (!role || tokenId === undefined) return null

  return (
    <p className="flex items-center gap-2 text-xs text-slate-400">
      <FiShield className="w-3.5 h-3.5 text-accent-400 shrink-0" aria-hidden />
      <span>
        You act as <span className="text-slate-200">owner of Member #{tokenId.toString()}</span>
      </span>
    </p>
  )
}
