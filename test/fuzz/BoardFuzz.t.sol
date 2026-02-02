// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {MockBoard} from "test/mock/MockBoard.sol";
import {IBoard} from "src/interfaces/IBoard.sol";

contract BoardFuzzTest is Test {
    MockBoard board;

    uint256 constant MAX_NODES = 100;
    uint256 constant MAX_AMOUNT = type(uint256).max / 2; // Avoid overflow

    function setUp() public {
        board = new MockBoard();
        board.setSeats(0, 5);
    }

    /// @notice Fuzz test for inserting nodes with random tokenIds and amounts
    function testFuzz_Insert(uint256 tokenId, uint256 amount) public {
        // Bound inputs to reasonable values
        tokenId = bound(tokenId, 1, type(uint256).max);
        amount = bound(amount, 1, MAX_AMOUNT);

        // Skip if already exists
        if (board.getNode(tokenId).tokenId == tokenId) return;

        uint256 initialSize = board.getSize();
        board.insert(tokenId, amount);

        // Verify node was inserted
        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.tokenId, tokenId);
        assertEq(node.amount, amount);
        assertEq(board.getSize(), initialSize + 1);
    }

    /// @notice Fuzz test for inserting multiple nodes and verifying sorted order
    function testFuzz_InsertMultiple(uint256[10] memory tokenIds, uint256[10] memory amounts) public {
        // Bound inputs
        for (uint256 i = 0; i < 10; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max);
            amounts[i] = bound(amounts[i], 1, MAX_AMOUNT);
            
            // Ensure unique tokenIds
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    tokenIds[i] = tokenIds[i] + 1;
                }
            }
        }

        // Insert all nodes
        for (uint256 i = 0; i < 10; i++) {
            if (board.getNode(tokenIds[i]).tokenId == 0) {
                board.insert(tokenIds[i], amounts[i]);
            }
        }

        // Verify sorted order (descending by amount)
        (uint256[] memory topTokenIds, uint256[] memory topAmounts) = board.getTop(10);
        
        for (uint256 i = 0; i < topTokenIds.length - 1; i++) {
            assertGe(topAmounts[i], topAmounts[i + 1], "Board should be sorted in descending order");
        }
    }

    /// @notice Fuzz test for delegate operations
    function testFuzz_Delegate(uint256 tokenId, uint256 initialAmount, uint256 delegateAmount) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        initialAmount = bound(initialAmount, 1, MAX_AMOUNT / 2);
        delegateAmount = bound(delegateAmount, 1, MAX_AMOUNT / 2);

        // Insert initial node
        if (board.getNode(tokenId).tokenId == 0) {
            board.insert(tokenId, initialAmount);
        }

        uint256 beforeAmount = board.getNode(tokenId).amount;
        board.exposed_delegate(tokenId, delegateAmount);

        // Verify amount increased
        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.amount, beforeAmount + delegateAmount);
    }

    /// @notice Fuzz test for undelegate operations
    function testFuzz_Undelegate(uint256 tokenId, uint256 initialAmount, uint256 undelegateAmount) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        initialAmount = bound(initialAmount, 1, MAX_AMOUNT);
        undelegateAmount = bound(undelegateAmount, 1, initialAmount); // Can't undelegate more than exists

        // Setup: insert and delegate
        if (board.getNode(tokenId).tokenId == 0) {
            board.insert(tokenId, initialAmount);
        } else {
            board.exposed_delegate(tokenId, initialAmount);
        }

        uint256 beforeAmount = board.getNode(tokenId).amount;
        uint256 initialSize = board.getSize();

        board.exposed_undelegate(tokenId, undelegateAmount);

        uint256 afterAmount = board.getNode(tokenId).amount;
        
        if (afterAmount == 0) {
            // Node should be removed if amount becomes zero
            assertEq(board.getSize(), initialSize - 1);
            assertEq(board.getNode(tokenId).tokenId, 0);
        } else {
            // Node should still exist with reduced amount
            assertEq(afterAmount, beforeAmount - undelegateAmount);
            assertEq(board.getSize(), initialSize);
        }
    }

    /// @notice Fuzz test for reposition after amount change
    function testFuzz_Reposition(uint256 tokenId1, uint256 tokenId2, uint256 amount1, uint256 amount2, uint256 additionalAmount) public {
        // Bound inputs
        tokenId1 = bound(tokenId1, 1, type(uint256).max);
        tokenId2 = bound(tokenId2, 1, type(uint256).max);
        if (tokenId1 == tokenId2) tokenId2 = tokenId1 + 1;
        
        amount1 = bound(amount1, 1, MAX_AMOUNT / 2);
        amount2 = bound(amount2, 1, MAX_AMOUNT / 2);
        additionalAmount = bound(additionalAmount, 1, MAX_AMOUNT / 2);

        // Insert two nodes
        board.insert(tokenId1, amount1);
        board.insert(tokenId2, amount2);

        // Determine initial order
        uint256 initialHead = board.getHead();
        
        // Add amount to tokenId1 that might change order
        board.exposed_delegate(tokenId1, additionalAmount);

        // Verify board is still sorted
        (uint256[] memory topTokenIds, uint256[] memory topAmounts) = board.getTop(2);
        
        if (topTokenIds.length >= 2) {
            assertGe(topAmounts[0], topAmounts[1], "Board should remain sorted after reposition");
        }
    }

    /// @notice Fuzz test for remove operations
    function testFuzz_Remove(uint256 tokenId, uint256 amount) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        amount = bound(amount, 1, MAX_AMOUNT);

        // Insert node
        board.insert(tokenId, amount);
        uint256 initialSize = board.getSize();

        // Remove node
        board.remove(tokenId);

        // Verify removal
        assertEq(board.getNode(tokenId).tokenId, 0);
        assertEq(board.getNode(tokenId).amount, 0);
        assertEq(board.getSize(), initialSize - 1);
    }

    /// @notice Fuzz test for getTop with various counts
    function testFuzz_GetTop(uint256 count, uint256 numNodes) public {
        // Bound inputs
        numNodes = bound(numNodes, 1, 50); // Reasonable number of nodes
        count = bound(count, 0, 100);

        // Insert nodes
        for (uint256 i = 1; i <= numNodes; i++) {
            uint256 amount = i * 100; // Different amounts
            if (board.getNode(i).tokenId == 0) {
                board.insert(i, amount);
            }
        }

        // Get top
        (uint256[] memory tokenIds, uint256[] memory amounts) = board.getTop(count);

        // Verify results
        uint256 expectedCount = count > numNodes ? numNodes : count;
        assertEq(tokenIds.length, expectedCount);
        assertEq(amounts.length, expectedCount);

        // Verify sorted order
        for (uint256 i = 0; i < tokenIds.length - 1; i++) {
            assertGe(amounts[i], amounts[i + 1], "Results should be sorted");
        }
    }

    /// @notice Fuzz test for MAX_NODES limit
    function testFuzz_MaxNodes(uint256 tokenId) public {
        // Fill up to MAX_NODES
        for (uint256 i = 1; i <= MAX_NODES; i++) {
            if (board.getNode(i).tokenId == 0) {
                board.insert(i, i * 100);
            }
        }

        // Bound tokenId to be unique
        tokenId = bound(tokenId, MAX_NODES + 1, type(uint256).max);

        // Should revert when trying to insert beyond MAX_NODES
        vm.expectRevert(IBoard.MaxNodesReached.selector);
        board.insert(tokenId, 1);
    }

    /// @notice Fuzz test for undelegate exceeding amount
    function testFuzz_UndelegateExceedsAmount(uint256 tokenId, uint256 amount, uint256 undelegateAmount) public {
        // Bound inputs
        tokenId = bound(tokenId, 1, type(uint256).max);
        amount = bound(amount, 1, MAX_AMOUNT);
        undelegateAmount = bound(undelegateAmount, amount + 1, type(uint256).max); // More than exists

        // Setup
        if (board.getNode(tokenId).tokenId == 0) {
            board.insert(tokenId, amount);
        }

        // Should revert
        vm.expectRevert(IBoard.AmountExceedsDelegation.selector);
        board.exposed_undelegate(tokenId, undelegateAmount);
    }

    /// @notice Fuzz test for quorum calculation
    function testFuzz_Quorum(uint256 seats) public {
        // Bound seats to valid range
        seats = bound(seats, 1, 20);

        board.setSeats(0, seats);
        uint256 quorum = board.getQuorum();

        // Quorum should be 1 + (seats * 51) / 100
        uint256 expectedQuorum = 1 + (seats * 51) / 100;
        assertEq(quorum, expectedQuorum);
    }

    /// @notice Invariant: Board size should never exceed MAX_NODES
    function testFuzz_Invariant_MaxNodes(uint256[20] memory tokenIds, uint256[20] memory amounts) public {
        // Bound inputs
        for (uint256 i = 0; i < 20; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max);
            amounts[i] = bound(amounts[i], 1, MAX_AMOUNT);
            
            // Ensure unique tokenIds
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    tokenIds[i] = tokenIds[i] + 1;
                }
            }
        }

        // Insert nodes
        for (uint256 i = 0; i < 20; i++) {
            if (board.getSize() < MAX_NODES && board.getNode(tokenIds[i]).tokenId == 0) {
                board.insert(tokenIds[i], amounts[i]);
            }
        }

        // Invariant: size should never exceed MAX_NODES
        assertLe(board.getSize(), MAX_NODES, "Board size should never exceed MAX_NODES");
    }

    /// @notice Invariant: Head should always point to node with highest amount
    function testFuzz_Invariant_HeadIsHighest(uint256[10] memory tokenIds, uint256[10] memory amounts) public {
        // Bound inputs
        for (uint256 i = 0; i < 10; i++) {
            tokenIds[i] = bound(tokenIds[i], 1, type(uint256).max);
            amounts[i] = bound(amounts[i], 1, MAX_AMOUNT);
            
            // Ensure unique tokenIds
            for (uint256 j = 0; j < i; j++) {
                if (tokenIds[i] == tokenIds[j]) {
                    tokenIds[i] = tokenIds[i] + 1;
                }
            }
        }

        // Insert nodes
        for (uint256 i = 0; i < 10; i++) {
            if (board.getNode(tokenIds[i]).tokenId == 0) {
                board.insert(tokenIds[i], amounts[i]);
            }
        }

        if (board.getSize() > 0) {
            uint256 head = board.getHead();
            uint256 headAmount = board.getNode(head).amount;

            // Check all nodes have amount <= head amount
            (uint256[] memory topTokenIds, uint256[] memory topAmounts) = board.getTop(10);
            for (uint256 i = 0; i < topTokenIds.length; i++) {
                assertLe(topAmounts[i], headAmount, "Head should have highest amount");
            }
        }
    }
}
