// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IWallet} from "src/interfaces/IWallet.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";
import {WalletLib} from "src/libraries/WalletLib.sol";

/**
 * @title Wallet
 * @author xhad, Loreum DAO LLC
 * @notice Abstract contract implementing multisig transaction management
 * @dev Core logic lives in {WalletLib} (linked library) to keep `Chamber` under EIP-170.
 */
abstract contract Wallet {
    struct Transaction {
        bool executed;
        uint8 confirmations;
        address target;
        uint256 value;
        bytes32 dataHash;
    }

    /// @notice Default lifetime for a submitted transaction when no deadline is provided
    uint256 public constant DEFAULT_TRANSACTION_MAX_AGE = WalletTypes.DEFAULT_TRANSACTION_MAX_AGE;

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Wallet")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _WALLET_STORAGE_SLOT = 0x471e5819b63496fc9e7b0c9d30efc265f73588bc9e02c472310feaa7f9bb8000;

    function _getWalletStorage() internal pure returns (WalletTypes.WalletStorage storage $) {
        assembly {
            $.slot := _WALLET_STORAGE_SLOT
        }
    }

    modifier txExists(uint256 nonce) {
        if (nonce >= _getWalletStorage().transactions.length) revert IWallet.TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 nonce) {
        if (_getWalletStorage().transactions[nonce].executed) revert IWallet.TransactionAlreadyExecuted();
        _;
    }

    modifier notCancelled(uint256 nonce) {
        if (_getWalletStorage().cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
        _;
    }

    modifier notExpired(uint256 nonce) {
        uint256 deadline = _getWalletStorage().transactionDeadline[nonce];
        if (deadline != 0 && block.timestamp > deadline) revert IWallet.TransactionExpired();
        _;
    }

    modifier notConfirmed(uint256 tokenId, uint256 nonce) {
        if (_getWalletStorage().isConfirmed[nonce][tokenId]) revert IWallet.TransactionAlreadyConfirmed();
        _;
    }

    function _txExists(uint256 nonce) internal view {
        if (nonce >= _getWalletStorage().transactions.length) revert IWallet.TransactionDoesNotExist();
    }

    function _notExecuted(uint256 nonce) internal view {
        if (_getWalletStorage().transactions[nonce].executed) revert IWallet.TransactionAlreadyExecuted();
    }

    function _notCancelled(uint256 nonce) internal view {
        if (_getWalletStorage().cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
    }

    function _notExpired(uint256 nonce) internal view {
        uint256 deadline = _getWalletStorage().transactionDeadline[nonce];
        if (deadline != 0 && block.timestamp > deadline) revert IWallet.TransactionExpired();
    }

    function _resolveDeadline(uint256 deadline) internal view returns (uint256 resolved) {
        return WalletLib.resolveDeadline(deadline);
    }

    function _requireNoThirdPartyPull(address target, address asset, bytes memory data) internal view {
        WalletLib.requireNoThirdPartyPull(target, asset, data);
    }

    /// @dev ProxyAdmin calls are restricted to a Chamber-id upgrade of this proxy (R-1012-L6).
    function _requireChamberUpgrade(bytes memory data) internal view {
        WalletLib.requireChamberUpgrade(data);
    }

    function _submitTransactionWithMetadata(
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline
    ) internal virtual {
        WalletLib.submitTransactionWithMetadata(
            _getWalletStorage(),
            tokenId,
            target,
            value,
            data,
            metadataURI,
            deadline,
            _submitQuorum(),
            _storesCalldata(target)
        );
    }

    function _submitQuorum() internal view virtual returns (uint256) {
        return 0;
    }

    /// @dev Whether a submitted nonce keeps its full calldata onchain (L-04). Self-calls by default.
    function _storesCalldata(address target) internal view virtual returns (bool) {
        return target == address(this);
    }

    function _confirmTransaction(uint256 tokenId, uint256 nonce) internal virtual {
        WalletLib.confirmTransaction(_getWalletStorage(), tokenId, nonce);
    }

    function _revokeConfirmation(uint256 tokenId, uint256 nonce) internal {
        WalletLib.revokeConfirmation(_getWalletStorage(), tokenId, nonce);
    }

    function _recordCancelVote(uint256 tokenId, uint256 nonce) internal virtual {
        WalletLib.recordCancelVote(_getWalletStorage(), tokenId, nonce);
    }

    function _cancelTransaction(uint256 nonce) internal {
        WalletLib.cancelTransaction(_getWalletStorage(), nonce);
    }

    function _executeTransaction(uint256 tokenId, uint256 nonce, bytes calldata data) internal {
        WalletLib.executeTransaction(_getWalletStorage(), tokenId, nonce, data, address(this));
    }

    function getTransactionCount() public view virtual returns (uint256) {
        return _getWalletStorage().transactions.length;
    }

    function getTransaction(uint256 nonce)
        public
        view
        virtual
        returns (bool executed, uint8 confirmations, address target, uint256 value, bytes32 dataHash)
    {
        WalletTypes.Transaction storage transaction = _getWalletStorage().transactions[nonce];
        return
            (
                transaction.executed,
                transaction.confirmations,
                transaction.target,
                transaction.value,
                transaction.dataHash
            );
    }

    function getTransactionMetadata(uint256 nonce) public view virtual returns (string memory) {
        _txExists(nonce);
        return _getWalletStorage().transactionMetadataURI[nonce];
    }

    function getTransactionCalldata(uint256 nonce) public view virtual returns (bytes memory) {
        _txExists(nonce);
        return _getWalletStorage().transactionCalldata[nonce];
    }

    function getTransactionRequiredQuorum(uint256 nonce) public view virtual returns (uint256) {
        _txExists(nonce);
        return _getWalletStorage().transactionRequiredQuorum[nonce];
    }

    function getConfirmation(uint256 tokenId, uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().isConfirmed[nonce][tokenId];
    }

    function getCancelled(uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().cancelled[nonce];
    }

    function getTransactionDeadline(uint256 nonce) public view virtual returns (uint256 deadline) {
        _txExists(nonce);
        return _getWalletStorage().transactionDeadline[nonce];
    }

    function getCancelConfirmation(uint256 tokenId, uint256 nonce) public view virtual returns (bool) {
        return _getWalletStorage().isCancelConfirmed[nonce][tokenId];
    }

    function getCancelConfirmations(uint256 nonce) public view virtual returns (uint8) {
        return _getWalletStorage().cancelConfirmations[nonce];
    }
}
