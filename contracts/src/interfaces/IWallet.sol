// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IWallet
 * @author xhad, Loreum DAO LLC
 * @notice Director-gated multisig: submit, confirm, execute, revoke, and cancel transaction flows.
 * @dev Ordinary calls store only `keccak256(calldata)`; callers must retain full calldata to execute.
 *      Self-calls (`target == address(this)`, Chamber: `upgradeImplementation`) also persist the
 *      original bytes onchain so a confirmed upgrade remains executable if logs are unavailable.
 *      Confirmation and execution require a quorum of distinct director token IDs as enforced by `Chamber`.
 *      That quorum is token-weighted: one address that holds `quorum` top-seat membership NFTs
 *      can submit, self-confirm, and execute (a single-actor treasury). Confirmations are not
 *      capped per owner.
 *      Submit records a deadline (default 30 days, or an explicit future timestamp up to that max).
 *      After a non-zero deadline, confirm/revoke/execute revert with `TransactionExpired`.
 *      Stored deadline `0` is unset (pre-upgrade pending) and is not expired.
 */
interface IWallet {
    /**
     * @notice Submits a new transaction for approval
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The calldata (hash stored always; full bytes stored when `target` is this wallet)
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) external;

    /**
     * @notice Submits a new transaction for approval with an explicit execution deadline
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The calldata (stored onchain as keccak256 hash only)
     * @param deadline Exclusive-after unix timestamp; `0` applies the 30-day default max age
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data, uint256 deadline)
        external;

    /**
     * @notice Submits a new transaction for approval with durable proposal metadata
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The calldata (hash stored always; full bytes stored when `target` is this wallet)
     * @param metadataURI URI or content hash describing the proposal rationale and risk context
     */
    function submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI
    ) external;

    /**
     * @notice Submits a new transaction with durable proposal metadata and an explicit deadline
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The calldata (stored onchain as keccak256 hash only)
     * @param metadataURI URI or content hash describing the proposal rationale and risk context
     * @param deadline Exclusive-after unix timestamp; `0` applies the 30-day default max age
     */
    function submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) external;

    /**
     * @notice Adds one confirmation for `transactionId` from director `tokenId`.
     * @dev Reverts if the transaction is cancelled, already executed, or already confirmed by this `tokenId`.
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Executes a transaction if it has enough confirmations
     * @dev Caller must supply the original calldata unless it was stored onchain for a self-call
     *      (Chamber: `upgradeImplementation`). Empty `data` then uses the stored bytes.
     *      The contract always verifies keccak256(payload) == stored hash.
     * @param tokenId The tokenId executing the transaction
     * @param transactionId The ID of the transaction to execute
     * @param data The original calldata, or empty to use stored self-call bytes
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId, bytes calldata data) external;

    /**
     * @notice Revokes a confirmation for a transaction
     * @param tokenId The tokenId revoking the confirmation
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Records a director's vote to cancel a transaction. Requires quorum of directors to cancel.
     * @param tokenId The tokenId voting to cancel
     * @param transactionId The ID of the transaction to cancel
     */
    function cancelTransaction(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Submits multiple transactions for approval in a single call
     * @param tokenId The tokenId submitting the transactions
     * @param targets The array of addresses to send the transactions to
     * @param values The array of amounts of Ether to send
     * @param data The array of calldata (hash stored always; full bytes stored for self-calls)
     */
    function submitBatchTransactions(
        uint256 tokenId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory data
    ) external;

    /**
     * @notice Confirms multiple transactions in a single call
     * @param tokenId The tokenId confirming the transactions
     * @param transactionIds The array of transaction IDs to confirm
     */
    function confirmBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) external;

    /**
     * @notice Executes multiple transactions in a single call if they have enough confirmations
     * @dev Caller must supply the original calldata for each hash-only transaction, in the same
     *      order as transactionIds. Self-call entries may be empty and use the onchain store.
     * @param tokenId The tokenId executing the transactions
     * @param transactionIds The array of transaction IDs to execute
     * @param data The array of original calldata for each transaction (empty allowed for stored self-calls)
     */
    function executeBatchTransactions(uint256 tokenId, uint256[] memory transactionIds, bytes[] calldata data) external;

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() external view returns (uint256);

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return executed Whether the transaction has been executed
     * @return confirmations Number of confirmations
     * @return target The target address
     * @return value The ETH value
     * @return dataHash keccak256 of the original calldata (re-supply at execution unless stored)
     */
    function getTransaction(uint256 nonce)
        external
        view
        returns (bool executed, uint8 confirmations, address target, uint256 value, bytes32 dataHash);

    /**
     * @notice Returns durable metadata URI or content hash for a transaction proposal
     * @param nonce The index of the transaction to retrieve metadata for
     * @return metadataURI URI or content hash supplied at proposal creation
     */
    function getTransactionMetadata(uint256 nonce) external view returns (string memory metadataURI);

    /**
     * @notice Returns onchain-stored calldata for a self-call / upgrade, or empty bytes for hash-only txs
     * @param nonce The index of the transaction to retrieve stored calldata for
     * @return storedCalldata Original bytes if this nonce targeted the wallet itself; otherwise empty
     */
    function getTransactionCalldata(uint256 nonce) external view returns (bytes memory storedCalldata);

    /**
     * @notice Returns the quorum snapshotted when the transaction was submitted
     * @param nonce The index of the transaction to retrieve
     * @return requiredQuorum Quorum recorded at submit time (0 if unset / legacy)
     */
    function getTransactionRequiredQuorum(uint256 nonce) external view returns (uint256 requiredQuorum);

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) external view returns (bool);

    /**
     * @notice Returns whether a transaction has been cancelled
     * @param nonce The index of the transaction to check
     * @return True if the transaction is cancelled
     */
    function getCancelled(uint256 nonce) external view returns (bool);

    /**
     * @notice Returns the exclusive-after unix timestamp after which the transaction cannot be executed
     * @param nonce The index of the transaction to retrieve
     * @return deadline Stored deadline timestamp; `0` means unset / no expiry
     */
    function getTransactionDeadline(uint256 nonce) external view returns (uint256 deadline);

    /**
     * @notice Returns whether a transaction has passed its deadline
     * @param nonce The index of the transaction to check
     * @return True if a non-zero deadline is stored and has passed; `false` when deadline is `0`
     */
    function isTransactionExpired(uint256 nonce) external view returns (bool);

    /**
     * @notice Checks if a director has voted to cancel a transaction
     * @param tokenId The tokenId of the director to check
     * @param nonce The index of the transaction to check
     * @return True if the director has voted to cancel
     */
    function getCancelConfirmation(uint256 tokenId, uint256 nonce) external view returns (bool);

    /**
     * @notice Returns the number of directors who have voted to cancel a transaction
     * @param nonce The index of the transaction to check
     * @return The count of cancel votes
     */
    function getCancelConfirmations(uint256 nonce) external view returns (uint8);

    /**
     * @notice Returns the next transaction ID (current nonce)
     * @return uint256 The next transaction ID
     */
    function getNextTransactionId() external view returns (uint256);

    /// Events
    /**
     * @notice Emitted when a new transaction is submitted
     * @param tokenId The tokenId submitting the transaction
     * @param nonce The unique identifier for the transaction
     * @param to The target address for the transaction
     * @param value The amount of ETH to send
     * @param data The original calldata (emitted for offchain persistence; also stored onchain for self-calls)
     */
    event SubmitTransaction(
        uint256 indexed tokenId, uint256 indexed nonce, address indexed to, uint256 value, bytes data
    );

    /**
     * @notice Emitted when proposal metadata is attached to a transaction
     * @param nonce The transaction identifier
     * @param metadataURI URI or content hash describing the proposal
     */
    event ProposalMetadataSet(uint256 indexed nonce, string metadataURI);

    /**
     * @notice Emitted when a transaction is confirmed by a director
     * @param tokenId The token ID of the director confirming
     * @param nonce The identifier of the confirmed transaction
     */
    event ConfirmTransaction(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a confirmation is revoked by a director
     * @param tokenId The token ID of the director revoking confirmation
     * @param nonce The identifier of the transaction
     */
    event RevokeConfirmation(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a transaction is executed
     * @param tokenId The token ID of the director executing the transaction
     * @param nonce The identifier of the executed transaction
     */
    event ExecuteTransaction(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a director votes to cancel a transaction
     * @param tokenId The token ID of the director voting to cancel
     * @param nonce The identifier of the transaction
     */
    event CancelTransaction(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a transaction is cancelled (quorum of cancel votes reached)
     * @param nonce The identifier of the cancelled transaction
     */
    event TransactionCancelled(uint256 indexed nonce);

    /**
     * @notice Emitted when a transaction deadline is recorded at submit time
     * @param nonce The identifier of the transaction
     * @param deadline Exclusive-after unix timestamp after which execute/confirm/revoke revert (never `0`)
     */
    event TransactionDeadlineSet(uint256 indexed nonce, uint256 deadline);

    /// Errors
    /// @notice Thrown when a transaction does not exist
    error TransactionDoesNotExist();

    /// @notice Thrown when a transaction has already been executed
    error TransactionAlreadyExecuted();

    /// @notice Thrown when a transaction has already been confirmed by the same tokenId
    error TransactionAlreadyConfirmed();

    /// @notice Thrown when trying to revoke a confirmation that doesn't exist
    error TransactionNotConfirmed();

    /// @notice Thrown when a transaction has already been cancelled
    error TransactionAlreadyCancelled();

    /// @notice Thrown when a transaction's deadline has passed
    error TransactionExpired();

    /// @notice Thrown when a submit deadline is not in the future or exceeds the 30-day max age
    error InvalidDeadline();

    /// @notice Thrown when a director has already voted to cancel
    error TransactionCancelAlreadyConfirmed();

    /// @notice Thrown when a transaction execution fails
    /// @param reason The reason for the failure
    error TransactionFailed(bytes reason);

    /// @notice Thrown when transaction target is invalid
    error InvalidTarget();

    /// @notice Thrown when the supplied calldata does not match the stored keccak256 hash
    error DataHashMismatch();
}
