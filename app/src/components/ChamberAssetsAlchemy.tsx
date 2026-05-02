import { formatUnits, zeroAddress } from 'viem'
import { FiExternalLink, FiInfo, FiLoader, FiPackage, FiTrendingUp } from 'react-icons/fi'
import { useChamberAlchemyPortfolio } from '@/hooks/useChamberAlchemyPortfolio'
import { usePortfolioUsdValue } from '@/hooks/usePortfolioUsdValue'
import {
  alchemySupportsChain,
  formatErc20BalanceHuman,
  getAlchemyApiKeyFromEnv,
  portfolioAlchemyChainId,
} from '@/lib/alchemy'
import { alchemyChainSupportsUsdPricing, formatUsdCompact, type PortfolioUsdBreakdown } from '@/lib/portfolioUsd'
import { getBlockExplorerAddressUrl } from '@/lib/utils'

function TotalAumPanel({
  portfolioLoading,
  portfolioError,
  pricingSupported,
  usdBreakdown,
  usdLoading,
  usdError,
}: {
  portfolioLoading: boolean
  portfolioError: boolean
  pricingSupported: boolean
  usdBreakdown: PortfolioUsdBreakdown | undefined
  usdLoading: boolean
  usdError: Error | null
}) {
  if (portfolioLoading) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 sm:p-6 h-full flex flex-col items-center justify-center min-h-[12rem] gap-2 text-slate-500">
        <FiLoader className="w-7 h-7 animate-spin text-accent-400" />
        <span className="text-sm">Loading holdings…</span>
      </div>
    )
  }

  if (portfolioError) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 sm:p-6 h-full">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <FiTrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Total AUM (USD)</span>
        </div>
        <p className="text-slate-500 text-sm">Load indexed assets to estimate market value.</p>
      </div>
    )
  }

  if (!pricingSupported) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 sm:p-6 h-full">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <FiTrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Total AUM (USD)</span>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          USD marks use live spot prices on Ethereum, Base, and Arbitrum. They are not available on Sepolia; use
          mainnet or an L2, or forked Anvil (31337) mirroring mainnet holdings.
        </p>
      </div>
    )
  }

  if (usdLoading) {
    return (
      <div className="rounded-2xl border border-accent-500/20 bg-accent-500/5 p-5 sm:p-6 h-full flex flex-col items-center justify-center min-h-[12rem] gap-2 text-slate-500">
        <FiLoader className="w-7 h-7 animate-spin text-accent-400" />
        <span className="text-sm">Fetching USD prices…</span>
      </div>
    )
  }

  if (usdError) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 sm:p-6 h-full">
        <div className="flex items-center gap-2 text-red-400/90 mb-2">
          <FiTrendingUp className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Total AUM (USD)</span>
        </div>
        <p className="text-red-300/90 text-sm">{usdError.message}</p>
      </div>
    )
  }

  if (!usdBreakdown) {
    return null
  }

  const hints: string[] = []
  if (usdBreakdown.nftCount > 0) {
    hints.push(
      `${usdBreakdown.nftCount} NFT${usdBreakdown.nftCount === 1 ? '' : 's'} excluded (no floor price in this view)`
    )
  }
  if (usdBreakdown.erc20Unpriced > 0) {
    hints.push(`${usdBreakdown.erc20Unpriced} token balance${usdBreakdown.erc20Unpriced === 1 ? '' : 's'} missing a USD quote`)
  }
  if (usdBreakdown.nativeUnpriced) {
    hints.push('Native balance excluded (no spot price)')
  }

  return (
    <div className="rounded-2xl border border-accent-500/20 bg-accent-500/5 p-5 sm:p-6 h-full">
      <div className="flex items-center gap-2 text-accent-400/90 mb-3">
        <FiTrendingUp className="w-5 h-5 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Total AUM (USD)</span>
      </div>
      <p className="text-slate-500 text-xs mb-4 leading-relaxed">
        Combined spot value of native gas token and ERC-20s (DefiLlama). NFTs are not valued here.
      </p>
      <div className="font-mono text-2xl sm:text-3xl font-semibold text-slate-100 tabular-nums tracking-tight">
        {formatUsdCompact(usdBreakdown.totalUsd)}
      </div>
      {hints.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-[11px] text-slate-500 list-disc list-inside">
          {hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

type ChamberInfoLite = {
  assetToken?: `0x${string}`
  nftToken?: `0x${string}`
}

export default function ChamberAssetsAlchemy({
  chamberAddress,
  chainId,
  chamberInfo,
}: {
  chamberAddress: `0x${string}`
  chainId: number
  chamberInfo: ChamberInfoLite
}) {
  const apiKey = getAlchemyApiKeyFromEnv()
  const assetsChainId = portfolioAlchemyChainId(chainId)
  const supported = alchemySupportsChain(assetsChainId)
  const pricingSupported = alchemyChainSupportsUsdPricing(assetsChainId)
  const assetToken =
    chamberInfo.assetToken && chamberInfo.assetToken !== zeroAddress
      ? chamberInfo.assetToken
      : undefined

  const { data, isPending, isError, error, refetch, isFetching } = useChamberAlchemyPortfolio(
    chamberAddress,
    chainId,
    { assetToken }
  )

  const {
    data: usdBreakdown,
    isPending: usdPending,
    isFetching: usdFetching,
    isError: usdIsError,
    error: usdError,
  } = usePortfolioUsdValue(data, assetsChainId)

  const usdLoading = pricingSupported && !!data && (usdPending || usdFetching)

  if (!supported) {
    return (
      <div className="panel">
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-heading font-semibold text-slate-100">Chamber assets</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Indexed ERC-20 & NFT holdings (Alchemy) — mainnet, Sepolia, Base, and Arbitrum
          </p>
        </div>
        <div className="p-6 flex items-start gap-3 text-slate-500 text-sm">
          <FiInfo className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Portfolio indexing is not available on this network. Use Ethereum, Sepolia, Base, Arbitrum, or local
            Anvil (chain 31337 — shows Ethereum mainnet holdings for the same address).
          </p>
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className="panel">
        <div className="p-4 border-b border-slate-700/30">
          <h3 className="font-heading font-semibold text-slate-100">Chamber assets</h3>
          <p className="text-slate-500 text-xs mt-0.5">ERC-20 & NFT balances via Alchemy</p>
        </div>
        <div className="p-6 flex items-start gap-3 text-slate-500 text-sm">
          <FiInfo className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-400">
              Add <code className="text-slate-300 font-mono text-xs">VITE_ALCHEMY_API_KEY</code> to{' '}
              <code className="text-slate-300 font-mono text-xs">app/.env</code> to load indexed assets for this
              chamber.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel min-w-0">
      <div className="p-4 border-b border-slate-700/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading font-semibold text-slate-100">Chamber assets</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            ERC-20 & NFTs held by this contract (Alchemy index)
            {chainId === 31337 ? (
              <span className="text-slate-600"> — values from Ethereum mainnet for this address</span>
            ) : null}
            {isFetching && !isPending ? <span className="text-slate-600"> · refreshing…</span> : null}
          </p>
        </div>
        <button type="button" onClick={() => void refetch()} className="btn btn-secondary text-xs shrink-0">
          Refresh
        </button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-700/40">
          <div className="p-10 flex flex-col items-center gap-2 text-slate-500 min-h-[12rem] justify-center">
            <FiLoader className="w-8 h-8 animate-spin text-accent-400" />
            <span className="text-sm">Loading portfolio…</span>
          </div>
          <div className="p-6 lg:p-8 flex flex-col justify-center border-t border-slate-700/40 lg:border-t-0">
            <TotalAumPanel
              portfolioLoading
              portfolioError={false}
              pricingSupported={pricingSupported}
              usdBreakdown={undefined}
              usdLoading={false}
              usdError={null}
            />
          </div>
        </div>
      ) : isError ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-700/40">
          <div className="p-6 text-red-400 text-sm">{error?.message ?? 'Failed to load portfolio'}</div>
          <div className="p-6 lg:p-8 flex flex-col justify-center border-t border-slate-700/40 lg:border-t-0">
            <TotalAumPanel
              portfolioLoading={false}
              portfolioError
              pricingSupported={pricingSupported}
              usdBreakdown={undefined}
              usdLoading={false}
              usdError={null}
            />
          </div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-700/40">
          <div className="p-4 space-y-6 min-w-0">
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Native
              </h4>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2.5 font-mono text-sm text-slate-200">
                {parseFloat(formatUnits(data.nativeWei, 18)).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}{' '}
                {data.nativeSymbol}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                ERC-20 ({data.erc20.length})
              </h4>
              {data.erc20.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No indexed ERC-20 balances</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 text-left text-slate-500 text-xs">
                        <th className="p-3 font-medium">Token</th>
                        <th className="p-3 font-medium text-right">Balance</th>
                        <th className="p-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {data.erc20.map((row) => {
                        const human = formatErc20BalanceHuman(row)
                        const symbol = row.symbol?.trim() || '—'
                        const label = row.name?.trim() ? `${row.name} (${symbol})` : symbol
                        const href = getBlockExplorerAddressUrl(row.address, assetsChainId)
                        return (
                          <tr key={row.address} className="text-slate-200">
                            <td className="p-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {row.logo ? (
                                  <img src={row.logo} alt="" className="w-7 h-7 rounded-full shrink-0 bg-slate-700" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-700 shrink-0 flex items-center justify-center">
                                    <FiPackage className="w-3.5 h-3.5 text-slate-500" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{label}</div>
                                  <div className="font-mono text-[11px] text-slate-500 truncate">
                                    {row.address.slice(0, 10)}…{row.address.slice(-8)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-300 whitespace-nowrap">
                              {parseFloat(human).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                            </td>
                            <td className="p-3">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-accent-400 inline-flex"
                                  aria-label="View on explorer"
                                >
                                  <FiExternalLink className="w-4 h-4" />
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                NFTs ({data.nfts.length})
              </h4>
              {data.nfts.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No NFTs in this chamber wallet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.nfts.map((nft) => {
                    const href = getBlockExplorerAddressUrl(nft.contractAddress, assetsChainId)
                    const title =
                      nft.name?.trim() ||
                      `${nft.contractName ?? 'NFT'} #${nft.tokenId}`
                    return (
                      <div
                        key={`${nft.contractAddress}-${nft.tokenId}-${nft.balance ?? ''}`}
                        className="flex gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-800/30"
                      >
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                          {nft.imageUrl ? (
                            <img src={nft.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FiPackage className="w-6 h-6 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-100 font-medium truncate">{title}</div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {nft.contractAddress.slice(0, 8)}… · #{nft.tokenId}
                            {nft.balance && nft.balance !== '1' ? ` × ${nft.balance}` : ''}
                          </div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-1 mt-1"
                            >
                              Contract <FiExternalLink className="w-3 h-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 lg:p-8 flex flex-col justify-center border-t border-slate-700/40 lg:border-t-0">
            <TotalAumPanel
              portfolioLoading={false}
              portfolioError={false}
              pricingSupported={pricingSupported}
              usdBreakdown={usdBreakdown}
              usdLoading={usdLoading}
              usdError={usdIsError ? (usdError ?? new Error('Price lookup failed')) : null}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
