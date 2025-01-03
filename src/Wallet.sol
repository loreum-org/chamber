// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Wallet {
    event SubmitTransaction(
        address indexed leader, uint256 indexed nonce, address indexed to, uint256 value, bytes data
    );
    event ConfirmTransaction(address indexed leader, uint256 indexed nonce);
    event RevokeConfirmation(address indexed leader, uint256 indexed nonce);
    event ExecuteTransaction(address indexed leader, uint256 indexed nonce);

    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes data;
    }

    Transaction[] private transactions;
    mapping(uint256 => mapping(address => bool)) private isConfirmed;

    // Custom Errors
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

    modifier notConfirmed(uint256 nonce) {
        if (isConfirmed[nonce][msg.sender]) revert TransactionAlreadyConfirmed();
        _;
    }

    function _submitTransaction(address target, uint256 value, bytes memory data) internal {
        uint256 nonce = transactions.length;

        transactions.push(
            Transaction({
                target: target,
                value: value,
                data: data,
                executed: false,
                confirmations: 0
            })
        );
        _confirmTransaction(nonce);
        emit SubmitTransaction(msg.sender, nonce, target, value, data);
    }

    function _confirmTransaction(uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notConfirmed(nonce)
    {
        Transaction storage transaction = transactions[nonce];
        transaction.confirmations += 1;
        isConfirmed[nonce][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, nonce);
    }

    function _revokeConfirmation(uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
        if (!isConfirmed[nonce][msg.sender]) revert TransactionNotConfirmed();

        Transaction storage transaction = transactions[nonce];
        transaction.confirmations -= 1;
        isConfirmed[nonce][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, nonce);
    }

    function _executeTransaction(uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
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

        emit ExecuteTransaction(msg.sender, nonce);
    }

    /// @notice Returns the total number of transactions
    /// @return The total number of transactions
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    /// @notice Returns the details of a specific transaction
    /// @param nonce The index of the transaction to retrieve
    /// @return The Transaction struct containing the transaction details
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

    /// @notice Checks if a transaction is confirmed by a specific director
    /// @param nonce The index of the transaction to check
    /// @param director The address of the director to check confirmation for
    /// @return True if the transaction is confirmed by the director, false otherwise
    function getConfirmation(uint256 nonce, address director) public view returns (bool) {
        return isConfirmed[nonce][director];
    }

    /// @notice Returns the current nonce
    /// @return uint256 The current nonce value
    function getCurrentNonce() public view returns (uint256) {
        return transactions.length > 0 ? transactions.length - 1 : 0;
    }
}
