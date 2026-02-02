// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title IWallet
 * @notice Interface for Wallet multisig functionality
 * @dev Transaction struct is defined in Wallet.sol - use Wallet.Transaction type
 */
interface IWallet {

    /**
     * @notice Submits a new transaction for approval
     * @param tokenId The tokenId submitting the transaction
     * @param target The address to send the transaction to
     * @param value The amount of Ether to send
     * @param data The data to include in the transaction
     */
    function submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) external;

    /**
     * @notice Confirms a transaction
     * @param tokenId The tokenId confirming the transaction
     * @param transactionId The ID of the transaction to confirm
     */
    function confirmTransaction(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Executes a transaction if it has enough confirmations
     * @param tokenId The tokenId executing the transaction
     * @param transactionId The ID of the transaction to execute
     */
    function executeTransaction(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Revokes a confirmation for a transaction
     * @param tokenId The tokenId revoking the confirmation
     * @param transactionId The ID of the transaction to revoke confirmation for
     */
    function revokeConfirmation(uint256 tokenId, uint256 transactionId) external;

    /**
     * @notice Submits multiple transactions for approval in a single call
     * @param tokenId The tokenId submitting the transactions
     * @param targets The array of addresses to send the transactions to
     * @param values The array of amounts of Ether to send
     * @param data The array of data to include in each transaction
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
     * @param tokenId The tokenId executing the transactions
     * @param transactionIds The array of transaction IDs to execute
     */
    function executeBatchTransactions(uint256 tokenId, uint256[] memory transactionIds) external;

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() external view returns (uint256);

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return The Transaction struct containing the transaction details (Wallet.Transaction)
     */
    /// @dev Returns Transaction struct (defined in Wallet.sol)
    function getTransaction(uint256 nonce) external view returns (bool executed, uint8 confirmations, address target, uint256 value, bytes memory data);

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) external view returns (bool);

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
     * @param data The calldata for the transaction
     */
    event SubmitTransaction(uint256 indexed tokenId, uint256 indexed nonce, address indexed to, uint256 value, bytes data);

    /**
     * @notice Emitted when a transaction is confirmed by a leader
     * @param tokenId The tokenId of the leader confirming
     * @param nonce The identifier of the confirmed transaction
     */
    event ConfirmTransaction(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a confirmation is revoked by a leader
     * @param tokenId The tokenId of the leader revoking confirmation
     * @param nonce The identifier of the transaction
     */
    event RevokeConfirmation(uint256 indexed tokenId, uint256 indexed nonce);

    /**
     * @notice Emitted when a transaction is executed
     * @param tokenId The tokenId of the leader executing the transaction
     * @param nonce The identifier of the executed transaction
     */
    event ExecuteTransaction(uint256 indexed tokenId, uint256 indexed nonce);

    /// Errors
    /// @notice Thrown when a transaction does not exist
    error TransactionDoesNotExist();

    /// @notice Thrown when a transaction has already been executed
    error TransactionAlreadyExecuted();

    /// @notice Thrown when a transaction has already been confirmed by the same tokenId
    error TransactionAlreadyConfirmed();

    /// @notice Thrown when trying to revoke a confirmation that doesn't exist
    error TransactionNotConfirmed();

    /// @notice Thrown when a transaction execution fails
    /// @param reason The reason for the failure
    error TransactionFailed(bytes reason);

    /// @notice Thrown when transaction target is invalid
    error InvalidTarget();
}
