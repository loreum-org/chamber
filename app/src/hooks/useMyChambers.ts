import { useCallback, useEffect, useState } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { multicall } from 'viem/actions'
import { parseAbiItem, type Address, type PublicClient } from 'viem'
import { chamberAbi, factoryAbi, registryAbi } from '@/contracts/abis'
import { addRecentChamber, getRecentChambers } from '@/lib/recentChambers'
import { isNonZeroAddress } from '@/lib/wagmi'
import { useFactoryAddress, useRegistryAddress } from './useRegistry'

const factoryCreatedEvent = parseAbiItem(
  'event ChamberCreated(address indexed chamber, address indexed asset, address indexed nft, uint256 seats, string name, string symbol, address creator)',
)

const registryCreatedEvent = parseAbiItem(
  'event ChamberCreated(address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token)',
)

const LOG_LOOKBACK_BLOCKS = 100_000n

export function useRecentChambers() {
  const chainId = useChainId()
  const [recents, setRecents] = useState<`0x${string}`[]>(() => getRecentChambers(chainId))

  useEffect(() => {
    setRecents(getRecentChambers(chainId))
  }, [chainId])

  const remember = useCallback(
    (address: string) => {
      setRecents(addRecentChamber(chainId, address))
    },
    [chainId],
  )

  return { recents, remember }
}

async function getLogsChunked(
  client: PublicClient,
  params: Parameters<PublicClient['getLogs']>[0],
): Promise<Awaited<ReturnType<PublicClient['getLogs']>>> {
  try {
    return await client.getLogs({ ...params, fromBlock: 0n, toBlock: 'latest' })
  } catch {
    const latest = await client.getBlockNumber()
    const from = latest > LOG_LOOKBACK_BLOCKS ? latest - LOG_LOOKBACK_BLOCKS : 0n
    return client.getLogs({ ...params, fromBlock: from, toBlock: 'latest' })
  }
}

async function fetchCreatedChambers(
  client: PublicClient,
  factoryAddress: `0x${string}` | undefined,
  registryAddress: `0x${string}` | undefined,
): Promise<{ addresses: `0x${string}`[]; creators: Map<string, `0x${string}`> }> {
  const creators = new Map<string, `0x${string}`>()
  const addresses: `0x${string}`[] = []
  const seen = new Set<string>()

  const push = (chamber: Address | undefined, creator?: Address) => {
    if (!chamber || !isNonZeroAddress(chamber)) return
    const key = chamber.toLowerCase() as `0x${string}`
    if (!seen.has(key)) {
      seen.add(key)
      addresses.push(key)
    }
    if (creator && isNonZeroAddress(creator) && !creators.has(key)) {
      creators.set(key, creator.toLowerCase() as `0x${string}`)
    }
  }

  if (isNonZeroAddress(factoryAddress)) {
    try {
      const logs = await getLogsChunked(client, {
        address: factoryAddress,
        event: factoryCreatedEvent,
      })
      for (const log of logs) {
        push(log.args.chamber, log.args.creator)
      }
    } catch {
      // RPC getLogs limits — recents / open-address still work
    }
  }

  if (isNonZeroAddress(registryAddress)) {
    try {
      const logs = await getLogsChunked(client, {
        address: registryAddress,
        event: registryCreatedEvent,
      })
      for (const log of logs) {
        push(log.args.chamber)
      }
    } catch {
      // leftover Registry index is best-effort
    }
  }

  return { addresses, creators }
}

export type MyChamberEntry = {
  address: `0x${string}`
  isDirector: boolean
  balance: bigint
  isCreator: boolean
}

/**
 * Chambers the connected user participates in: Factory/Registry `ChamberCreated`
 * logs plus local recents, kept when the user is creator, a director, or holds shares.
 */
export function useMyChambers() {
  const { address: userAddress } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const factoryAddress = useFactoryAddress()
  const registryAddress = useRegistryAddress()
  const { recents, remember } = useRecentChambers()

  const factoryOk = isNonZeroAddress(factoryAddress)
  const registryOk = isNonZeroAddress(registryAddress)

  const query = useQuery({
    queryKey: [
      'my-chambers',
      chainId,
      userAddress,
      factoryOk ? factoryAddress : '0x0',
      registryOk ? registryAddress : '0x0',
      recents.join(),
    ],
    enabled: !!publicClient && !!userAddress && (factoryOk || registryOk || recents.length > 0),
    staleTime: 15_000,
    queryFn: async () => {
      if (!publicClient || !userAddress) return [] as MyChamberEntry[]

      const { addresses: fromLogs, creators } = await fetchCreatedChambers(
        publicClient,
        factoryOk ? factoryAddress : undefined,
        registryOk ? registryAddress : undefined,
      )

      const candidates: `0x${string}`[] = []
      const seen = new Set<string>()
      for (const addr of [...fromLogs, ...recents]) {
        const key = addr.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(addr)
      }

      if (candidates.length === 0) return [] as MyChamberEntry[]

      const user = userAddress.toLowerCase()
      const [dirs, bals] = await Promise.all([
        multicall(publicClient, {
          contracts: candidates.map((address) => ({
            address,
            abi: chamberAbi,
            functionName: 'getDirectors' as const,
          })),
          allowFailure: true,
        }),
        multicall(publicClient, {
          contracts: candidates.map((address) => ({
            address,
            abi: chamberAbi,
            functionName: 'balanceOf' as const,
            args: [userAddress] as const,
          })),
          allowFailure: true,
        }),
      ])

      const mine: MyChamberEntry[] = []
      for (let i = 0; i < candidates.length; i++) {
        const address = candidates[i]!
        const dirResult = dirs[i]
        const balResult = bals[i]
        const directors =
          dirResult?.status === 'success' ? (dirResult.result as `0x${string}`[]) : undefined
        const balance = balResult?.status === 'success' ? (balResult.result as bigint) : 0n
        const isDirector = !!directors?.some((d) => d.toLowerCase() === user)
        const hasBalance = balance > 0n
        const isCreator = creators.get(address) === user
        const isRecent = recents.some((r) => r === address)
        if (isCreator || isDirector || hasBalance || isRecent) {
          mine.push({ address, isDirector, balance, isCreator })
        }
      }
      return mine
    },
  })

  return {
    chambers: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    recents,
    remember,
    factoryAddress,
    registryAddress,
  }
}

export function useCreateChamberTarget() {
  const factoryAddress = useFactoryAddress()
  const registryAddress = useRegistryAddress()
  if (isNonZeroAddress(factoryAddress)) {
    return { address: factoryAddress, abi: factoryAbi, source: 'factory' as const }
  }
  if (isNonZeroAddress(registryAddress)) {
    return { address: registryAddress, abi: registryAbi, source: 'registry' as const }
  }
  return { address: undefined, abi: factoryAbi, source: 'none' as const }
}
