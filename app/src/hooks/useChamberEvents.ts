import { useEffect } from 'react'
import { useWatchContractEvent, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { chamberAbi } from '@/contracts/abis'
import { Log } from 'viem'

type RefetchCallback = () => void

interface UseChamberEventsOptions {
  /** Callback when any vault-related event occurs (Deposit, Withdraw, Transfer) */
  onVaultEvent?: RefetchCallback
  /** Callback when delegation-related event occurs */
  onDelegationEvent?: RefetchCallback
  /** Callback when transaction-related event occurs */
  onTransactionEvent?: RefetchCallback
  /** Callback when seats/board changes */
  onBoardEvent?: RefetchCallback
  /** Enable/disable event watching */
  enabled?: boolean
}

/**
 * Hook that watches for Chamber contract events and triggers refetches.
 * This ensures the UI updates when transactions are mined.
 * 
 * Usage:
 * ```tsx
 * useChamberEvents(chamberAddress, {
 *   onVaultEvent: () => {
 *     refetchBalance()
 *     refetchTotalAssets()
 *   },
 *   onDelegationEvent: () => {
 *     refetchDelegations()
 *     refetchBoardMembers()
 *   },
 * })
 * ```
 */
export function useChamberEvents(
  chamberAddress: `0x${string}` | undefined,
  options: UseChamberEventsOptions = {}
) {
  const {
    onVaultEvent,
    onDelegationEvent,
    onTransactionEvent,
    onBoardEvent,
    enabled = true,
  } = options

  const queryClient = useQueryClient()
  const publicClient = usePublicClient()

  const isValidAddress = chamberAddress && 
    chamberAddress !== '0x0000000000000000000000000000000000000000' &&
    chamberAddress.startsWith('0x') &&
    chamberAddress.length === 42

  const watchEnabled = enabled && !!isValidAddress && !!publicClient

  // Watch for Deposit events (ERC4626)
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'Deposit' as any, // ERC4626 Deposit event
    onLogs: (logs) => {
      console.log('Chamber Deposit event:', logs)
      invalidateChamberQueries()
      onVaultEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for Withdraw events (ERC4626)
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'Withdraw' as any, // ERC4626 Withdraw event
    onLogs: (logs) => {
      console.log('Chamber Withdraw event:', logs)
      invalidateChamberQueries()
      onVaultEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for Transfer events (share transfers)
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'Transfer' as any,
    onLogs: (logs) => {
      console.log('Chamber Transfer event:', logs)
      invalidateChamberQueries()
      onVaultEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for DelegationUpdated events
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'DelegationUpdated',
    onLogs: (logs) => {
      console.log('Chamber DelegationUpdated event:', logs)
      invalidateChamberQueries()
      onDelegationEvent?.()
      onBoardEvent?.() // Delegations affect board
    },
    enabled: watchEnabled,
  })

  // Watch for TransactionSubmitted events
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'TransactionSubmitted',
    onLogs: (logs) => {
      console.log('Chamber TransactionSubmitted event:', logs)
      invalidateChamberQueries()
      onTransactionEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for TransactionConfirmed events
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'TransactionConfirmed',
    onLogs: (logs) => {
      console.log('Chamber TransactionConfirmed event:', logs)
      invalidateChamberQueries()
      onTransactionEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for TransactionExecuted events
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'TransactionExecuted',
    onLogs: (logs) => {
      console.log('Chamber TransactionExecuted event:', logs)
      invalidateChamberQueries()
      onTransactionEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for SetSeats events (board size changes)
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'SetSeats',
    onLogs: (logs) => {
      console.log('Chamber SetSeats event:', logs)
      invalidateChamberQueries()
      onBoardEvent?.()
    },
    enabled: watchEnabled,
  })

  // Watch for ETH received
  useWatchContractEvent({
    address: isValidAddress ? chamberAddress : undefined,
    abi: chamberAbi,
    eventName: 'Received',
    onLogs: (logs) => {
      console.log('Chamber Received event:', logs)
      invalidateChamberQueries()
      onVaultEvent?.()
    },
    enabled: watchEnabled,
  })

  // Helper to invalidate all queries related to this chamber
  function invalidateChamberQueries() {
    if (!chamberAddress) return

    const chamberAddrLower = chamberAddress.toLowerCase()

    // Invalidate all queries that include this chamber address
    queryClient.invalidateQueries({
      predicate: (query) => {
        try {
          const keyStr = JSON.stringify(query.queryKey).toLowerCase()
          return keyStr.includes(chamberAddrLower)
        } catch {
          return false
        }
      },
    })
  }

  return { invalidateChamberQueries }
}

/**
 * Simplified hook that just invalidates queries on any Chamber event.
 * Use this when you don't need fine-grained control over which callbacks to run.
 */
export function useChamberEventRefresh(chamberAddress: `0x${string}` | undefined) {
  return useChamberEvents(chamberAddress, { enabled: true })
}
