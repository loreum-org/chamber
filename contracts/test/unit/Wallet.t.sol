// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {MockWallet} from "test/mock/MockWallet.sol";
import {IWallet} from "src/interfaces/IWallet.sol";

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

        (bool executed, uint8 confirmations, address trxTarget, uint256 trxValue, bytes memory trxData) =
            wallet.getTransaction(0);

        assertEq(target, trxTarget);
        assertEq(value, trxValue);
        assertEq(data, trxData);
        assertEq(false, executed);
        assertEq(1, confirmations);
    }

    function test_Wallet_ConfirmTransaction_Success() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);
        (, uint8 confirmations,,,) = wallet.getTransaction(0);
        assertEq(confirmations, 1);
    }

    function test_Wallet_ConfirmTransaction_AlreadyConfirmed_Reverts() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);

        vm.expectRevert(IWallet.TransactionAlreadyConfirmed.selector);
        wallet.confirmTransaction(1, 0);
    }

    function test_Wallet_ConfirmTransaction_NonExistent_Reverts() public {
        vm.expectRevert(IWallet.TransactionDoesNotExist.selector);
        wallet.confirmTransaction(1, 999);
    }

    function test_Wallet_RevokeConfirmation() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);
        wallet.revokeConfirmation(1, 0);

        (, uint8 revokedConfirmations,,,) = wallet.getTransaction(0);
        assertEq(revokedConfirmations, 0);
    }

    function test_Wallet_RevokeConfirmation_NotConfirmed_Reverts() public {
        address target = address(0x3);
        bytes memory data = "";

        wallet.submitTransaction(1, target, 0, data);

        vm.expectRevert(IWallet.TransactionNotConfirmed.selector);
        wallet.revokeConfirmation(2, 0); // Different tokenId
    }

    function test_Wallet_RevokeConfirmation_NonExistent_Reverts() public {
        vm.expectRevert(IWallet.TransactionDoesNotExist.selector);
        wallet.revokeConfirmation(1, 999);
    }

    function test_Wallet_RevokeConfirmation_AlreadyExecuted_Reverts() public {
        address target = address(0x3);
        bytes memory data = "";
        deal(address(wallet), 1 ether);

        wallet.submitTransaction(1, target, 1 ether, data);
        wallet.executeTransaction(1, 0);

        vm.expectRevert(IWallet.TransactionAlreadyExecuted.selector);
        wallet.revokeConfirmation(1, 0);
    }

    function test_Wallet_ExecuteTransaction() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";
        deal(address(wallet), 1 ether);

        wallet.submitTransaction(1, target, value, data);
        wallet.executeTransaction(1, 0);

        (bool executed,,,,) = wallet.getTransaction(0);
        assertEq(executed, true);
        assertEq(address(0x3).balance, 1 ether);
        assertEq(address(wallet).balance, 0);
    }

    function test_Wallet_ExecuteTransaction_NonExistent_Reverts() public {
        vm.expectRevert(IWallet.TransactionDoesNotExist.selector);
        wallet.executeTransaction(1, 999);
    }

    function test_Wallet_ExecuteTransaction_AlreadyExecuted_Reverts() public {
        address target = address(0x3);
        bytes memory data = "";
        deal(address(wallet), 1 ether);

        wallet.submitTransaction(1, target, 1 ether, data);
        wallet.executeTransaction(1, 0);

        vm.expectRevert(IWallet.TransactionAlreadyExecuted.selector);
        wallet.executeTransaction(1, 0);
    }

    function test_Wallet_ExecuteTransaction_ZeroAddress_Reverts() public {
        // Submit a transaction with zero address target
        wallet.submitTransaction(1, address(0), 0, "");

        vm.expectRevert(IWallet.InvalidTarget.selector);
        wallet.executeTransaction(1, 0);
    }

    function test_Wallet_ExecuteTransaction_Failed_Reverts() public {
        // Create a contract that always reverts
        RevertingContract reverter = new RevertingContract();

        wallet.submitTransaction(1, address(reverter), 0, abi.encodeWithSignature("alwaysReverts()"));

        vm.expectRevert();
        wallet.executeTransaction(1, 0);
    }

    function test_Wallet_GetTransactionCount() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        assertEq(wallet.getTransactionCount(), 0);

        wallet.submitTransaction(1, target, value, data);
        assertEq(wallet.getTransactionCount(), 1);

        wallet.submitTransaction(1, target, value, data);
        assertEq(wallet.getTransactionCount(), 2);
    }

    function test_Wallet_GetConfirmation() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        wallet.submitTransaction(1, target, value, data);

        bool isConfirmed = wallet.getConfirmation(1, 0);
        assertEq(isConfirmed, true);

        bool isNotConfirmed = wallet.getConfirmation(2, 0);
        assertEq(isNotConfirmed, false);
    }

    function test_Wallet_GetCurrentNonce() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        bytes memory data = "";

        uint256 initialNonce = wallet.getCurrentNonce();
        assertEq(initialNonce, 0);

        wallet.submitTransaction(1, target, value, data);

        uint256 newNonce = wallet.getCurrentNonce();
        assertEq(newNonce, 0);

        wallet.submitTransaction(1, target, value, data);

        uint256 newNonce1 = wallet.getCurrentNonce();
        assertEq(newNonce1, 1);
    }

    function test_Wallet_GetNextTransactionId() public {
        assertEq(wallet.getNextTransactionId(), 0);

        wallet.submitTransaction(1, address(0x3), 0, "");
        assertEq(wallet.getNextTransactionId(), 1);

        wallet.submitTransaction(1, address(0x3), 0, "");
        assertEq(wallet.getNextTransactionId(), 2);
    }

    function test_Wallet_ConfirmTransaction_AlreadyExecuted_Reverts() public {
        address target = address(0x3);
        bytes memory data = "";
        deal(address(wallet), 1 ether);

        wallet.submitTransaction(1, target, 1 ether, data);
        wallet.executeTransaction(1, 0);

        vm.expectRevert(IWallet.TransactionAlreadyExecuted.selector);
        wallet.confirmTransaction(2, 0);
    }
}

contract RevertingContract {
    function alwaysReverts() external pure {
        revert("Always reverts");
    }
}
