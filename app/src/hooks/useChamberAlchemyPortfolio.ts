import { useQuery } from '@tanstack/react-query'
import { type Address } from 'viem'
import {
  alchemySupportsChain,
  fetchChamberPortfolioAlchemy,
  getAlchemyApiKeyFromEnv,
  portfolioAlchemyChainId,
  type ChamberPortfolio,
} from '@/lib/alchemy'

export function useChamberAlchemyPortfolio(
  chamberAddress: Address | undefined,
  chainId: number,
  options?: {
    /** Ensures vault underlying ERC-20 is included in the balance scan */
    assetToken?: Address
    enabled?: boolean
  }
) {
  const apiKey = getAlchemyApiKeyFromEnv()
  const alchemyChainId = portfolioAlchemyChainId(chainId)
  const supported = alchemySupportsChain(alchemyChainId) && !!apiKey
  const assetToken = options?.assetToken

  return useQuery<ChamberPortfolio, Error>({
    queryKey: [
      'chamber-portfolio-alchemy',
      chamberAddress?.toLowerCase() ?? '',
      alchemyChainId,
      assetToken?.toLowerCase() ?? '',
    ],
    enabled: (options?.enabled ?? true) && !!chamberAddress && supported,
    staleTime: 60_000,
    queryFn: async () => {
      if (!chamberAddress || !apiKey) throw new Error('Missing chamber or Alchemy key')
      const extraErc20 = assetToken ? [assetToken] : []
      return fetchChamberPortfolioAlchemy(chamberAddress, alchemyChainId, {
        apiKey,
        extraErc20,
      })
    },
  })
}
