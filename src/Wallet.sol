// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Wallet {
    /**
     * @notice Structure representing a transaction in the wallet
     * @param executed Whether the transaction has been executed
     * @param confirmations Number of confirmations received for this transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send with the transaction
     * @param data The calldata to be executed
     */
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes data;
    }

    /// @notice Array of all transactions submitted to the wallet
    Transaction[] private transactions;

    /// @notice Mapping from transaction nonce to tokenId to confirmation status
    mapping(uint256 => mapping(uint256 => bool)) private isConfirmed;

    /**
     * @notice Emitted when a new transaction is submitted
     * @param tokenId The tokenId submitting the transaction
     * @param nonce The unique identifier for the transaction
     * @param to The target address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata for the transaction
     */
    event SubmitTransaction(uint256 tokenId, uint256 nonce, address indexed to, uint256 value, bytes data);

    /**
     * @notice Emitted when a transaction is confirmed by a leader
     * @param tokenId The address of the leader confirming
     * @param nonce The identifier of the confirmed transaction
     */
    event ConfirmTransaction(uint256 tokenId, uint256 nonce);

    /**
     * @notice Emitted when a confirmation is revoked by a leader
     * @param tokenId The address of the leader revoking confirmation
     * @param nonce The identifier of the transaction
     */
    event RevokeConfirmation(uint256 tokenId, uint256 nonce);

    /**
     * @notice Emitted when a transaction is executed
     * @param tokenId The address of the leader executing the transaction
     * @param nonce The identifier of the executed transaction
     */
    event ExecuteTransaction(uint256 tokenId, uint256 nonce);

    error TransactionDoesNotExist();
    error TransactionAlreadyExecuted();
    error TransactionAlreadyConfirmed();
    error TransactionNotConfirmed();
    error TransactionFailed(bytes);
    error InvalidTarget();

    modifier txExists(uint256 nonce) {
        if (nonce >= transactions.length) revert TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 nonce) {
        if (transactions[nonce].executed) revert TransactionAlreadyExecuted();
        _;
    }

    modifier notConfirmed(uint256 tokenId, uint256 nonce) {
        if (isConfirmed[nonce][tokenId]) revert TransactionAlreadyConfirmed();
        _;
    }

    function _submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) internal {
        uint256 nonce = transactions.length;

        transactions.push(Transaction({target: target, value: value, data: data, executed: false, confirmations: 0}));
        _confirmTransaction(tokenId, nonce);
        emit SubmitTransaction(tokenId, nonce, target, value, data);
    }

    function _confirmTransaction(uint256 tokenId, uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notConfirmed(tokenId, nonce)
    {
        Transaction storage transaction = transactions[nonce];
        transaction.confirmations += 1;
        isConfirmed[nonce][tokenId] = true;

        emit ConfirmTransaction(tokenId, nonce);
    }

    function _revokeConfirmation(uint256 tokenId, uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
        if (!isConfirmed[nonce][tokenId]) revert TransactionNotConfirmed();

        Transaction storage transaction = transactions[nonce];
        transaction.confirmations -= 1;
        isConfirmed[nonce][tokenId] = false;

        emit RevokeConfirmation(tokenId, nonce);
    }

    function _executeTransaction(uint256 tokenId, uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
        Transaction storage transaction = transactions[nonce];

        // Add zero address check
        if (transaction.target == address(0)) revert InvalidTarget();

        // Store values locally to prevent multiple storage reads
        address target = transaction.target;
        uint256 value = transaction.value;
        bytes memory data = transaction.data;

        // Make external call before state changes (CEI pattern)
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) revert TransactionFailed(returnData);

        // Update state after external call
        transaction.executed = true;

        emit ExecuteTransaction(tokenId, nonce);
    }

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return The Transaction struct containing the transaction details
     */
    function getTransaction(uint256 nonce) public view returns (Transaction memory) {
        Transaction storage transaction = transactions[nonce];

        return Transaction({
            target: transaction.target,
            value: transaction.value,
            data: transaction.data,
            executed: transaction.executed,
            confirmations: transaction.confirmations
        });
    }

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) public view returns (bool) {
        return isConfirmed[nonce][tokenId];
    }

    /**
     * @notice Returns the current nonce (next transaction ID)
     * @return uint256 The current nonce value, which is the next available transaction ID
     */
    function getCurrentNonce() public view returns (uint256) {
        return transactions.length;
    }
}
