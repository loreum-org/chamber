// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Wallet} from "src/Wallet.sol";

contract MockWallet is Wallet {
    function submitTransaction(uint256 tokenId, address to, uint256 value, bytes memory data) public {
        _submitTransaction(tokenId, to, value, data);
    }

    function confirmTransaction(uint256 tokenId, uint256 transactionId) public {
        _confirmTransaction(tokenId, transactionId);
    }

    function executeTransaction(uint256 tokenId, uint256 transactionId) public {
        _executeTransaction(tokenId, transactionId);
    }

    function revokeConfirmation(uint256 tokenId, uint256 transactionId) public {
        _revokeConfirmation(tokenId, transactionId);
    }
}
