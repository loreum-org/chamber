import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { erc20Abi } from '@/contracts'
import { chamberAbi } from '@/contracts/abis'
import { useOpenChamber } from '@/hooks/useOpenChamber'
import { resolveTokenDecimals, shortenAddress } from '@/lib/utils'
import { NetworkBadge } from '@/components/ui'

interface ChamberCardProps {
  address: `0x${string}`
  /** Chain the chamber lives on. Reads go to this chain, not the wallet's. */
  chainId: number
}

function formatAmount(value: bigint | undefined, decimals = 18): string {
  if (value === undefined) return '…'
  return parseFloat(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const CARD_READS = [
  'name',
  'symbol',
  'totalAssets',
  'getSeats',
  'getQuorum',
  'getDirectors',
  'getTransactionCount',
  'asset',
  'decimals',
] as const

/**
 * One chamber in the My Chambers list. One title line, one facts line, and
 * the connected wallet's relationship to it. Everything else lives on the
 * chamber page. Opening a chamber on another chain switches the wallet first.
 */
export default function ChamberCard({ address, chainId }: ChamberCardProps) {
  const { address: userAddress } = useAccount()
  const openChamber = useOpenChamber()

  const { data } = useReadContracts({
    contracts: [
      ...CARD_READS.map((functionName) => ({ address, abi: chamberAbi, functionName, chainId })),
      ...(userAddress
        ? [{ address, abi: chamberAbi, functionName: 'balanceOf' as const, args: [userAddress] as const, chainId }]
        : []),
    ],
    query: { retry: 1 },
  })
  const read = <T,>(i: number) => (data?.[i]?.status === 'success' ? (data[i]!.result as T) : undefined)
  const name = read<string>(0)
  const symbol = read<string>(1)
  const totalAssets = read<bigint>(2)
  const seats = read<bigint>(3)
  const quorum = read<bigint>(4)
  const directors = read<`0x${string}`[]>(5)
  const transactionCount = read<bigint>(6)
  const assetToken = read<`0x${string}`>(7)
  const shareDecimals = resolveTokenDecimals(read<number>(8))
  const userBalance = userAddress ? read<bigint>(CARD_READS.length) : undefined

  const { data: assetSymbol } = useReadContract({
    address: assetToken,
    abi: erc20Abi,
    functionName: 'symbol',
    chainId,
    query: { enabled: !!assetToken },
  })

  const isUserDirector =
    !!userAddress && !!directors?.some((d) => d.toLowerCase() === userAddress.toLowerCase())
  const hasDeposit = userBalance !== undefined && userBalance > 0n

  const facts: string[] = []
  facts.push(`${formatAmount(totalAssets)} ${(assetSymbol as string | undefined) ?? ''}`.trim())
  if (seats !== undefined) facts.push(`${seats} seats`)
  if (quorum !== undefined && seats !== undefined) facts.push(`quorum ${quorum} of ${seats}`)
  if (transactionCount !== undefined) facts.push(`${transactionCount} transactions`)

  return (
    <a
      href={`/chamber/${address}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        void openChamber(address, chainId)
      }}
      className="card-hover block group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-[15px] font-semibold text-slate-100 truncate group-hover:text-accent-300 transition-colors">
            {name || 'Loading…'}
          </h3>
          <p className="font-mono text-xs text-slate-500 mt-0.5">{shortenAddress(address, 6)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <NetworkBadge chainId={chainId} />
          {symbol && <span className="badge badge-primary">{symbol}</span>}
        </div>
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
    </a>
  )
}
