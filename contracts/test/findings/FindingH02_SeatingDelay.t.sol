// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title H-02: Live board ranking has no seating delay
 * @notice A tokenId that newly enters the top-`seats` set cannot confirm or execute
 *         until `SEATING_DELAY` (1 block) elapses. Already-seated directors keep rights.
 */
contract FindingH02SeatingDelayTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    uint256 public constant SEATS = 3;
    uint256 public constant SEATING_DELAY = 1;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), SEATS, "vERC20", "VLT", address(0x9));

        _seat(user1, 1, 100 ether);
        _seat(user2, 2, 100 ether);
        vm.roll(block.number + SEATING_DELAY);
    }

    function test_H02_NewDirectorCannotConfirmUntilDelay() public {
        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");

        _seat(user3, 3, 50 ether);

        assertEq(chamber.getSeatedAt(3), block.number, "new top-seat token records this block");
        assertTrue(_isLiveDirector(3), "live ranking includes the new token immediately");

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.confirmTransaction(3, 0);

        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        assertTrue(chamber.getConfirmation(2, 0), "existing seated director can still confirm");
    }

    function test_H02_NewDirectorCannotExecuteUntilDelay() public {
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 1 ether, "");
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);

        _seat(user3, 3, 50 ether);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.executeTransaction(3, 0, "");

        vm.prank(user1);
        chamber.executeTransaction(1, 0, "");
        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed, "existing seated director can still execute");
    }

    function test_H02_NewDirectorCannotSubmitUntilDelay() public {
        _seat(user3, 3, 50 ether);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.submitTransaction(3, address(0x3), 0, "");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1, "existing seated director can still submit");
    }

    function test_H02_NewDirectorCanActAfterDelay() public {
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 1 ether, "");

        _seat(user3, 3, 50 ether);
        vm.roll(block.number + SEATING_DELAY);

        vm.prank(user3);
        chamber.confirmTransaction(3, 0);
        assertTrue(chamber.getConfirmation(3, 0));

        vm.prank(user3);
        chamber.executeTransaction(3, 0, "");
        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
    }

    function test_H02_ExistingDirectorUnaffectedByLaterSeating() public {
        uint256 seatedAtBefore = chamber.getSeatedAt(1);

        _seat(user3, 3, 50 ether);

        assertEq(chamber.getSeatedAt(1), seatedAtBefore, "incumbent seating checkpoint is unchanged");
        assertTrue(block.number >= seatedAtBefore + SEATING_DELAY);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);

        assertTrue(chamber.getConfirmation(1, 0));
        assertTrue(chamber.getConfirmation(2, 0));
    }

    function test_H02_ReseatedTokenMustWaitAgain() public {
        _seat(user3, 3, 50 ether);
        vm.roll(block.number + SEATING_DELAY);

        vm.prank(user3);
        chamber.undelegate(3, 50 ether);
        assertEq(chamber.getSeatedAt(3), 0);

        vm.prank(user3);
        chamber.delegate(3, 50 ether);
        assertEq(chamber.getSeatedAt(3), block.number);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.submitTransaction(3, address(0x3), 0, "");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1);
    }

    function _seat(address user, uint256 tokenId, uint256 amount) internal {
        try nft.ownerOf(tokenId) returns (address owner) {
            if (owner != user) revert("token already minted to another owner");
        } catch {
            nft.mintWithTokenId(user, tokenId);
        }

        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }

    function _isLiveDirector(uint256 tokenId) internal view returns (bool) {
        (uint256[] memory topIds,) = chamber.getTop(SEATS);
        for (uint256 i = 0; i < topIds.length; i++) {
            if (topIds[i] == tokenId) return true;
        }
        return false;
    }
}
