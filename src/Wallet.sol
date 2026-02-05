// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IWallet} from "./interfaces/IWallet.sol";

/**
 * @title Wallet
 * @notice Abstract contract implementing multisig transaction management
 * @dev Provides core functionality for submitting, confirming, and executing transactions
 *      with configurable quorum requirements
 */
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
    Transaction[] internal transactions;

    /// @notice Mapping from transaction nonce to tokenId to confirmation status
    mapping(uint256 => mapping(uint256 => bool)) internal isConfirmed;

    /// @dev Events and errors are defined in IWallet interface

    /// @notice Modifier to check if a transaction exists
    /// @param nonce The transaction index to check
    modifier txExists(uint256 nonce) {
        _txExists(nonce);
        _;
    }

    function _txExists(uint256 nonce) internal view {
        if (nonce >= transactions.length) revert IWallet.TransactionDoesNotExist();
    }

    /// @notice Modifier to check if a transaction has not been executed
    /// @param nonce The transaction index to check
    modifier notExecuted(uint256 nonce) {
        _notExecuted(nonce);
        _;
    }

    function _notExecuted(uint256 nonce) internal view {
        if (transactions[nonce].executed) revert IWallet.TransactionAlreadyExecuted();
    }

    /// @notice Modifier to check if a transaction has not been confirmed by a specific tokenId
    /// @param tokenId The token ID to check confirmation for
    /// @param nonce The transaction index to check
    modifier notConfirmed(uint256 tokenId, uint256 nonce) {
        _notConfirmed(tokenId, nonce);
        _;
    }

    function _notConfirmed(uint256 tokenId, uint256 nonce) internal view {
        if (isConfirmed[nonce][tokenId]) revert IWallet.TransactionAlreadyConfirmed();
    }

    /**
     * @notice Submits a new transaction and auto-confirms for the submitter
     * @param tokenId The token ID submitting the transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata to execute
     */
    function _submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) internal {
        uint256 nonce = transactions.length;

        transactions.push(Transaction({target: target, value: value, data: data, executed: false, confirmations: 0}));
        _confirmTransaction(tokenId, nonce);
        emit IWallet.SubmitTransaction(tokenId, nonce, target, value, data);
    }

    /**
     * @notice Confirms a transaction for a specific token ID
     * @param tokenId The token ID confirming the transaction
     * @param nonce The transaction index to confirm
     */
    function _confirmTransaction(uint256 tokenId, uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notConfirmed(tokenId, nonce)
    {
        Transaction storage transaction = transactions[nonce];
        transaction.confirmations += 1;
        isConfirmed[nonce][tokenId] = true;

        emit IWallet.ConfirmTransaction(tokenId, nonce);
    }

    /**
     * @notice Revokes a previously given confirmation
     * @param tokenId The token ID revoking the confirmation
     * @param nonce The transaction index to revoke confirmation for
     */
    function _revokeConfirmation(uint256 tokenId, uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
        if (!isConfirmed[nonce][tokenId]) revert IWallet.TransactionNotConfirmed();

        Transaction storage transaction = transactions[nonce];

        // Prevent underflow
        if (transaction.confirmations > 0) {
            unchecked {
                transaction.confirmations -= 1;
            }
        }
        isConfirmed[nonce][tokenId] = false;

        emit IWallet.RevokeConfirmation(tokenId, nonce);
    }

    /**
     * @notice Executes a confirmed transaction
     * @dev Uses CEI pattern - state updated before external call
     * @param tokenId The token ID executing the transaction
     * @param nonce The transaction index to execute
     */
    function _executeTransaction(uint256 tokenId, uint256 nonce) internal txExists(nonce) notExecuted(nonce) {
        Transaction storage transaction = transactions[nonce];

        // Add zero address check
        if (transaction.target == address(0)) revert IWallet.InvalidTarget();

        // Store values locally to prevent multiple storage reads
        address target = transaction.target;
        uint256 value = transaction.value;
        bytes memory data = transaction.data;

        // CEI pattern: Update state BEFORE external call to prevent reentrancy
        transaction.executed = true;

        // Make external call after state changes
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            // Revert state on failure
            transaction.executed = false;
            revert IWallet.TransactionFailed(returnData);
        }

        emit IWallet.ExecuteTransaction(tokenId, nonce);
    }

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() public view virtual returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return executed Whether the transaction has been executed
     * @return confirmations Number of confirmations
     * @return target The target address
     * @return value The ETH value
     * @return data The calldata
     */
    function getTransaction(uint256 nonce)
        public
        view
        virtual
        returns (bool executed, uint8 confirmations, address target, uint256 value, bytes memory data)
    {
        Transaction storage transaction = transactions[nonce];
        return
            (transaction.executed, transaction.confirmations, transaction.target, transaction.value, transaction.data);
    }

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) public view virtual returns (bool) {
        return isConfirmed[nonce][tokenId];
    }

    /**
     * @notice Returns the next transaction ID (current nonce)
     * @return uint256 The next transaction ID that will be assigned
     */
    function getNextTransactionId() public view virtual returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Returns the last transaction ID
     * @return uint256 The last transaction ID (or 0 if no transactions)
     * @dev Deprecated: Use getNextTransactionId() instead
     */
    function getCurrentNonce() public view returns (uint256) {
        return transactions.length > 0 ? transactions.length - 1 : 0;
    }

    /// @dev Storage gap for future upgrades
    uint256[50] private _gap;
}
