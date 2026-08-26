// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IWallet} from "src/interfaces/IWallet.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";

/**
 * @title WalletLib
 * @notice Linked external library for multisig wallet transaction logic.
 * @dev Extracted to keep `Chamber` implementation under the EIP-170 size limit.
 */
library WalletLib {
    using WalletTypes for WalletTypes.WalletStorage;

    function txExists(WalletTypes.WalletStorage storage $, uint256 nonce) internal view {
        if (nonce >= $.transactions.length) revert IWallet.TransactionDoesNotExist();
    }

    function notExecuted(WalletTypes.WalletStorage storage $, uint256 nonce) internal view {
        if ($.transactions[nonce].executed) revert IWallet.TransactionAlreadyExecuted();
    }

    function notCancelled(WalletTypes.WalletStorage storage $, uint256 nonce) internal view {
        if ($.cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
    }

    function notExpired(WalletTypes.WalletStorage storage $, uint256 nonce) internal view {
        uint256 deadline = $.transactionDeadline[nonce];
        if (deadline != 0 && block.timestamp > deadline) revert IWallet.TransactionExpired();
    }

    function notConfirmed(WalletTypes.WalletStorage storage $, uint256 tokenId, uint256 nonce) internal view {
        if ($.isConfirmed[nonce][tokenId]) revert IWallet.TransactionAlreadyConfirmed();
    }

    function resolveDeadline(uint256 deadline) internal view returns (uint256 resolved) {
        uint256 maxDeadline = block.timestamp + WalletTypes.DEFAULT_TRANSACTION_MAX_AGE;
        if (deadline == 0) {
            return maxDeadline;
        }
        if (deadline <= block.timestamp || deadline > maxDeadline) {
            revert IWallet.InvalidDeadline();
        }
        return deadline;
    }

    function submitTransactionWithMetadata(
        WalletTypes.WalletStorage storage $,
        uint256 tokenId,
        address target,
        uint256 value,
        bytes memory data,
        string memory metadataURI,
        uint256 deadline,
        uint256 submitQuorum,
        address selfAddress
    ) external {
        uint256 nonce = $.transactions.length;
        uint256 resolvedDeadline = resolveDeadline(deadline);

        bytes32 dataHash = keccak256(data);
        $.transactions.push(
            WalletTypes.Transaction({
                target: target,
                value: value,
                dataHash: dataHash,
                executed: false,
                confirmations: 0
            })
        );
        if (target == selfAddress) {
            $.transactionCalldata[nonce] = data;
        }
        $.transactionRequiredQuorum[nonce] = submitQuorum;
        $.transactionDeadline[nonce] = resolvedDeadline;
        emit IWallet.TransactionDeadlineSet(nonce, resolvedDeadline);
        if (bytes(metadataURI).length != 0) {
            $.transactionMetadataURI[nonce] = metadataURI;
            emit IWallet.ProposalMetadataSet(nonce, metadataURI);
        }
        confirmTransaction($, tokenId, nonce);
        emit IWallet.SubmitTransaction(tokenId, nonce, target, value, data);
    }

    function confirmTransaction(WalletTypes.WalletStorage storage $, uint256 tokenId, uint256 nonce) internal {
        txExists($, nonce);
        notExecuted($, nonce);
        notCancelled($, nonce);
        notExpired($, nonce);
        notConfirmed($, tokenId, nonce);

        WalletTypes.Transaction storage transaction = $.transactions[nonce];
        transaction.confirmations += 1;
        $.isConfirmed[nonce][tokenId] = true;

        emit IWallet.ConfirmTransaction(tokenId, nonce);
    }

    function revokeConfirmation(WalletTypes.WalletStorage storage $, uint256 tokenId, uint256 nonce) external {
        txExists($, nonce);
        notExecuted($, nonce);
        notCancelled($, nonce);
        notExpired($, nonce);

        if (!$.isConfirmed[nonce][tokenId]) revert IWallet.TransactionNotConfirmed();

        WalletTypes.Transaction storage transaction = $.transactions[nonce];

        if (transaction.confirmations > 0) {
            unchecked {
                transaction.confirmations -= 1;
            }
        }
        $.isConfirmed[nonce][tokenId] = false;

        emit IWallet.RevokeConfirmation(tokenId, nonce);
    }

    function recordCancelVote(WalletTypes.WalletStorage storage $, uint256 tokenId, uint256 nonce) external {
        txExists($, nonce);
        notExecuted($, nonce);

        if ($.cancelled[nonce]) revert IWallet.TransactionAlreadyCancelled();
        if ($.isCancelConfirmed[nonce][tokenId]) revert IWallet.TransactionCancelAlreadyConfirmed();

        $.isCancelConfirmed[nonce][tokenId] = true;
        $.cancelConfirmations[nonce] += 1;

        emit IWallet.CancelTransaction(tokenId, nonce);
    }

    function cancelTransaction(WalletTypes.WalletStorage storage $, uint256 nonce) external {
        $.cancelled[nonce] = true;
        emit IWallet.TransactionCancelled(nonce);
    }

    function executeTransaction(
        WalletTypes.WalletStorage storage $,
        uint256 tokenId,
        uint256 nonce,
        bytes calldata data,
        address selfAddress
    ) external {
        txExists($, nonce);
        notExecuted($, nonce);
        notCancelled($, nonce);
        notExpired($, nonce);

        WalletTypes.Transaction storage transaction = $.transactions[nonce];

        if (transaction.target == address(0)) revert IWallet.InvalidTarget();

        bytes memory payload = resolveExecutionCalldata($, nonce, transaction, data, selfAddress);

        address target = transaction.target;
        uint256 value = transaction.value;

        transaction.executed = true;

        (bool success, bytes memory returnData) = target.call{value: value}(payload);
        if (!success) {
            transaction.executed = false;
            revert IWallet.TransactionFailed(returnData);
        }

        emit IWallet.ExecuteTransaction(tokenId, nonce);
    }

    function resolveExecutionCalldata(
        WalletTypes.WalletStorage storage $,
        uint256 nonce,
        WalletTypes.Transaction storage transaction,
        bytes calldata data,
        address selfAddress
    ) internal view returns (bytes memory payload) {
        bytes memory stored = $.transactionCalldata[nonce];
        if (stored.length != 0 || transaction.target == selfAddress) {
            payload = stored;
            if (data.length != 0 && keccak256(data) != transaction.dataHash) revert IWallet.DataHashMismatch();
        } else {
            payload = data;
        }
        if (keccak256(payload) != transaction.dataHash) revert IWallet.DataHashMismatch();
    }
}
