import { useQuery } from '@tanstack/react-query'
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  usePublicClient,
} from 'wagmi'
import { zeroAddress, type Hex } from 'viem'
import { registryAbi, chamberAbi } from '@/contracts/abis'
import {
  getContractAddresses,
  hasValidAddresses,
} from '@/lib/wagmi'
import {
  ERC1967_IMPLEMENTATION_SLOT,
  addressFromEip1967ImplementationSlot,
  chamberVersionBytes32ToLabel,
} from '@/lib/utils'

export function useRegistryAddress() {
  const chainId = useChainId()
  return getContractAddresses(chainId)?.registry ?? '0x0000000000000000000000000000000000000000' as `0x${string}`
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
    abi: registryAbi,
    functionName: 'getAllChambers',
    query: { 
      enabled: !!isValidRegistry,
      retry: 2,
      retryDelay: 1000,
    },
  })

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
    abi: registryAbi,
    functionName: 'getChamberCount',
    query: { 
      enabled: !!isValidRegistry,
      retry: 2,
      retryDelay: 1000,
    },
  })

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
    abi: registryAbi,
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
    abi: registryAbi,
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
    abi: registryAbi,
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
    abi: registryAbi,
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
    abi: registryAbi,
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
      abi: registryAbi,
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

/**
 * Compare this chamber proxy’s EIP-1967 implementation with the Registry’s
 * default implementation used for new deployments. When the Registry bumps
 * its implementation pointer, existing proxies may lag until upgraded.
 */
export function useChamberRegistryImplementationSync(chamberAddress: `0x${string}` | undefined) {
  const registryAddress = useRegistryAddress()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const registryOk =
    registryAddress &&
    registryAddress !== zeroAddress &&
    registryAddress.startsWith('0x') &&
    registryAddress.length === 42

  const { data: registryImplementation, isLoading: registryImplLoading } = useReadContract({
    address: registryOk ? registryAddress : undefined,
    abi: registryAbi,
    functionName: 'implementation',
    query: { enabled: !!registryOk && !!chamberAddress },
  })

  const regImpl =
    registryImplementation && registryImplementation !== zeroAddress
      ? (registryImplementation as `0x${string}`)
      : undefined

  const { data: proxyImplementationAddress, isLoading: slotLoading } = useQuery({
    queryKey: ['chamberProxyImplementation', chamberAddress, chainId],
    queryFn: async () => {
      if (!publicClient || !chamberAddress) return undefined
      const raw = await publicClient.getStorageAt({
        address: chamberAddress,
        slot: ERC1967_IMPLEMENTATION_SLOT,
      })
      return addressFromEip1967ImplementationSlot(raw as Hex | undefined)
    },
    enabled: !!chamberAddress && !!publicClient,
  })

  const { data: chamberVerRaw, isLoading: chamberVerLoading } = useReadContract({
    address: chamberAddress,
    abi: chamberAbi,
    functionName: 'VERSION',
    query: { enabled: !!chamberAddress },
  })

  const { data: registryVerRaw, isLoading: registryVerLoading } = useReadContract({
    address: regImpl,
    abi: chamberAbi,
    functionName: 'VERSION',
    query: { enabled: !!regImpl },
  })

  const chamberVersionLabel = chamberVersionBytes32ToLabel(chamberVerRaw as Hex | undefined)
  const registryImplementationVersionLabel = chamberVersionBytes32ToLabel(registryVerRaw as Hex | undefined)

  const implMismatch =
    !!proxyImplementationAddress &&
    !!regImpl &&
    proxyImplementationAddress.toLowerCase() !== regImpl.toLowerCase()

  return {
    proxyImplementationAddress,
    registryImplementation: regImpl,
    chamberVersionLabel,
    registryImplementationVersionLabel,
    implMismatch,
    registryAddress: registryOk ? registryAddress : undefined,
    isLoading:
      registryImplLoading || slotLoading || chamberVerLoading || registryVerLoading,
  }
}
