// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {MockBoard} from "test/mock/MockBoard.sol";

/// @notice Symbolic verification of Board linked-list invariants via Halmos
contract BoardSymTest is Test, SymTest {
    MockBoard internal board;

    function setUp() public {
        board = new MockBoard();
    }

    /// @dev After two inserts, the board remains sorted in descending order by amount
    function symbolicSortedOrderAfterTwoInserts() public {
        uint256 tokenId1 = svm.createUint(128, "tokenId1");
        uint256 tokenId2 = svm.createUint(128, "tokenId2");
        vm.assume(tokenId1 > 0 && tokenId2 > 0 && tokenId1 != tokenId2);

        uint256 amount1 = svm.createUint256("amount1");
        uint256 amount2 = svm.createUint256("amount2");
        vm.assume(amount1 > 0 && amount2 > 0);

        board.insert(tokenId1, amount1);
        board.insert(tokenId2, amount2);

        _assertSortedDescending(2);
    }

    /// @dev Delegate then undelegate preserves the node's remaining delegation amount
    function symbolicDelegateUndelegateConservation() public {
        uint256 tokenId = svm.createUint(128, "tokenId");
        vm.assume(tokenId > 0);

        uint256 initial = svm.createUint256("initial");
        uint256 extra = svm.createUint256("extra");
        uint256 undelegate = svm.createUint256("undelegate");
        vm.assume(initial > 0 && extra > 0);
        vm.assume(initial <= type(uint256).max - extra);

        uint256 total = initial + extra;
        vm.assume(undelegate > 0 && undelegate <= total);

        board.exposed_delegate(tokenId, initial);
        board.exposed_delegate(tokenId, extra);
        board.exposed_undelegate(tokenId, undelegate);

        MockBoard.Node memory node = board.getNode(tokenId);
        assertEq(node.amount, total - undelegate);
        _assertSortedDescending(board.getSize());
    }

    /// @dev Reentrancy guard blocks a second delegate while the circuit breaker is held
    function symbolicCircuitBreakerBlocksReentrantDelegate() public {
        uint256 tokenId = svm.createUint(128, "tokenId");
        uint256 amount = svm.createUint256("amount");
        vm.assume(tokenId > 0 && amount > 0);

        (bool success,) = address(board).call(abi.encodeCall(MockBoard.lockAndDelegate, (tokenId, amount)));
        assertFalse(success);
    }

    function _assertSortedDescending(uint256 count) internal view {
        if (count < 2) return;

        (uint256[] memory topIds, uint256[] memory topAmounts) = board.getTop(count);
        assertEq(topIds.length, count);
        assertEq(topAmounts.length, count);

        for (uint256 i = 1; i < topAmounts.length; ++i) {
            assertGe(topAmounts[i - 1], topAmounts[i]);
        }
    }
}
