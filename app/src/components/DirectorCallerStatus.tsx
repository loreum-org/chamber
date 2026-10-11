import { FiKey, FiShield } from 'react-icons/fi'
import { shortenAddress } from '@/lib/utils'
import type { DirectorCallerRole } from '@/hooks/useChamber'

/**
 * One quiet line that says who the connected wallet acts as on this chamber.
 * Sits under the chamber title; it is context, not an alert.
 */
export function DirectorCallerStatus({
  role,
  tokenId,
  nftOwner,
  sessionOperator,
}: {
  role: DirectorCallerRole | null
  tokenId?: bigint
  nftOwner?: `0x${string}`
  sessionOperator?: `0x${string}`
}) {
  if (!role || tokenId === undefined) return null

  const member = `Member #${tokenId.toString()}`
  const isOwner = role === 'owner'

  return (
    <p className="flex items-center gap-2 text-xs text-slate-400">
      {isOwner ? (
        <FiShield className="w-3.5 h-3.5 text-accent-400 shrink-0" aria-hidden />
      ) : (
        <FiKey className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden />
      )}
      <span>
        You act as{' '}
        {isOwner ? (
          <>
            <span className="text-slate-200">owner of {member}</span>
            {sessionOperator && (
              <>
                {' '}· session key <span className="font-mono">{shortenAddress(sessionOperator)}</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="text-slate-200">operator (session key) for {member}</span>
            {nftOwner && (
              <>
                {' '}· owner <span className="font-mono">{shortenAddress(nftOwner)}</span>
              </>
            )}
          </>
        )}
      </span>
    </p>
  )
}
