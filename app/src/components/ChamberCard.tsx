import { Link } from 'react-router-dom'
import { useReadContract, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useChamberInfo, useChamberBalance, useShareDecimals } from '@/hooks'
import { erc20Abi } from '@/contracts'
import { shortenAddress } from '@/lib/utils'

interface ChamberCardProps {
  address: `0x${string}`
}

function formatAmount(value: bigint | undefined, decimals = 18): string {
  if (value === undefined) return '…'
  return parseFloat(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * One chamber in the My Chambers list. One title line, one facts line, and
 * the connected wallet's relationship to it. Everything else lives on the
 * chamber page.
 */
export default function ChamberCard({ address }: ChamberCardProps) {
  const { address: userAddress } = useAccount()
  const { name, symbol, totalAssets, seats, quorum, directors, transactionCount, assetToken } =
    useChamberInfo(address)
  const { balance: userBalance } = useChamberBalance(address, userAddress)
  const shareDecimals = useShareDecimals(address)

  const { data: assetSymbol } = useReadContract({
    address: assetToken,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: !!assetToken },
  })

  const isUserDirector =
    !!userAddress && !!directors?.some((d) => d.toLowerCase() === userAddress.toLowerCase())
  const hasDeposit = userBalance !== undefined && userBalance > 0n

  const facts: string[] = []
  facts.push(`${formatAmount(totalAssets)} ${(assetSymbol as string | undefined) ?? ''}`.trim())
  if (seats !== undefined) facts.push(`${seats} seats`)
  if (quorum !== undefined && seats !== undefined) facts.push(`quorum ${quorum} of ${seats}`)
  if (transactionCount !== undefined) facts.push(`${transactionCount} proposals`)

  return (
    <Link to={`/chamber/${address}`} className="card-hover block group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-[15px] font-semibold text-slate-100 truncate group-hover:text-accent-300 transition-colors">
            {name || 'Loading…'}
          </h3>
          <p className="font-mono text-xs text-slate-500 mt-0.5">{shortenAddress(address, 6)}</p>
        </div>
        {symbol && <span className="badge badge-primary shrink-0">{symbol}</span>}
      </div>

      <p className="mt-4 text-sm text-slate-400 tabular-nums">
        {facts.map((fact, i) => (
          <span key={fact}>
            {i > 0 && <span className="text-slate-600 mx-1.5">·</span>}
            {fact}
          </span>
        ))}
      </p>

      {(isUserDirector || hasDeposit) && (
        <div className="mt-3 pt-3 border-t border-line flex items-center gap-2 text-xs">
          {isUserDirector && <span className="badge badge-primary">Director</span>}
          {hasDeposit && (
            <span className="text-slate-400 font-mono">
              {parseFloat(formatUnits(userBalance!, shareDecimals)).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{' '}
              shares
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
