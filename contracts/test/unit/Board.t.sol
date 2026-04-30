// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {MockBoard} from "test/mock/MockBoard.sol";
import {IBoard} from "src/interfaces/IBoard.sol";

contract BoardTest is Test {
    MockBoard board;

    uint256 constant MAX_NODES = 50;

    function setUp() public {
        board = new MockBoard();
        // Initialize seats for quorum tests
        board.setSeats(0, 5);
    }

    function test_Board_Insert() public {
        uint256 tokenId = 1;
        uint256 amount = 100;

        board.insert(tokenId, amount);

        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.tokenId, tokenId);
        assertEq(node.amount, amount);
    }

    function test_Board_Insert_AtHead() public {
        // Insert first node
        board.insert(1, 100);
        // Insert larger amount - should become head
        board.insert(2, 200);

        assertEq(board.getHead(), 2);
    }

    function test_Board_Insert_AtTail() public {
        // Insert first node
        board.insert(1, 200);
        // Insert smaller amount - should become tail
        board.insert(2, 100);

        (uint256[] memory tokenIds,) = board.getTop(2);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 2);
    }

    function test_Board_Insert_InMiddle() public {
        board.insert(1, 300);
        board.insert(2, 100);
        board.insert(3, 200); // Should be in middle

        (uint256[] memory tokenIds,) = board.getTop(3);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 3);
        assertEq(tokenIds[2], 2);
    }

    function test_Board_Remove() public {
        uint256 tokenId = 1;
        uint256 amount = 100;

        board.insert(tokenId, amount);
        board.remove(tokenId);

        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.tokenId, 0);
        assertEq(node.amount, 0);
    }

    function test_Board_Remove_Head() public {
        board.insert(1, 300);
        board.insert(2, 200);
        board.insert(3, 100);

        board.remove(1); // Remove head

        assertEq(board.getHead(), 2);
        assertEq(board.getSize(), 2);
    }

    function test_Board_Remove_Tail() public {
        board.insert(1, 300);
        board.insert(2, 200);
        board.insert(3, 100);

        board.remove(3); // Remove tail

        assertEq(board.getSize(), 2);
    }

    function test_Board_Remove_Middle() public {
        board.insert(1, 300);
        board.insert(2, 200);
        board.insert(3, 100);

        board.remove(2); // Remove middle

        assertEq(board.getSize(), 2);
        (uint256[] memory tokenIds,) = board.getTop(2);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 3);
    }

    function test_Board_Reposition() public {
        uint256 tokenId = 1;
        uint256 amount = 100;

        board.insert(tokenId, amount);
        board.reposition(tokenId);

        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.tokenId, tokenId);
        assertEq(node.amount, amount);
    }

    function test_Board_Reposition_NonExistent_Reverts() public {
        vm.expectRevert(IBoard.NodeDoesNotExist.selector);
        board.reposition(999);
    }

    function test_Board_GetNode() public {
        uint256 tokenId = 1;
        uint256 amount = 100;

        board.insert(tokenId, amount);

        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.tokenId, tokenId);
        assertEq(node.amount, amount);
    }

    function test_Board_GetTop() public {
        uint256 count = 3;
        uint256[] memory tokenIds = new uint256[](count);
        uint256[] memory amounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = i + 1;
            amounts[i] = (i + 1) * 100;
            board.insert(tokenIds[i], amounts[i]);
        }

        (uint256[] memory topTokenIds, uint256[] memory topAmounts) = board.getTop(count);

        for (uint256 i = 0; i < count; i++) {
            assertEq(topTokenIds[i], tokenIds[(count - 1) - i]);
            assertEq(topAmounts[i], amounts[(count - 1) - i]);
        }
    }

    function test_Board_GetTop_MoreThanSize() public {
        board.insert(1, 100);
        board.insert(2, 200);

        (uint256[] memory tokenIds,) = board.getTop(10);
        assertEq(tokenIds.length, 2);
    }

    function test_Board_DelegateMaxNodes() public {
        uint256 maxNodes = MAX_NODES;
        uint256 amount = 100;

        for (uint256 i = 1; i <= maxNodes; i++) {
            board.insert(i, amount);
        }

        assertEq(board.getSize(), maxNodes);

        vm.expectRevert(IBoard.MaxNodesReached.selector);
        board.insert(maxNodes + 1, 1);

        assertEq(board.getSize(), maxNodes);
    }

    function test_Board_Delegate() public {
        board.exposed_delegate(1, 100);

        MockBoard.Node memory node = board.getNode(1);
        assertEq(node.amount, 100);
    }

    function test_Board_Delegate_ExistingNode() public {
        board.exposed_delegate(1, 100);
        board.exposed_delegate(1, 50);

        MockBoard.Node memory node = board.getNode(1);
        assertEq(node.amount, 150);
    }

    function test_Board_Undelegate() public {
        board.exposed_delegate(1, 100);
        board.exposed_undelegate(1, 50);

        MockBoard.Node memory node = board.getNode(1);
        assertEq(node.amount, 50);
    }

    function test_Board_Undelegate_Full() public {
        board.exposed_delegate(1, 100);
        board.exposed_undelegate(1, 100);

        MockBoard.Node memory node = board.getNode(1);
        assertEq(node.amount, 0);
        assertEq(board.getSize(), 0);
    }

    function test_Board_Undelegate_NonExistent_Reverts() public {
        vm.expectRevert(IBoard.NodeDoesNotExist.selector);
        board.exposed_undelegate(999, 100);
    }

    function test_Board_Undelegate_ExceedsAmount_Reverts() public {
        board.exposed_delegate(1, 100);

        vm.expectRevert(IBoard.AmountExceedsDelegation.selector);
        board.exposed_undelegate(1, 150);
    }

    function test_Board_SetSeats_Initial() public {
        MockBoard newBoard = new MockBoard();
        newBoard.setSeats(0, 5);

        assertEq(newBoard.getSeats(), 5);
    }

    function test_Board_SetSeats_ZeroSeats_Reverts() public {
        MockBoard newBoard = new MockBoard();

        vm.expectRevert(IBoard.InvalidNumSeats.selector);
        newBoard.setSeats(0, 0);
    }

    function test_Board_SetSeats_Proposal() public {
        // First call creates a proposal
        board.setSeats(1, 7);

        (uint256 proposedSeats, uint256 timestamp,,) = board.getSeatUpdate();
        assertEq(proposedSeats, 7);
        assertGt(timestamp, 0);
    }

    function test_Board_SetSeats_ProposerCanCancel() public {
        board.setSeats(1, 7);
        board.setSeats(2, 7);
        // Proposer (tokenId 1) cancels by proposing different seats
        board.setSeats(1, 8);

        (uint256 proposedSeats, uint256 timestamp,,) = board.getSeatUpdate();
        assertEq(proposedSeats, 0);
        assertEq(timestamp, 0);
    }

    function test_Board_SetSeats_NonProposerCannotCancel() public {
        board.setSeats(1, 7);
        board.setSeats(2, 7);
        // Non-proposer (tokenId 2) cannot cancel — Fix Finding 14
        vm.expectRevert(IBoard.OnlyProposerCanCancel.selector);
        board.setSeats(2, 8);
    }

    function test_Board_SetSeats_AlreadyVoted_Reverts() public {
        board.setSeats(1, 7);

        vm.expectRevert(IBoard.AlreadySentUpdateRequest.selector);
        board.setSeats(1, 7); // Same tokenId voting again
    }

    function test_Board_SetSeats_AddsSupport() public {
        board.setSeats(1, 7);
        board.setSeats(2, 7);

        (,,, uint256[] memory supporters) = board.getSeatUpdate();
        assertEq(supporters.length, 2);
    }

    function test_Board_ExecuteSeatsUpdate_NoProposal_Reverts() public {
        vm.expectRevert(IBoard.InvalidProposal.selector);
        board.executeSeatsUpdate(1);
    }

    function test_Board_ExecuteSeatsUpdate_TimelockNotExpired_Reverts() public {
        board.setSeats(1, 7);
        board.setSeats(2, 7);
        board.setSeats(3, 7);

        vm.expectRevert(IBoard.TimelockNotExpired.selector);
        board.executeSeatsUpdate(1);
    }

    function test_Board_ExecuteSeatsUpdate_InsufficientVotes_Reverts() public {
        board.setSeats(1, 7);

        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(IBoard.InsufficientVotes.selector);
        board.executeSeatsUpdate(1);
    }

    function test_Board_ExecuteSeatsUpdate_Success() public {
        // Need quorum of 3 for 5 seats (1 + 5*51/100 = 3)
        // Supporters must be in top seats for validation
        board.insert(1, 100);
        board.insert(2, 100);
        board.insert(3, 100);

        board.setSeats(1, 7);
        board.setSeats(2, 7);
        board.setSeats(3, 7);

        vm.warp(block.timestamp + 8 days);

        board.executeSeatsUpdate(1);

        assertEq(board.getSeats(), 7);
    }

    function test_Board_GetQuorum() public view {
        // 5 seats: quorum = 1 + (5 * 51) / 100 = 1 + 2 = 3
        assertEq(board.getQuorum(), 3);
    }

    function test_Board_GetSeats() public view {
        assertEq(board.getSeats(), 5);
    }

    function test_Board_Remove_OnlyNode() public {
        board.insert(1, 100);
        assertEq(board.getSize(), 1);

        board.remove(1);

        assertEq(board.getSize(), 0);
        assertEq(board.getHead(), 0);
    }

    function test_Board_Delegate_Reposition() public {
        // Test that delegate repositions correctly when amount increases
        board.exposed_delegate(1, 100);
        board.exposed_delegate(2, 200);

        // Now 2 is at head
        assertEq(board.getHead(), 2);

        // Add more to 1 to make it larger
        board.exposed_delegate(1, 150);

        // Now 1 should be at head (250 > 200)
        assertEq(board.getHead(), 1);
    }

    function test_Board_Undelegate_Reposition() public {
        board.exposed_delegate(1, 300);
        board.exposed_delegate(2, 200);

        assertEq(board.getHead(), 1);

        // Undelegate enough to make 2 larger
        board.exposed_undelegate(1, 150);

        // Now 2 should be at head
        assertEq(board.getHead(), 2);
    }

    function test_Board_Insert_EqualAmounts() public {
        board.insert(1, 100);
        board.insert(2, 100);
        board.insert(3, 100);

        // All same amount - should maintain insertion order
        (uint256[] memory tokenIds,) = board.getTop(3);
        assertEq(tokenIds.length, 3);
    }

    // ─── Eviction when at MAX_NODES ────────────────────────────────────

    function test_Board_Insert_EvictsTailWhenFullAndAmountHigher() public {
        // Fill board to MAX_NODES with amount=100 each
        for (uint256 i = 1; i <= MAX_NODES; i++) {
            board.insert(i, 100);
        }
        assertEq(board.getSize(), MAX_NODES);

        // Insert a new node with amount > 100 → should evict the tail and succeed
        uint256 newTokenId = MAX_NODES + 1;
        board.insert(newTokenId, 200);

        assertEq(board.getSize(), MAX_NODES);

        // The new high-value node is now the head
        assertEq(board.getHead(), newTokenId);
    }

    function test_Board_Insert_MaxNodesReached_LowerAmount_Reverts() public {
        for (uint256 i = 1; i <= MAX_NODES; i++) {
            board.insert(i, 100);
        }

        vm.expectRevert(IBoard.MaxNodesReached.selector);
        board.insert(MAX_NODES + 1, 50); // lower than tail → reverts
    }

    // ─── Empty board ───────────────────────────────────────────────────

    function test_Board_GetTop_EmptyBoard() public {
        MockBoard emptyBoard = new MockBoard();
        (uint256[] memory tokenIds, uint256[] memory amounts) = emptyBoard.getTop(5);
        assertEq(tokenIds.length, 0);
        assertEq(amounts.length, 0);
    }

    // ─── Circuit breaker ───────────────────────────────────────────────

    function test_Board_CircuitBreakerActive_Delegate_Reverts() public {
        board.exposed_delegate(1, 100);
        board.lockBoard(); // manually set locked = true

        vm.expectRevert(IBoard.CircuitBreakerActive.selector);
        board.exposed_delegate(2, 100);
    }

    function test_Board_CircuitBreakerActive_Undelegate_Reverts() public {
        board.exposed_delegate(1, 100);
        board.lockBoard();

        vm.expectRevert(IBoard.CircuitBreakerActive.selector);
        board.exposed_undelegate(1, 50);
    }

    function test_Board_CircuitBreakerActive_Reposition_Reverts() public {
        board.exposed_delegate(1, 100);
        board.lockBoard();

        vm.expectRevert(IBoard.CircuitBreakerActive.selector);
        board.reposition(1);
    }

    // ─── executeSeatsUpdate: supporter no longer in top seats ──────────

    // ─── _remove on non-existent node returns false ────────────────────

    function test_Board_Remove_NonExistent_ReturnsFalse() public {
        // Removing a tokenId that was never inserted → _remove returns false (ignored by public wrapper)
        board.remove(9999); // should not revert, just silently returns false
        assertEq(board.getSize(), 0);
    }

    function test_Board_ExecuteSeatsUpdate_SupporterEvicted_InsufficientVotes() public {
        // Fill board so 3 nodes exist in top 5 seats
        board.insert(1, 300);
        board.insert(2, 200);
        board.insert(3, 100);

        board.setSeats(1, 7);
        board.setSeats(2, 7);
        board.setSeats(3, 7);

        // Now remove node 1 from the board so it's no longer in top seats
        board.remove(1);
        board.remove(2);
        board.remove(3);

        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(IBoard.InsufficientVotes.selector);
        board.executeSeatsUpdate(1);
    }
}
