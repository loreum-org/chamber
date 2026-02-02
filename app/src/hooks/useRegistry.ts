import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { registryAbi } from '@/contracts/abis'
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
    abi: registryAbi,
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
    abi: registryAbi,
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
    abi: registryAbi,
    functionName: 'isChamber',
    args: address ? [address] : undefined,
    query: { enabled: !!address && registryAddress !== '0x0000000000000000000000000000000000000000' },
  })

  return data as boolean | undefined
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
