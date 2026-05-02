import { useQuery } from '@tanstack/react-query'
import {
  alchemyChainSupportsUsdPricing,
  computePortfolioUsd,
  type PortfolioUsdBreakdown,
} from '@/lib/portfolioUsd'
import type { ChamberPortfolio } from '@/lib/alchemy'

export function usePortfolioUsdValue(
  portfolio: ChamberPortfolio | undefined,
  alchemyChainId: number
) {
  const supported = alchemyChainSupportsUsdPricing(alchemyChainId)

  return useQuery<PortfolioUsdBreakdown, Error>({
    queryKey: [
      'portfolio-usd',
      alchemyChainId,
      portfolio?.nativeWei.toString() ?? '',
      portfolio?.erc20.map((r) => `${r.address}:${r.balanceRaw.toString()}`).join('|') ?? '',
      portfolio?.nfts.length ?? 0,
    ],
    queryFn: () => computePortfolioUsd(portfolio!, alchemyChainId),
    enabled: supported && !!portfolio,
    staleTime: 60_000,
    retry: 1,
  })
}
