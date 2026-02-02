# Transaction Status Hooks

This directory contains hooks for handling blockchain transactions with comprehensive status tracking, event listeners, and user notifications.

## `useTransactionStatus`

A low-level hook that tracks transaction status and provides callbacks for success/error states.

### Features

- ✅ Tracks transaction status: `idle`, `pending`, `confirming`, `success`, `error`
- ✅ Automatic event listeners using wagmi's `useWaitForTransactionReceipt` and `useWatchPendingTransactions`
- ✅ Toast notifications on success/error
- ✅ Customizable callbacks for success and error
- ✅ Auto-reset option
- ✅ Manual reset capability

### Usage

```tsx
import { useTransactionStatus } from '@/hooks'

function MyComponent() {
  const [txHash, setTxHash] = useState<Hash | undefined>()
  
  const { status, isPending, isConfirming, isSuccess, isError, error, reset } = useTransactionStatus({
    hash: txHash,
    onSuccess: (receipt) => {
      console.log('Transaction confirmed!', receipt)
      // Refetch data, update UI, etc.
    },
    onError: (error) => {
      console.error('Transaction failed:', error)
      // Handle error, show user message, etc.
    },
    successMessage: 'Transaction confirmed!',
    errorMessage: 'Transaction failed',
    showNotifications: true,
    autoReset: false,
  })

  const handleTransaction = async () => {
    // ... send transaction
    setTxHash(transactionHash)
  }

  return (
    <div>
      {status === 'pending' && <p>Waiting for wallet confirmation...</p>}
      {status === 'confirming' && <p>Transaction confirming...</p>}
      {status === 'success' && <p>Success!</p>}
      {status === 'error' && <p>Error: {error?.message}</p>}
      <button onClick={handleTransaction}>Send Transaction</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}
```

## Enhanced Hooks

Pre-built hooks that combine `useWriteContract` with `useTransactionStatus` for common operations:

- `useSubmitTransactionWithStatus` - Submit chamber transactions
- `useConfirmTransactionWithStatus` - Confirm transactions
- `useExecuteTransactionWithStatus` - Execute transactions
- `useDelegateWithStatus` - Delegate voting power
- `useDepositWithStatus` - Deposit assets
- `useWithdrawWithStatus` - Withdraw assets
- `useTokenApproveWithStatus` - Approve token spending
- `useCreateChamberWithStatus` - Create new chambers

### Usage Example

```tsx
import { useCreateChamberWithStatus } from '@/hooks'
import { useRegistryAddress } from '@/hooks/useRegistry'

function DeployChamber() {
  const registryAddress = useRegistryAddress()
  
  const {
    createChamber,
    status,
    isPending,
    isConfirming,
    isSuccess,
    isError,
    error,
    hash,
    reset,
  } = useCreateChamberWithStatus(registryAddress, {
    onSuccess: () => {
      console.log('Chamber created!')
      // Navigate, refetch data, etc.
    },
    onError: (err) => {
      console.error('Failed:', err)
      // Show error, reset form, etc.
    },
    successMessage: 'Chamber deployed successfully!',
    errorMessage: 'Failed to deploy chamber',
  })

  const handleSubmit = async () => {
    try {
      reset() // Clear previous state
      await createChamber(
        erc20Token,
        erc721Token,
        seats,
        name,
        symbol
      )
    } catch (err) {
      // Error handling is done by the hook
    }
  }

  return (
    <div>
      <button 
        onClick={handleSubmit}
        disabled={isPending || isConfirming}
      >
        {status === 'pending' && 'Confirm in Wallet...'}
        {status === 'confirming' && 'Deploying...'}
        {status === 'success' && 'Deployed!'}
        {status === 'idle' && 'Deploy Chamber'}
      </button>
      
      {status === 'error' && (
        <div>
          <p>Error: {error?.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
      
      {hash && (
        <p>Transaction: {hash}</p>
      )}
    </div>
  )
}
```

## Generic Hook: `useWriteContractWithStatus`

For custom contract interactions:

```tsx
import { useWriteContractWithStatus } from '@/hooks'
import { chamberAbi } from '@/contracts/abis'

function CustomTransaction() {
  const { execute, status, isSuccess, reset } = useWriteContractWithStatus(
    {
      address: chamberAddress,
      abi: chamberAbi,
      functionName: 'submitTransaction',
    },
    {
      onSuccess: () => refetch(),
      successMessage: 'Transaction submitted!',
    }
  )

  const handleSubmit = async () => {
    await execute({
      args: [tokenId, target, value, data],
    })
  }

  return (
    <button onClick={handleSubmit} disabled={status !== 'idle'}>
      Submit
    </button>
  )
}
```

## Status States

- `idle` - No transaction in progress
- `pending` - Waiting for user to confirm in wallet
- `confirming` - Transaction sent, waiting for blockchain confirmation
- `success` - Transaction confirmed successfully
- `error` - Transaction failed or was rejected

## Best Practices

1. **Always reset before new transactions**: Call `reset()` before initiating a new transaction to clear previous state
2. **Handle errors gracefully**: Use `onError` callback to update UI, show messages, or retry logic
3. **Update data on success**: Use `onSuccess` callback to refetch data or update application state
4. **Show transaction hash**: Display the transaction hash so users can track it on block explorers
5. **Disable buttons during transactions**: Use `isPending` or `isConfirming` to disable form submissions
6. **Provide clear feedback**: Use the status states to show appropriate UI feedback to users
