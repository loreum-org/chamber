// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {MockWallet} from "test/mock/MockWallet.sol";

contract WalletTest is Test {
    MockWallet wallet;
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        wallet = new MockWallet();
    }

    function test_Wallet_SubmitTransaction() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);

        MockWallet.Transaction memory trx = wallet.getTransaction(0);

        assertEq(target, trx.target);
        assertEq(value, trx.value);
        assertEq(data, trx.data);
        assertEq(false, trx.executed);
        assertEq(1, trx.confirmations);
    }

    function test_Wallet_ConfirmTransaction_Success() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);
        assertEq(wallet.getTransaction(0).confirmations, 1);
    }

    function test_Wallet_ConfirmTransaction_Fail() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);
        vm.expectRevert();
        wallet.confirmTransaction(1, 0);
    }

    function test_Wallet_RevokeConfirmation() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);
        wallet.revokeConfirmation(1, 0);

        assertEq(wallet.getTransaction(0).confirmations, 0);
    }

    function test_Wallet_ExecuteTransaction() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";
        deal(address(wallet), 1 ether);

        wallet.submitTransaction(1, target, value, data);
        wallet.executeTransaction(1, 0);

        assertEq(wallet.getTransaction(0).executed, true);
        assertEq(address(0x3).balance, 1 ether);
        assertEq(address(wallet).balance, 0);
    }

    function test_Wallet_GetTransactionCount() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);

        uint256 count = wallet.getTransactionCount();

        assertEq(count, 1);
    }

    function test_Wallet_GetConfirmation() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);

        bool isConfirmed = wallet.getConfirmation(1, 0);

        assertEq(isConfirmed, true);
    }

    function test_Wallet_GetCurrentNonce() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        // Initially, no transactions exist, so next nonce is 0
        uint256 initialNonce = wallet.getCurrentNonce();
        assertEq(initialNonce, 0);

        // After submitting 1 transaction, next nonce should be 1
        wallet.submitTransaction(1, target, value, data);

        uint256 newNonce = wallet.getCurrentNonce();
        assertEq(newNonce, 1);

        // After submitting 2 transactions, next nonce should be 2
        wallet.submitTransaction(1, target, value, data);

        uint256 newNonce1 = wallet.getCurrentNonce();
        assertEq(newNonce1, 2);
    }
}
