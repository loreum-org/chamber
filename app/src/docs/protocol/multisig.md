# Multisig Wallet

The Wallet contract provides the multi-signature capabilities of the Chamber, allowing Directors to securely manage assets and interact with external protocols.

## Transaction Lifecycle

### 1. Submission
Any current Director can submit a transaction.
- Submitting a transaction automatically counts as a confirmation from that Director.
- Supports target address, ETH value, and arbitrary calldata.

### 2. Confirmation
Other Directors must confirm the transaction.
- Only current Directors (those in the top seats) can confirm.
- Confirmations can be revoked as long as the transaction hasn't been executed.

### 3. Execution
Once the number of confirmations reaches the **Quorum**, any Director can execute the transaction.
- The Chamber uses the **Checks-Effects-Interactions (CEI)** pattern to prevent reentrancy during execution.
- If a Director who confirmed a transaction is unseated before execution, their confirmation still counts (as the action was authorized while they were a Director).

## Batch Operations

To improve efficiency and gas costs, the Wallet supports batch operations:
- `submitBatchTransactions`: Submit multiple calls in one go.
- `confirmBatchTransactions`: Confirm multiple pending transactions.
- `executeBatchTransactions`: Execute a series of authorized transactions.

## Security Features
- **Non-Reentrant**: All execution functions are protected by a reentrancy guard.
- **Access Control**: Only Directors can interact with the wallet functions.
- **Atomicity**: Batch executions are atomic; if one fails, the entire batch reverts.
