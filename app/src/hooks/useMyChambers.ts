import { useCallback, useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { multicall } from 'viem/actions'
import { chamberAbi, factoryAbi, registryAbi } from '@/contracts/abis'
import {
  discoverChambers,
  EMPTY_DISCOVERY_HEALTH,
  shouldShowDiscoveryGap,
  type ChamberDiscoveryHealth,
} from '@/lib/chamberDiscovery'
import { getIndexerUrl, indexerAppliesToChain } from '@/lib/indexer'
import { isLegacyChamberVersion } from '@/lib/chamberUpgrade'
import { chamberVersionBytes32ToLabel } from '@/lib/utils'
import { addRecentChamber, getRecentChambers } from '@/lib/recentChambers'
import { TESTNET_DEPLOYMENTS } from '@/lib/testnetDeployments'
import {
  config,
  getConfiguredChainIds,
  getContractAddresses,
  getDiscoveryFactoryAddresses,
  isNonZeroAddress,
} from '@/lib/wagmi'
import { useFactoryAddress, useRegistryAddress } from './useRegistry'

export type RecentChamber = { chainId: number; address: `0x${string}` }

function readRecents(chainIds: readonly number[]): RecentChamber[] {
  return chainIds.flatMap((chainId) =>
    getRecentChambers(chainId).map((address) => ({ chainId, address })),
  )
}

/** Chambers opened recently, on every configured chain. `remember` stores on the wallet's chain. */
export function useRecentChambers() {
  const chainId = useChainId()
  const chainIds = getConfiguredChainIds()
  const chainKey = chainIds.join()
  const [recents, setRecents] = useState<RecentChamber[]>(() => readRecents(chainIds))

  useEffect(() => {
    setRecents(readRecents(chainKey ? chainKey.split(',').map(Number) : []))
  }, [chainKey, chainId])

  const remember = useCallback(
    (address: string, onChainId: number = chainId) => {
      addRecentChamber(onChainId, address)
      setRecents(readRecents(chainKey ? chainKey.split(',').map(Number) : []))
    },
    [chainId, chainKey],
  )

  return { recents, remember }
}

export type MyChamberEntry = {
  address: `0x${string}`
  chainId: number
  isDirector: boolean
  balance: bigint
  isCreator: boolean
  /** Older than 1.2.0 (or no readable VERSION): cannot be upgraded in place. */
  isLegacy: boolean
}

type ChainChambers = { chambers: MyChamberEntry[]; health: ChamberDiscoveryHealth }

async function findMyChambersOnChain(
  chainId: number,
  userAddress: `0x${string}`,
  recents: readonly `0x${string}`[],
): Promise<ChainChambers> {
  const client = getPublicClient(config, { chainId })
  if (!client) return { chambers: [], health: EMPTY_DISCOVERY_HEALTH }

  const addresses = getContractAddresses(chainId)
  const [factoryAddress, ...extraFactoryAddresses] = getDiscoveryFactoryAddresses(chainId)
  const registryAddress = isNonZeroAddress(addresses?.registry) ? addresses?.registry : undefined

  const { addresses: discovered, creators, health } = await discoverChambers({
    client,
    chainId,
    userAddress,
    factoryAddress,
    extraFactoryAddresses,
    factoryStartBlock: TESTNET_DEPLOYMENTS[chainId]?.factoryStartBlock,
    registryAddress,
  })

  const candidates: `0x${string}`[] = []
  const seen = new Set<string>()
  for (const addr of [...discovered, ...recents]) {
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(addr)
  }

  if (candidates.length === 0) return { chambers: [], health }

  const user = userAddress.toLowerCase()
  const [dirs, bals, versions] = await Promise.all([
    multicall(client, {
      contracts: candidates.map((address) => ({
        address,
        abi: chamberAbi,
        functionName: 'getDirectors' as const,
      })),
      allowFailure: true,
    }),
    multicall(client, {
      contracts: candidates.map((address) => ({
        address,
        abi: chamberAbi,
        functionName: 'balanceOf' as const,
        args: [userAddress] as const,
      })),
      allowFailure: true,
    }),
    multicall(client, {
      contracts: candidates.map((address) => ({
        address,
        abi: chamberAbi,
        functionName: 'VERSION' as const,
      })),
      allowFailure: true,
    }),
  ])

  const mine: MyChamberEntry[] = []
  for (let i = 0; i < candidates.length; i++) {
    const address = candidates[i]!
    const dirResult = dirs[i]
    const balResult = bals[i]
    // Recents can hold an address that is not a chamber on this chain; skip it.
    if (dirResult?.status !== 'success' && !discovered.includes(address)) continue
    const directors =
      dirResult?.status === 'success' ? (dirResult.result as `0x${string}`[]) : undefined
    const balance = balResult?.status === 'success' ? (balResult.result as bigint) : 0n
    const isDirector = !!directors?.some((d) => d.toLowerCase() === user)
    const hasBalance = balance > 0n
    const isCreator = creators.get(address) === user
    const isRecent = recents.includes(address)
    const versionResult = versions[i]
    const versionLabel =
      versionResult?.status === 'success'
        ? chamberVersionBytes32ToLabel(versionResult.result as `0x${string}`)
        : undefined
    const isLegacy = isLegacyChamberVersion(versionLabel)
    if (isCreator || isDirector || hasBalance || isRecent) {
      mine.push({ address, chainId, isDirector, balance, isCreator, isLegacy })
    }
  }
  return { chambers: mine, health }
}

/**
 * Chambers the connected user participates in, on every chain that has a
 * Factory or Registry: Ponder indexer (optional) + Factory/Registry
 * `ChamberCreated` logs plus local recents, kept when the user is creator, a
 * director, or holds shares. Each chain is queried on its own, so one slow or
 * failing RPC does not hide chambers on the others.
 */
export function useMyChambers() {
  const { address: userAddress } = useAccount()
  const factoryAddress = useFactoryAddress()
  const registryAddress = useRegistryAddress()
  const { recents, remember } = useRecentChambers()
  const queryClient = useQueryClient()
  const chainIds = getConfiguredChainIds()

  const results = useQueries({
    queries: chainIds.map((chainId) => {
      const chainRecents = recents.filter((r) => r.chainId === chainId).map((r) => r.address)
      return {
        queryKey: [
          'my-chambers',
          chainId,
          userAddress,
          getDiscoveryFactoryAddresses(chainId).join(),
          getContractAddresses(chainId)?.registry ?? '0x0',
          indexerAppliesToChain(chainId) ? getIndexerUrl() ?? '' : '',
          chainRecents.join(),
        ],
        enabled: !!userAddress,
        staleTime: 15_000,
        queryFn: () => findMyChambersOnChain(chainId, userAddress!, chainRecents),
      }
    }),
  })

  const found = results.flatMap((r) => r.data?.chambers ?? [])
  // Chambers older than 1.2.0 cannot be upgraded in place, so they are hidden by default.
  const chambers = found.filter((c) => !c.isLegacy)
  const legacyChambers = found.filter((c) => c.isLegacy)
  const legacyKeys = new Set(legacyChambers.map((c) => `${c.chainId}:${c.address.toLowerCase()}`))
  const currentRecents = recents.filter((r) => !legacyKeys.has(`${r.chainId}:${r.address.toLowerCase()}`))
  const isLoading = results.length > 0 && results.every((r) => r.isLoading)
  const failedChainIds = chainIds.filter((_, i) => {
    const r = results[i]!
    return shouldShowDiscoveryGap({
      connected: !!userAddress,
      loading: r.isLoading,
      queryFailed: r.isError,
      health: r.data?.health,
    })
  })

  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: ['my-chambers'] }),
    [queryClient],
  )

  return {
    /** The user's chambers on 1.2.0 or newer. */
    chambers,
    /** The user's chambers older than 1.2.0, hidden unless the page asks for them. */
    legacyChambers,
    /** True while no chain has answered yet. Chains that answer first show right away. */
    isLoading,
    /** True while at least one chain is still loading. */
    isFetchingMore: results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error ?? null,
    discoveryIncomplete: failedChainIds.length > 0,
    /** Chains whose lookup failed or was only partly answered. */
    failedChainIds,
    refetch,
    /** Recently opened chambers, minus known legacy ones. */
    recents: currentRecents,
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
