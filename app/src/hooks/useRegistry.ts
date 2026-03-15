import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { chamberRegistryAbi, chamberAbi } from '@/contracts/abis'
import { getContractAddresses, hasValidAddresses } from '@/lib/wagmi'

export function useRegistryAddress() {
  const chainId = useChainId()
  return getContractAddresses(chainId).registry
}

export function useHasValidConfig() {
  const chainId = useChainId()
  return {
    isValid: hasValidAddresses(chainId),
    chainId,
  }
}

export function useAllChambers() {
  const registryAddress = useRegistryAddress()
  const isValidRegistry = registryAddress && 
    registryAddress !== '0x0000000000000000000000000000000000000000' &&
    registryAddress.startsWith('0x') &&
    registryAddress.length === 42
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: isValidRegistry ? registryAddress : undefined,
    abi: chamberRegistryAbi,
    functionName: 'getAllChambers',
    query: { 
      enabled: !!isValidRegistry,
      retry: 2,
      retryDelay: 1000,
    },
  })

  // Debug logging
  if (error) {
    console.error('useAllChambers error:', error)
  }
  if (!isValidRegistry) {
    console.warn('useAllChambers: Registry address is invalid, query disabled', { registryAddress })
  }

  // Filter out invalid addresses from the result
  const validChambers = data 
    ? (data as `0x${string}`[]).filter((addr) => 
        addr && 
        addr !== '0x0000000000000000000000000000000000000000' &&
        addr.startsWith('0x') &&
        addr.length === 42
      )
    : undefined

  return {
    chambers: validChambers,
    isLoading,
    error,
    refetch,
    registryAddress,
  }
}

export function useChamberCount() {
  const registryAddress = useRegistryAddress()
  const isValidRegistry = registryAddress && 
    registryAddress !== '0x0000000000000000000000000000000000000000' &&
    registryAddress.startsWith('0x') &&
    registryAddress.length === 42
  
  const { data, refetch, isLoading, error } = useReadContract({
    address: isValidRegistry ? registryAddress : undefined,
    abi: chamberRegistryAbi,
    functionName: 'getChamberCount',
    query: { 
      enabled: !!isValidRegistry,
      retry: 2,
      retryDelay: 1000,
    },
  })

  // Debug logging
  if (error) {
    console.error('useChamberCount error:', error)
  }
  if (!isValidRegistry) {
    console.warn('useChamberCount: Registry address is invalid, query disabled', { registryAddress })
  }

  return { 
    count: data ? Number(data) : 0,
    refetch,
    isLoading,
    error,
    registryAddress,
  }
}

export function useIsChamber(address: `0x${string}` | undefined) {
  const registryAddress = useRegistryAddress()
  
  const { data } = useReadContract({
    address: registryAddress,
    abi: chamberRegistryAbi,
    functionName: 'isChamber',
    args: address ? [address] : undefined,
    query: { enabled: !!address && registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return data as boolean | undefined
}

export function useChambersByAsset(asset: `0x${string}` | undefined) {
  const registryAddress = useRegistryAddress()
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: registryAddress,
    abi: chamberRegistryAbi,
    functionName: 'getChambersByAsset',
    args: asset ? [asset] : undefined,
    query: { enabled: !!asset && registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return {
    chambers: data as `0x${string}`[] | undefined,
    isLoading,
    error,
    refetch,
  }
}

export function useAssets() {
  const registryAddress = useRegistryAddress()
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: registryAddress,
    abi: chamberRegistryAbi,
    functionName: 'getAssets',
    query: { enabled: registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return {
    assets: data as `0x${string}`[] | undefined,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Groups chambers by their membership NFT (ERC721).
 * Organizations are defined by shared membership token.
 */
export function useOrganizationsByNFT() {
  const { chambers, isLoading: chambersLoading } = useAllChambers()
  
  const validChambers = (chambers ?? []).filter(
    (addr): addr is `0x${string}` =>
      !!addr &&
      addr !== '0x0000000000000000000000000000000000000000' &&
      addr.startsWith('0x') &&
      addr.length === 42
  )

  const { data: nftResults, isLoading: nftsLoading } = useReadContracts({
    contracts: validChambers.map((addr) => ({
      address: addr,
      abi: chamberAbi,
      functionName: 'nft',
    })) as readonly { address: `0x${string}`; abi: typeof chamberAbi; functionName: 'nft' }[],
    query: {
      enabled: validChambers.length > 0,
    },
  })

  const organizations = (() => {
    if (!nftResults || nftResults.length !== validChambers.length) return []
    const byNft = new Map<string, `0x${string}`[]>()
    for (let i = 0; i < validChambers.length; i++) {
      const r = nftResults[i]
      const chamber = validChambers[i]
      if (r?.status === 'success' && r.result && chamber) {
        const nft = (r.result as string).toLowerCase() as `0x${string}`
        if (!byNft.has(nft)) byNft.set(nft, [])
        byNft.get(nft)!.push(chamber)
      }
    }
    return Array.from(byNft.entries()).map(([nft, chams]) => ({
      nft: nft as `0x${string}`,
      chambers: chams,
    }))
  })()

  return {
    organizations,
    isLoading: chambersLoading || nftsLoading,
  }
}

export function useParentChamber(chamber: `0x${string}` | undefined) {
  const registryAddress = useRegistryAddress()
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: registryAddress,
    abi: chamberRegistryAbi,
    functionName: 'getParentChamber',
    args: chamber ? [chamber] : undefined,
    query: { enabled: !!chamber && registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return {
    parentChamber: data as `0x${string}` | undefined,
    isLoading,
    error,
    refetch,
  }
}

export function useChildChambers(chamber: `0x${string}` | undefined) {
  const registryAddress = useRegistryAddress()
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: registryAddress,
    abi: chamberRegistryAbi,
    functionName: 'getChildChambers',
    args: chamber ? [chamber] : undefined,
    query: { enabled: !!chamber && registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return {
    childChambers: data as `0x${string}`[] | undefined,
    isLoading,
    error,
    refetch,
  }
}

export function useCreateChamber() {
  const registryAddress = useRegistryAddress()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const createChamber = async (
    erc20Token: `0x${string}`,
    erc721Token: `0x${string}`,
    seats: number,
    name: string,
    symbol: string
  ) => {
    writeContract({
      address: registryAddress,
      abi: chamberRegistryAbi,
      functionName: 'createChamber',
      args: [erc20Token, erc721Token, BigInt(seats), name, symbol],
    })
  }

  return {
    createChamber,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    receipt,
  }
}
