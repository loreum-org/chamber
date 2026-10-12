// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IBoard} from "src/interfaces/IBoard.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1012-G2: seat updates execute against the proposal-time quorum only
 * @notice Wallet execution requires max(submit quorum, live quorum) (M-04). Seat updates must
 *         too, so a lone early director cannot change seats over a later board majority.
 */
contract FindingR1012SeatUpdateLiveQuorumTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 5, "C", "C", address(0x9));
    }

    function _seat(address user, uint256 tokenId, uint256 amount) internal {
        nft.mintWithTokenId(user, tokenId);
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }

    function test_seatUpdateNeedsLiveQuorum() public {
        _seat(address(0x1), 1, 100 ether);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        assertEq(chamber.getQuorum(), 1);

        vm.prank(address(0x1));
        chamber.updateSeats(1, 1);

        for (uint256 i = 2; i <= 5; i++) {
            _seat(address(uint160(i)), i, 200 ether);
        }
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        assertEq(chamber.getQuorum(), 3);

        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(address(0x1));
        vm.expectRevert(IBoard.InsufficientVotes.selector);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 5);
    }
}
