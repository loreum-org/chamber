// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {MockWallet} from "test/mock/MockWallet.sol";
import {IWallet} from "src/interfaces/IWallet.sol";

contract WalletFuzzTest is Test {
    MockWallet wallet;
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        wallet = new MockWallet();
    }

    /// @notice Fuzz test for submitting transactions with random data
    function testFuzz_SubmitTransaction(uint256 tokenId, address target, uint256 value, bytes memory data) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        value = bound(value, 0, 100 ether);
        // Don't allow zero address or self
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        // Fund wallet if value > 0
        if (value > 0) {
            deal(address(wallet), value);
        }

        uint256 initialCount = wallet.getTransactionCount();
        wallet.submitTransaction(tokenId, target, value, data);

        // Verify transaction was submitted
        assertEq(wallet.getTransactionCount(), initialCount + 1);

        (bool executed, uint8 confirmations, address trxTarget, uint256 trxValue, bytes memory trxData) =
            wallet.getTransaction(initialCount);

        assertEq(executed, false);
        assertEq(confirmations, 1); // Auto-confirmed by submitter
        assertEq(trxTarget, target);
        assertEq(trxValue, value);
        assertEq(keccak256(trxData), keccak256(data));
    }

    /// @notice Fuzz test for confirming transactions
    function testFuzz_ConfirmTransaction(uint256 tokenId1, uint256 tokenId2, address target, uint256 value) public {
        // Bound inputs
        tokenId1 = bound(tokenId1, 1, type(uint256).max);
        tokenId2 = bound(tokenId2, 1, type(uint256).max);
        if (tokenId1 == tokenId2) tokenId2 = tokenId1 + 1;
        value = bound(value, 0, 100 ether);
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        if (value > 0) {
            deal(address(wallet), value);
        }

        // Submit transaction
        wallet.submitTransaction(tokenId1, target, value, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Confirm with different tokenId
        wallet.confirmTransaction(tokenId2, transactionId);

        // Verify confirmation
        (, uint8 confirmations,,,) = wallet.getTransaction(transactionId);
        assertEq(confirmations, 2);
        assertTrue(wallet.getConfirmation(tokenId1, transactionId));
        assertTrue(wallet.getConfirmation(tokenId2, transactionId));
    }

    /// @notice Fuzz test for revoking confirmations
    function testFuzz_RevokeConfirmation(uint256 tokenId, address target, uint256 value) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        value = bound(value, 0, 100 ether);
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        if (value > 0) {
            deal(address(wallet), value);
        }

        // Submit and confirm
        wallet.submitTransaction(tokenId, target, value, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Revoke confirmation
        wallet.revokeConfirmation(tokenId, transactionId);

        // Verify revocation
        (, uint8 confirmations,,,) = wallet.getTransaction(transactionId);
        assertEq(confirmations, 0);
        assertFalse(wallet.getConfirmation(tokenId, transactionId));
    }

    /// @notice Fuzz test for executing transactions
    function testFuzz_ExecuteTransaction(uint256 tokenId, address target, uint256 value) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        value = bound(value, 1, 100 ether); // Must have value for execution test

        // Use a payable address that can receive ETH (exclude precompiles, contracts, and special addresses)
        // Precompiles are addresses 0x1-0x9, so we exclude addresses < 0x10
        // Also exclude console.log address (0x000000000000000000636F6e736F6c652e6c6f67)
        address consoleAddress = address(0x000000000000000000636F6e736F6c652e6c6f67);
        if (
            target == address(0) || target == address(wallet) || uint160(target) < 0x10 || target.code.length > 0
                || target == consoleAddress
        ) {
            target = payable(address(0x100)); // Use address >= 0x100 to avoid precompiles
        }

        // Fund wallet
        deal(address(wallet), value);
        uint256 initialBalance = target.balance;

        // Submit transaction
        wallet.submitTransaction(tokenId, target, value, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Execute transaction
        wallet.executeTransaction(tokenId, transactionId);

        // Verify execution
        (bool executed,,,,) = wallet.getTransaction(transactionId);
        assertEq(executed, true);
        assertEq(target.balance, initialBalance + value);
        assertEq(address(wallet).balance, 0);
    }

    /// @notice Fuzz test for multiple transactions
    function testFuzz_MultipleTransactions(
        uint256[5] memory tokenIds,
        address[5] memory targets,
        uint256[5] memory values
    ) public {
        // Bound inputs
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max);
            values[i] = bound(values[i], 0, 20 ether);
            if (targets[i] == address(0) || targets[i] == address(wallet)) {
                targets[i] = address(uint160(i + 100));
            }
        }

        uint256 totalValue = 0;
        for (uint256 i = 0; i < 5; i++) {
            totalValue += values[i];
        }
        if (totalValue > 0) {
            deal(address(wallet), totalValue);
        }

        // Submit multiple transactions
        for (uint256 i = 0; i < 5; i++) {
            wallet.submitTransaction(tokenIds[i], targets[i], values[i], "");
        }

        // Verify all transactions were submitted
        assertEq(wallet.getTransactionCount(), 5);

        // Verify each transaction
        for (uint256 i = 0; i < 5; i++) {
            (bool executed, uint8 confirmations, address trxTarget, uint256 trxValue,) = wallet.getTransaction(i);

            assertEq(executed, false);
            assertEq(confirmations, 1);
            assertEq(trxTarget, targets[i]);
            assertEq(trxValue, values[i]);
        }
    }

    /// @notice Fuzz test for getTransactionCount
    function testFuzz_GetTransactionCount(uint256 numTransactions) public {
        numTransactions = bound(numTransactions, 0, 50);

        for (uint256 i = 0; i < numTransactions; i++) {
            wallet.submitTransaction(i + 1, address(0x3), 0, "");
        }

        assertEq(wallet.getTransactionCount(), numTransactions);
    }

    /// @notice Fuzz test for getNextTransactionId
    function testFuzz_GetNextTransactionId(uint256 numTransactions) public {
        numTransactions = bound(numTransactions, 0, 50);

        for (uint256 i = 0; i < numTransactions; i++) {
            assertEq(wallet.getNextTransactionId(), i);
            wallet.submitTransaction(i + 1, address(0x3), 0, "");
        }

        assertEq(wallet.getNextTransactionId(), numTransactions);
    }

    /// @notice Fuzz test for already confirmed transaction (should revert)
    function testFuzz_ConfirmAlreadyConfirmed(uint256 tokenId, address target) public {
        tokenId = bound(tokenId, 1, type(uint256).max);
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        wallet.submitTransaction(tokenId, target, 0, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Try to confirm again - should revert
        vm.expectRevert(IWallet.TransactionAlreadyConfirmed.selector);
        wallet.confirmTransaction(tokenId, transactionId);
    }

    /// @notice Fuzz test for confirming non-existent transaction (should revert)
    function testFuzz_ConfirmNonExistent(uint256 tokenId, uint256 transactionId) public {
        tokenId = bound(tokenId, 1, type(uint256).max);
        transactionId = bound(transactionId, 100, type(uint256).max); // High ID that doesn't exist

        vm.expectRevert(IWallet.TransactionDoesNotExist.selector);
        wallet.confirmTransaction(tokenId, transactionId);
    }

    /// @notice Fuzz test for executing already executed transaction (should revert)
    function testFuzz_ExecuteAlreadyExecuted(uint256 tokenId, address target, uint256 value) public {
        tokenId = bound(tokenId, 1, type(uint256).max);
        value = bound(value, 1, 100 ether);

        // Use a payable address that can receive ETH (exclude precompiles, contracts, and special addresses)
        // Precompiles are addresses 0x1-0x9, and some networks have more
        // Also exclude addresses that might be problematic (low addresses < 0x10)
        // Exclude console.log address (0x000000000000000000636F6e736F6c652e6c6f67)
        if (
            target == address(0) || target == address(wallet) || uint160(target) < 0x10 || target.code.length > 0
                || target == address(0x000000000000000000636F6e736F6c652e6c6f67)
        ) {
            target = payable(address(0x3));
        }

        deal(address(wallet), value);

        wallet.submitTransaction(tokenId, target, value, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Execute once
        wallet.executeTransaction(tokenId, transactionId);

        // Try to execute again - should revert
        vm.expectRevert(IWallet.TransactionAlreadyExecuted.selector);
        wallet.executeTransaction(tokenId, transactionId);
    }

    /// @notice Fuzz test for revoking non-confirmed transaction (should revert)
    function testFuzz_RevokeNonConfirmed(uint256 tokenId1, uint256 tokenId2, address target) public {
        tokenId1 = bound(tokenId1, 1, type(uint256).max - 1); // Leave room for +1
        tokenId2 = bound(tokenId2, 1, type(uint256).max);
        if (tokenId1 == tokenId2) {
            unchecked {
                if (tokenId1 < type(uint256).max) {
                    tokenId2 = tokenId1 + 1;
                } else {
                    tokenId2 = 1;
                }
            }
        }
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        wallet.submitTransaction(tokenId1, target, 0, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Try to revoke with different tokenId that didn't confirm - should revert
        vm.expectRevert(IWallet.TransactionNotConfirmed.selector);
        wallet.revokeConfirmation(tokenId2, transactionId);
    }

    /// @notice Invariant: Transaction count should always match array length
    function testFuzz_Invariant_TransactionCount(uint256 numTransactions) public {
        numTransactions = bound(numTransactions, 0, 100);

        for (uint256 i = 0; i < numTransactions; i++) {
            wallet.submitTransaction(i + 1, address(0x3), 0, "");
        }

        // Invariant: getTransactionCount should equal number of transactions
        assertEq(wallet.getTransactionCount(), numTransactions);
        assertEq(wallet.getNextTransactionId(), numTransactions);
    }

    /// @notice Invariant: Executed transactions should remain executed
    function testFuzz_Invariant_ExecutedTransactions(uint256[3] memory tokenIds, uint256[3] memory values) public {
        for (uint256 i = 0; i < 3; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max);
            values[i] = bound(values[i], 1, 30 ether);
        }

        uint256 totalValue = 0;
        for (uint256 i = 0; i < 3; i++) {
            totalValue += values[i];
        }
        deal(address(wallet), totalValue);

        // Submit and execute transactions
        for (uint256 i = 0; i < 3; i++) {
            address target = address(uint160(i + 100));
            wallet.submitTransaction(tokenIds[i], target, values[i], "");
            wallet.executeTransaction(tokenIds[i], i);
        }

        // Invariant: All executed transactions should remain executed
        for (uint256 i = 0; i < 3; i++) {
            (bool executed,,,,) = wallet.getTransaction(i);
            assertTrue(executed, "Executed transactions should remain executed");
        }
    }

    /// @notice Invariant: Confirmation count should match number of confirmers
    function testFuzz_Invariant_ConfirmationCount(uint256[5] memory tokenIds, address target) public {
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max - 10); // Leave room for uniqueness
            // Ensure unique tokenIds
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    // Avoid overflow when incrementing
                    if (tokenIds[i] < type(uint256).max) {
                        tokenIds[i] = tokenIds[i] + i + 1;
                    } else {
                        // If at max, use a different value based on index
                        tokenIds[i] = (i + 1) % (type(uint256).max - 10);
                        if (tokenIds[i] == 0) tokenIds[i] = i + 1;
                    }
                }
            }
        }
        if (target == address(0) || target == address(wallet)) {
            target = address(0x3);
        }

        // Submit transaction
        wallet.submitTransaction(tokenIds[0], target, 0, "");
        uint256 transactionId = wallet.getTransactionCount() - 1;

        // Confirm with multiple tokenIds
        for (uint256 i = 1; i < 5; i++) {
            wallet.confirmTransaction(tokenIds[i], transactionId);
        }

        // Invariant: Confirmation count should equal number of confirmers
        // Note: confirmations is uint8, so max 255. With 5 tokenIds (1 submitter + 4 confirmers), we're well within limit
        (, uint8 confirmations,,,) = wallet.getTransaction(transactionId);
        assertEq(confirmations, 5); // 1 submitter + 4 additional confirmers
    }
}
