// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IWallet} from "./interfaces/IWallet.sol";

/**
 * @title Wallet
 * @author xhad, Loreum DAO LLC
 * @notice Abstract contract implementing multisig transaction management
 * @dev Provides core functionality for submitting, confirming, and executing transactions
 *      with configurable quorum requirements. Newly submitted transactions expire after a
 *      deadline (default 30 days) and cannot be confirmed, revoked, or executed once expired.
 *      A stored deadline of `0` means unset (pre-upgrade pending nonce) and is not expired.
 *
 * Gas optimization — hash-only calldata storage for ordinary calls:
 *   Transaction.data (formerly dynamic `bytes`) is replaced with `bytes32 dataHash`.
 *   At submission the keccak256 of the calldata is stored (fixed 1 slot vs. 20k per 32 bytes
 *   of raw calldata). At execution the caller re-supplies the original bytes; the contract
 *   verifies keccak256(data) == dataHash before forwarding to the target.
 *   This matches the pattern used by Gnosis Safe.
 *
 * L-04 liveness exception — self-calls store full calldata onchain:
 *   Calls whose `target == address(this)` (Chamber: `upgradeImplementation` only) persist
 *   the original bytes in `transactionCalldata`. Execution may pass empty `data` and the
 *   stored payload is used, so a confirmed upgrade remains executable if event logs or
 *   `metadataURI` archives are unavailable. Ordinary treasury calls stay hash-only.
 *
 * BREAKING: executeTransaction and executeBatchTransactions require a `data` / `data[]`
 *           parameter at call time. For non-self-calls, callers must persist the original
 *           calldata (e.g. via the SubmitTransaction event) and re-supply it at execution.
 */
