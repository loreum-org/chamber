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
- Confirmations are per membership `tokenId` (token-weighted), not per address. One owner of `quorum` top-seat NFTs can self-confirm to threshold — a single-actor treasury.
- Confirmations can be revoked as long as the transaction hasn't been executed.

### 3. Execution
Once the number of confirmations reaches the **Quorum**, any Director can execute the transaction.
- The Chamber uses the **Checks-Effects-Interactions (CEI)** pattern to prevent reentrancy during execution.
- If a Director who confirmed a transaction is unseated before execution, their confirmation still counts (as the action was authorized while they were a Director).
- Ordinary calls store only `keccak256(calldata)`; the executor must re-supply the original bytes (typically recovered from the `SubmitTransaction` event).
- Self-calls (`target == Chamber`, restricted to `upgradeImplementation`) also persist the original bytes onchain. Execution may pass empty `data` and the stored payload is used, so a confirmed upgrade remains executable if logs are unavailable.

## Batch Operations

To improve efficiency and gas costs, the Wallet supports batch operations:
- `submitBatchTransactions`: Submit multiple calls in one go.
- `confirmBatchTransactions`: Confirm multiple pending transactions.
- `executeBatchTransactions`: Execute a series of authorized transactions.

## Assets the queue can move

The Chamber can hold **ETH**, the vault ERC-20, and **any ERC-721** received via `safeTransferFrom`. Directors move those assets by targeting the token contract (or an ETH recipient) in a queued call. **ERC-1155 cannot be received** via `safeTransferFrom` (no `onERC1155Received`). See **[Vaults](./vaults.md)**.

## Security Features
- **Non-Reentrant**: All execution functions are protected by a reentrancy guard.
- **Access Control**: Only Directors can interact with the wallet functions.
- **Atomicity**: Batch executions are atomic; if one fails, the entire batch reverts.
