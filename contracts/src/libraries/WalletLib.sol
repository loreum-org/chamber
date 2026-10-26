// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IWallet} from "src/interfaces/IWallet.sol";
import {WalletTypes} from "src/types/WalletTypes.sol";
import {ChamberId} from "src/libraries/ChamberId.sol";

/**
 * @title WalletLib
 * @notice Linked external library for multisig wallet transaction logic.
 * @dev Extracted to keep `Chamber` implementation under the EIP-170 size limit.
 */
library WalletLib {
    /// @dev Wallet calls may not spend approvals third parties gave the chamber (R-1012-M3).
    ///      Depositors approve the chamber on the vault asset, so calls to `asset` are limited to
    ///      `transfer` and `approve` (plain value sends with empty data are allowed). A selector
    ///      denylist cannot cover every pull alias (DAI `move` / `pull`, ERC-1363
    ///      `transferFromAndCall`), so it is only the fallback for other targets: there, ERC-20/721
    ///      `transferFrom`, ERC-721/1155 `safeTransferFrom`, ERC-1155 `safeBatchTransferFrom`,
    ///      `burnFrom`, DAI `move` / `pull`, ERC-1363 `transferFromAndCall` and ERC-777
    ///      `operatorSend` must name the chamber as `from` (first argument). Runs in the chamber's
    ///      context, so `address(this)` is the chamber.
    function requireNoThirdPartyPull(address target, address asset, bytes memory data) external view {
        if (target == asset) {
            if (data.length == 0) return;
            if (data.length >= 4) {
                bytes4 s = bytes4(data);
                if (s == 0xa9059cbb || s == 0x095ea7b3) return;
            }
            revert IWallet.InvalidTarget();
        }
        if (data.length < 36) return;
        bytes4 selector = bytes4(data);
        if (
            selector != 0x23b872dd && selector != 0x42842e0e && selector != 0xb88d4fde && selector != 0xf242432a
                && selector != 0x2eb2c2d6 && selector != 0x79cc6790 && selector != 0xbb35783b && selector != 0xf2d5d56b
                && selector != 0xd8fbe994 && selector != 0xc1d34b89 && selector != 0x62ad1b83
        ) return;
        uint256 from;
        assembly {
            from := mload(add(data, 36))
        }
        if (from != uint256(uint160(address(this)))) revert IWallet.InvalidTarget();
    }

    using WalletTypes for WalletTypes.WalletStorage;

    /// @dev The only accepted call to this chamber's ProxyAdmin (R-1012-L6).
    ///      `transferOwnership` and `renounceOwnership` are rejected, and so is every other selector.
    ///      `upgradeAndCall` must target this chamber and a deployed implementation whose `CHAMBER_ID()`
    ///      returns {ChamberId.ID}. Runs in the chamber's context, so `address(this)` is the proxy.
    function requireChamberUpgrade(bytes memory data) external view {
        if (data.length < 4 + 64) revert IWallet.InvalidTarget();
        bytes4 selector = bytes4(data);
        if (selector != ChamberId.UPGRADE_AND_CALL) revert IWallet.InvalidTarget();

        address proxy;
        address impl;
        assembly {
            proxy := mload(add(data, 36))
            impl := mload(add(data, 68))
        }
        if (proxy != address(this)) revert IWallet.InvalidTarget();
        if (impl.code.length == 0) revert IWallet.InvalidTarget();

        bytes32 id;
        uint256 size;
        bool ok;
        // `bytes4` is left-aligned, so the first four bytes of the word are the selector.
        bytes4 probeSelector = ChamberId.SELECTOR;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, probeSelector)
            ok := staticcall(gas(), impl, ptr, 4, 0, 0)
            size := returndatasize()
            if and(ok, eq(size, 32)) {
                returndatacopy(ptr, 0, 32)
                id := mload(ptr)
            }
        }
        if (!ok || size != 32 || id != ChamberId.ID) revert IWallet.InvalidTarget();
    }

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
        bool storeCalldata
    ) external {
        uint256 nonce = $.transactions.length;
        uint256 resolvedDeadline = resolveDeadline(deadline);

        bytes32 dataHash = keccak256(data);
        $.transactions
            .push(
                WalletTypes.Transaction({
                    target: target, value: value, dataHash: dataHash, executed: false, confirmations: 0
                })
            );
        if (storeCalldata) {
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
        if (!success || _returnedFalse(payload, returnData)) {
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

    /// @dev ERC-20 methods specified to return `bool` (R-1012-L2). A 32-byte zero word from one of
    ///      these is `false` and must not consume the nonce. The same word from any other selector
    ///      (a `uint256` success code, `address(0)`, a custom function) stays success: the wallet
    ///      cannot see the ABI. Empty return data stays success, matching tokens that return nothing.
    function _returnedFalse(bytes memory payload, bytes memory returnData) internal pure returns (bool) {
        if (returnData.length != 32 || !_selectorReturnsBool(payload)) return false;
        uint256 word;
        assembly {
            word := mload(add(returnData, 32))
        }
        return word == 0;
    }

    /// @dev `transfer`, `transferFrom`, `approve`, `increaseAllowance`, `decreaseAllowance`.
    function _selectorReturnsBool(bytes memory payload) internal pure returns (bool) {
        if (payload.length < 4) return false;
        bytes4 selector;
        assembly {
            selector := mload(add(payload, 32))
        }
        return selector == 0xa9059cbb || selector == 0x23b872dd || selector == 0x095ea7b3 || selector == 0x39509351
            || selector == 0xa457c2d7;
    }
}