abstract contract Wallet {
    /**
     * @notice Structure representing a transaction in the wallet
     * @dev Slot packing: executed (bool, 1 byte) + confirmations (uint8, 1 byte) +
     *      target (address, 20 bytes) = 22 bytes in slot 0. value fills slot 1.
     *      dataHash (bytes32) fills slot 2 — replaces the former dynamic `bytes data` field
     *      which previously cost 20k SSTORE per 32-byte word of calldata.
     * @param executed Whether the transaction has been executed
     * @param confirmations Number of confirmations received for this transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send with the transaction
     * @param dataHash keccak256 of the original calldata; verified at execution time
     */
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes32 dataHash;
    }

    /// @notice Default lifetime for a submitted transaction when no deadline is provided
    uint256 public constant DEFAULT_TRANSACTION_MAX_AGE = 30 days;

    /**
     * @notice ERC-7201 namespaced storage layout for Wallet
     * @custom:storage-location erc7201:loreum.Wallet
     */
    struct WalletStorage {
        Transaction[] transactions;
        mapping(uint256 nonce => string metadataURI) transactionMetadataURI;
        mapping(uint256 nonce => mapping(uint256 tokenId => bool)) isConfirmed;
        mapping(uint256 nonce => bool) cancelled;
        mapping(uint256 nonce => uint8) cancelConfirmations;
        mapping(uint256 nonce => mapping(uint256 tokenId => bool)) isCancelConfirmed;
        /// @dev Full calldata for self-calls only (L-04). Empty for ordinary hash-only txs.
        mapping(uint256 nonce => bytes storedCalldata) transactionCalldata;
        /// @dev Quorum at submit time (M-04). Appended mapping is upgrade-safe; does not resize Transaction[].
        mapping(uint256 nonce => uint256 requiredQuorum) transactionRequiredQuorum;
        /// @dev exclusive-after unix timestamp; `0` is unset (no expiry, pre-upgrade pending)
        mapping(uint256 nonce => uint256 deadline) transactionDeadline;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Wallet")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _WALLET_STORAGE_SLOT = 0x471e5819b63496fc9e7b0c9d30efc265f73588bc9e02c472310feaa7f9bb8000;

    function _getWalletStorage() internal pure returns (WalletStorage storage $) {
        assembly {
            $.slot := _WALLET_STORAGE_SLOT
        }
    }

    /// @dev Events and errors are defined in IWallet interface

    /// @notice Modifier to check if a transaction exists
    modifier txExists(uint256 nonce) {
        _txExists(nonce);
        _;
    }

    function _txExists(uint256 nonce) internal view {
        if (nonce >= _getWalletStorage().transactions.length) revert IWallet.TransactionDoesNotExist();
    }

    /// @notice Modifier to check if a transaction has not been executed
    modifier notExecuted(uint256 nonce) {
        _notExecuted(nonce);
        _;
    }

    function _notExecuted(uint256 nonce) internal view {
        if (_getWalletStorage().transactions[nonce].executed) revert IWallet.TransactionAlreadyExecuted();
    }

    /// @notice Modifier to check if a transaction has not been cancelled
    modifier notCancelled(uint256 nonce) {
        _notCancelled(nonce);
        _;
    }

    function _notCancelled(uint256 nonce) internal view {
        if (_getWalletStorage().cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
    }

    /// @notice Modifier to check if a transaction has not passed its deadline
    modifier notExpired(uint256 nonce) {
        _notExpired(nonce);
        _;
    }

    function _notExpired(uint256 nonce) internal view {
        uint256 deadline = _getWalletStorage().transactionDeadline[nonce];
        // `0` is unset (legacy pending nonce) and must remain executable after upgrade.
        if (deadline != 0 && block.timestamp > deadline) revert IWallet.TransactionExpired();
    }

    /**
     * @notice Resolves a submit-time deadline. Zero means the default max age.
     * @dev Rejects timestamps that are not in the future or that exceed the 30-day max age.
     */
    function _resolveDeadline(uint256 deadline) internal view returns (uint256 resolved) {
        uint256 maxDeadline = block.timestamp + DEFAULT_TRANSACTION_MAX_AGE;
        if (deadline == 0) {
            return maxDeadline;
        }
        if (deadline <= block.timestamp || deadline > maxDeadline) {
            revert IWallet.InvalidDeadline();
        }
        return deadline;
    }

    /// @notice Modifier to check if a transaction has not been confirmed by a specific tokenId
    modifier notConfirmed(uint256 tokenId, uint256 nonce) {
        _notConfirmed(tokenId, nonce);
        _;
    }

    function _notConfirmed(uint256 tokenId, uint256 nonce) internal view {
        if (_getWalletStorage().isConfirmed[nonce][tokenId]) revert IWallet.TransactionAlreadyConfirmed();
    }

    /**
     * @notice Submits a new transaction and auto-confirms for the submitter
     * @param tokenId The token ID submitting the transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata to execute (hash stored always; full bytes stored for self-calls)
     */
    function _submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) internal {
        _submitTransaction(tokenId, target, value, data, 0);
    }

    /**
     * @notice Submits a new transaction with an explicit deadline and auto-confirms for the submitter
     * @param tokenId The token ID submitting the transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata to execute (stored as keccak256 hash only)
     * @param deadline Exclusive-after unix timestamp; `0` applies {DEFAULT_TRANSACTION_MAX_AGE}
     */
    function _submitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data, uint256 deadline)
        internal
    {
        _submitTransactionWithMetadata(tokenId, target, value, data, "", deadline);
    }

    /**
     * @notice Submits a new transaction with durable proposal metadata and auto-confirms for the submitter
     * @param tokenId The token ID submitting the transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata to execute (hash stored always; full bytes stored for self-calls)
     * @param metadataURI URI or content hash describing the proposal rationale and risk context
     */
    function _submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI
    ) internal {
        _submitTransactionWithMetadata(tokenId, target, value, data, metadataURI, 0);
    }

    /**
     * @notice Submits a new transaction with metadata and an explicit deadline
     * @param tokenId The token ID submitting the transaction
     * @param target The destination address for the transaction
     * @param value The amount of ETH to send
     * @param data The calldata to execute (stored as keccak256 hash only)
     * @param metadataURI URI or content hash describing the proposal rationale and risk context
     * @param deadline Exclusive-after unix timestamp; `0` applies {DEFAULT_TRANSACTION_MAX_AGE}
     */
    function _submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) internal {
        WalletStorage storage $ = _getWalletStorage();
        uint256 nonce = $.transactions.length;
        uint256 resolvedDeadline = _resolveDeadline(deadline);

        bytes32 dataHash = keccak256(data);
        $.transactions
            .push(Transaction({target: target, value: value, dataHash: dataHash, executed: false, confirmations: 0}));
        // L-04: persist upgrade/self-call bytes so execution does not depend on logs.
        if (target == address(this)) {
            $.transactionCalldata[nonce] = data;
        }
        $.transactionRequiredQuorum[nonce] = _submitQuorum();
        $.transactionDeadline[nonce] = resolvedDeadline;
        emit IWallet.TransactionDeadlineSet(nonce, resolvedDeadline);
        if (bytes(metadataURI).length != 0) {
            $.transactionMetadataURI[nonce] = metadataURI;
            emit IWallet.ProposalMetadataSet(nonce, metadataURI);
        }
        _confirmTransaction(tokenId, nonce);
        emit IWallet.SubmitTransaction(tokenId, nonce, target, value, data);
    }

    /**
     * @notice Quorum snapshotted onto a newly submitted transaction
     * @dev Chamber overrides this to return live `getQuorum()`. Default 0 leaves
     *      execution thresholds to the caller (e.g. MockWallet unit tests).
     */
    function _submitQuorum() internal view virtual returns (uint256) {
        return 0;
    }

    /**
     * @notice Confirms a transaction for a specific token ID
     * @dev Rejects cancelled nonces via `notCancelled` so confirmations cannot accrue after cancel.
     * @param tokenId The token ID confirming the transaction
     * @param nonce The transaction index to confirm
     */
    function _confirmTransaction(uint256 tokenId, uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notCancelled(nonce)
        notExpired(nonce)
        notConfirmed(tokenId, nonce)
    {
        WalletStorage storage $ = _getWalletStorage();
        Transaction storage transaction = $.transactions[nonce];
        transaction.confirmations += 1;
        $.isConfirmed[nonce][tokenId] = true;

        emit IWallet.ConfirmTransaction(tokenId, nonce);
    }

    /**
     * @notice Revokes a previously given confirmation
     * @dev Reverts via `notCancelled` after cancellation (consistent with {_confirmTransaction}).
     * @param tokenId The token ID revoking the confirmation
     * @param nonce The transaction index to revoke confirmation for
     */
    function _revokeConfirmation(uint256 tokenId, uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notCancelled(nonce)
        notExpired(nonce)
    {
        WalletStorage storage $ = _getWalletStorage();
        if (!$.isConfirmed[nonce][tokenId]) revert IWallet.TransactionNotConfirmed();

        Transaction storage transaction = $.transactions[nonce];

        if (transaction.confirmations > 0) {
            unchecked {
                transaction.confirmations -= 1;
            }
        }
        $.isConfirmed[nonce][tokenId] = false;

        emit IWallet.RevokeConfirmation(tokenId, nonce);
    }

    /**
     * @notice Records a director's vote to cancel a transaction.
     * @dev Does not apply cancellation. Caller must invoke {_cancelTransaction} after counting
     *      votes that are still from current directors (same live-set check as execute).
     * @param tokenId The token ID voting to cancel
     * @param nonce The transaction index to cancel
     */
    function _recordCancelVote(uint256 tokenId, uint256 nonce)
        internal
        txExists(nonce)
        notExecuted(nonce)
    {
        WalletStorage storage $ = _getWalletStorage();
        if ($.cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
        if ($.isCancelConfirmed[nonce][tokenId]) revert IWallet.TransactionCancelAlreadyConfirmed();

        $.isCancelConfirmed[nonce][tokenId] = true;
        $.cancelConfirmations[nonce] += 1;

        emit IWallet.CancelTransaction(tokenId, nonce);
    }

    /**
     * @notice Marks a transaction cancelled after live director quorum is met
     * @param nonce The transaction index to cancel
     */
    function _cancelTransaction(uint256 nonce) internal {
        _getWalletStorage().cancelled[nonce] = true;
        emit IWallet.TransactionCancelled(nonce);
    }

    /**
     * @notice Executes a confirmed transaction
     * @dev Uses CEI pattern — state updated before external call.
     *      Verifies keccak256(payload) == stored dataHash before forwarding.
     *      Self-calls use onchain-stored calldata when the caller passes empty `data`.
     * @param tokenId The token ID executing the transaction
     * @param nonce The transaction index to execute
     * @param data The original calldata, or empty to use stored self-call bytes
     */
    function _executeTransaction(uint256 tokenId, uint256 nonce, bytes calldata data)
        internal
        txExists(nonce)
        notExecuted(nonce)
        notCancelled(nonce)
        notExpired(nonce)
    {
        WalletStorage storage $ = _getWalletStorage();
        Transaction storage transaction = $.transactions[nonce];

        if (transaction.target == address(0)) revert IWallet.InvalidTarget();

        bytes memory payload = _resolveExecutionCalldata(nonce, transaction, data);

        address target = transaction.target;
        uint256 value = transaction.value;

        // CEI pattern: Update state BEFORE external call to prevent reentrancy
        transaction.executed = true;

        (bool success, bytes memory returnData) = target.call{value: value}(payload);
        if (!success) {
            transaction.executed = false;
            revert IWallet.TransactionFailed(returnData);
        }

        emit IWallet.ExecuteTransaction(tokenId, nonce);
    }

    /**
     * @notice Resolves calldata for execution: stored self-call bytes, else caller-supplied.
     * @dev If this nonce stored calldata (self-call / upgrade), empty `data` uses the store.
     *      Any non-empty caller `data` must still match `dataHash`.
     */
    function _resolveExecutionCalldata(uint256 nonce, Transaction storage transaction, bytes calldata data)
        private
        view
        returns (bytes memory payload)
    {
        bytes memory stored = _getWalletStorage().transactionCalldata[nonce];
        if (stored.length != 0 || transaction.target == address(this)) {
            payload = stored;
            if (data.length != 0 && keccak256(data) != transaction.dataHash) revert IWallet.DataHashMismatch();
        } else {
            payload = data;
        }
        if (keccak256(payload) != transaction.dataHash) revert IWallet.DataHashMismatch();
    }

    /**
     * @notice Returns the total number of transactions
     * @return The total number of transactions
     */
    function getTransactionCount() public view virtual returns (uint256) {
        return _getWalletStorage().transactions.length;
    }

    /**
     * @notice Returns the details of a specific transaction
     * @param nonce The index of the transaction to retrieve
     * @return executed Whether the transaction has been executed
     * @return confirmations Number of confirmations
     * @return target The target address
     * @return value The ETH value
     * @return dataHash keccak256 of the original calldata
     */
    function getTransaction(uint256 nonce)
        public
        view
        virtual
        returns (bool executed, uint8 confirmations, address target, uint256 value, bytes32 dataHash)
    {
        Transaction storage transaction = _getWalletStorage().transactions[nonce];
        return
            (
                transaction.executed,
                transaction.confirmations,
                transaction.target,
                transaction.value,
                transaction.dataHash
            );
    }

    /**
     * @notice Returns durable metadata URI or content hash for a transaction proposal
     * @param nonce The index of the transaction to retrieve metadata for
     */
    function getTransactionMetadata(uint256 nonce) public view virtual txExists(nonce) returns (string memory) {
        return _getWalletStorage().transactionMetadataURI[nonce];
    }

    /**
     * @notice Returns onchain-stored calldata for a self-call, or empty bytes for hash-only txs
     * @param nonce The index of the transaction to retrieve stored calldata for
     */
    function getTransactionCalldata(uint256 nonce) public view virtual txExists(nonce) returns (bytes memory) {
        return _getWalletStorage().transactionCalldata[nonce];
    }

    /**
     * @notice Returns the quorum snapshotted when the transaction was submitted
     * @param nonce The index of the transaction
     * @return The required quorum recorded at submit time (0 if unset / legacy)
     */
    function getTransactionRequiredQuorum(uint256 nonce) public view virtual txExists(nonce) returns (uint256) {
        return _getWalletStorage().transactionRequiredQuorum[nonce];
    }

    /**
     * @notice Checks if a transaction is confirmed by a specific director
     * @param tokenId The tokenId of the director to check confirmation for
     * @param nonce The index of the transaction to check
     * @return True if the transaction is confirmed by the director, false otherwise
     */
    function getConfirmation(uint256 tokenId, uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().isConfirmed[nonce][tokenId];
    }

    /**
     * @notice Returns whether a transaction has been cancelled
     * @param nonce The index of the transaction to check
     * @return True if the transaction is cancelled
     */
    function getCancelled(uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().cancelled[nonce];
    }

    /**
     * @notice Returns the exclusive-after unix timestamp after which `nonce` cannot be executed
     * @param nonce The index of the transaction to retrieve
     * @return deadline Stored deadline; `0` means unset / no expiry (pre-upgrade pending)
     */
    function getTransactionDeadline(uint256 nonce) public view virtual txExists(nonce) returns (uint256 deadline) {
        return _getWalletStorage().transactionDeadline[nonce];
    }

    /**
     * @notice Returns whether a transaction has passed its deadline
     * @param nonce The index of the transaction to check
     * @return True if a non-zero deadline is stored and `block.timestamp` is strictly greater
     */
    function isTransactionExpired(uint256 nonce) public view virtual txExists(nonce) returns (bool) {
        uint256 deadline = _getWalletStorage().transactionDeadline[nonce];
        return deadline != 0 && block.timestamp > deadline;
    }

    /**
     * @notice Checks if a director has voted to cancel a transaction
     * @param tokenId The tokenId of the director to check
     * @param nonce The index of the transaction to check
     * @return True if the director has voted to cancel
     */
    function getCancelConfirmation(uint256 tokenId, uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().isCancelConfirmed[nonce][tokenId];
    }

    /**
     * @notice Returns the number of directors who have voted to cancel a transaction
     * @param nonce The index of the transaction to check
     * @return The count of cancel votes
     */
    function getCancelConfirmations(uint256 nonce) public view virtual returns (uint8) {
        return _getWalletStorage().cancelConfirmations[nonce];
    }

    /**
     * @notice Returns the next transaction ID (current nonce)
     * @return uint256 The next transaction ID that will be assigned
     */
    function getNextTransactionId() public view virtual returns (uint256) {
        return _getWalletStorage().transactions.length;
    }

    /**
     * @notice Returns the last transaction ID
     * @return uint256 The last transaction ID (or 0 if no transactions)
     * @dev Deprecated: Use getNextTransactionId() instead
     */
    function getCurrentNonce() public view returns (uint256) {
        uint256 len = _getWalletStorage().transactions.length;
        return len > 0 ? len - 1 : 0;
    }
}
