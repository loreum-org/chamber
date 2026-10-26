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
 * @title R-1012-M5: seat-update support is not bound to the NFT controller
 * @notice `supporters` stored bare token ids, so a sale or rental kept a counted vote and nobody
 *         could withdraw it. Wallet votes already record the controller (PMN-H01).
 */
contract FindingR1012SeatSupportControllerTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public seller = makeAddr("seller");
    address public buyer = makeAddr("buyer");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));
        _seat(seller, 1, 10 ether);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
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

    function test_soldSeatDoesNotCountTowardSeatUpdate() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);

        vm.prank(seller);
        nft.transferFrom(seller, buyer, 1);
        chamber.syncSeating(1);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);

        vm.prank(buyer);
        vm.expectRevert(IBoard.InsufficientVotes.selector);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 1, "sold support still executed the seat change");
    }

    function test_ownerCanWithdrawSupport() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.prank(seller);
        chamber.withdrawSeatSupport(1);

        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        vm.expectRevert(IBoard.InsufficientVotes.selector);
        chamber.executeSeatsUpdate(1);

        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2);
    }

    function test_newOwnerCanClearStaleSupportAndEndorse() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.prank(seller);
        nft.transferFrom(seller, buyer, 1);
        chamber.syncSeating(1);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);

        vm.prank(buyer);
        chamber.withdrawSeatSupport(1);
        vm.prank(buyer);
        chamber.updateSeats(1, 2);

        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(buyer);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2);
    }

    function test_executeAfterWithdrawDoesNotApply() public {
        address other = makeAddr("other");
        _seat(other, 2, 10 ether);

        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);

        vm.prank(seller);
        chamber.updateSeats(1, 3);
        vm.prank(other);
        chamber.updateSeats(2, 3);
        vm.prank(other);
        chamber.withdrawSeatSupport(2);

        (, uint256 proposedAt,, uint256[] memory remaining) = chamber.getSeatUpdate();
        assertEq(remaining.length, 1, "withdraw did not drop the supporter");
        vm.warp(proposedAt + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        vm.expectRevert(IBoard.InsufficientVotes.selector);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2, "a withdrawn endorsement still counted");
    }

    function test_legacyZeroSnapStillCountsAfterSale() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);

        bytes32 base = BoardTypes.STORAGE_SLOT;
        bytes32 proposerSlot = bytes32(uint256(base) + 13);
        assertEq(uint256(vm.load(address(chamber), proposerSlot)), 1, "proposer slot");
        bytes32 supporterSlot = keccak256(abi.encode(uint256(1), uint256(base) + 14));
        assertEq(address(uint160(uint256(vm.load(address(chamber), supporterSlot)))), seller, "supporter slot");

        vm.store(address(chamber), proposerSlot, bytes32(0));
        vm.store(address(chamber), supporterSlot, bytes32(0));

        vm.prank(seller);
        nft.transferFrom(seller, buyer, 1);
        chamber.syncSeating(1);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);

        vm.prank(buyer);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2, "a pre-upgrade proposal with an empty snap stopped counting");
    }

    function test_proposerCancelsAfterWithdrawing() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.prank(seller);
        chamber.withdrawSeatSupport(1);
        vm.prank(seller);
        chamber.cancelSeatUpdate(1);

        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        vm.expectRevert(IBoard.InvalidProposal.selector);
        chamber.executeSeatsUpdate(1);
    }

    function test_reendorseAfterProposalDeleted() public {
        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.prank(seller);
        chamber.cancelSeatUpdate(1);

        vm.prank(seller);
        chamber.updateSeats(1, 2);
        vm.warp(block.timestamp + BoardTypes.SEAT_UPDATE_TIMELOCK);
        vm.prank(seller);
        chamber.executeSeatsUpdate(1);
        assertEq(chamber.getSeats(), 2);
    }
}
