// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1110-C1: one-block board takeover drains every depositor
 * @notice Mainnet shape: 5 seats (quorum 3), five honest directors, and depositors who hold
 *         shares without delegating. An attacker borrows asset for a short time, mints three
 *         open-mint membership NFTs, deposits and delegates enough to take three of the five
 *         seats. Without a meaningful seating delay or an execution delay, the attacker can submit,
 *         confirm and execute `asset.transfer(attacker, all)` before anyone can react, then repay
 *         the loan from the stolen balance.
 *
 *         The test asserts the safe behaviour: the board must not be able to move the vault
 *         asset within one block of new seats appearing, and the depositors' assets must still be
 *         in the vault.
 */
contract FindingR1110OneBlockTakeoverTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public attacker = makeAddr("attacker");
    address public depositor = makeAddr("depositor");

    uint256 internal constant DIRECTOR_WEIGHT = 100_000 ether;
    uint256 internal constant DEPOSITS = 5_000_000 ether;

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new MockERC20("LORE", "LORE", 0);
        nft = new MockERC721("Explorers", "LOREUM");
        chamber = DeployChamber.deployViaFactory(address(token), address(nft), 5, "cLORE", "cLORE", address(0x9));

        for (uint256 i = 1; i <= 5; i++) {
            _seat(makeAddr(string(abi.encodePacked("director", vm.toString(i)))), i, DIRECTOR_WEIGHT);
        }
        token.mint(depositor, DEPOSITS);
        vm.startPrank(depositor);
        token.approve(address(chamber), DEPOSITS);
        chamber.deposit(DEPOSITS, depositor);
        vm.stopPrank();

        // Let the honest board season well past any delay.
        vm.roll(block.number + 100_000);
        vm.warp(block.timestamp + 30 days);
    }

    function _seat(address user, uint256 tokenId, uint256 amount) internal {
        nft.mintWithTokenId(user, tokenId);
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, chamber.balanceOf(user));
        vm.stopPrank();
    }

    function test_borrowedCapitalCannotDrainVaultWithinOneBlock() public {
        assertEq(chamber.getQuorum(), 3);
        uint256 vaultBefore = token.balanceOf(address(chamber));

        // Block N: borrow, mint three NFTs (open mint), deposit, delegate.
        uint256 loan = 3 * DIRECTOR_WEIGHT + 3 ether;
        token.mint(attacker, loan); // stands in for a one-block loan
        nft.mintWithTokenId(attacker, 101);
        nft.mintWithTokenId(attacker, 102);
        nft.mintWithTokenId(attacker, 103);
        vm.startPrank(attacker);
        token.approve(address(chamber), loan);
        chamber.deposit(loan, attacker);
        uint256 each = chamber.balanceOf(attacker) / 3;
        chamber.delegate(101, each);
        chamber.delegate(102, each);
        chamber.delegate(103, each);
        vm.stopPrank();

        // Block N+1, 12 seconds later.
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 12);

        bytes memory drain = abi.encodeWithSelector(token.transfer.selector, attacker, vaultBefore + loan);
        vm.startPrank(attacker);
        bool drained;
        try chamber.submitTransaction(101, address(token), 0, drain, "", 0) {
            uint256 nonce = chamber.getTransactionCount() - 1;
            chamber.confirmTransaction(102, nonce);
            chamber.confirmTransaction(103, nonce);
            try chamber.executeTransaction(101, nonce, drain) {
                drained = true;
            } catch {}
        } catch {}
        vm.stopPrank();

        assertFalse(drained, "attacker drained the vault one block after seating");
        assertEq(token.balanceOf(address(chamber)), vaultBefore + loan, "depositor assets left the vault");
    }

    /// Holders have the whole seating delay to answer. Out-delegating the attacker's seats
    /// before they mature leaves the attacker with no director rights.
    function test_holdersCanOutDelegateDuringSeatingDelay() public {
        _stageAttacker();
        assertGt(chamber.getSeatedAt(101), block.timestamp, "attacker seat must not be live yet");

        // The depositor backs the five honest directors, which pushes all three attacker ids out.
        vm.startPrank(depositor);
        uint256 shares = chamber.balanceOf(depositor);
        for (uint256 i = 1; i <= 5; i++) {
            chamber.delegate(i, shares / 5);
        }
        vm.stopPrank();

        vm.roll(block.number + 1);
        vm.warp(block.timestamp + BoardTypes.SEATING_DELAY);
        vm.prank(attacker);
        vm.expectRevert();
        chamber.submitTransaction(101, address(token), 0, abi.encodeWithSelector(token.transfer.selector, attacker, 1), "", 0);
    }

    /// A flash bump (out and back in within one block) must not restart an honest director's clock,
    /// or anyone could freeze the board for the cost of gas.
    function test_flashBumpDoesNotResetDirectorClock() public {
        uint256 before = chamber.getSeatedAt(5);
        _bumpDirector5();
        uint256 delegated = chamber.balanceOf(attacker);
        vm.prank(attacker);
        chamber.undelegate(101, delegated);
        assertEq(chamber.getSeatedAt(5), before, "same-block bump reset the clock");

        vm.prank(makeAddr("director5"));
        chamber.submitTransaction(5, address(token), 0, abi.encodeWithSelector(token.transfer.selector, attacker, 1), "", 0);
    }

    /// A seat that is out across a block boundary does restart its clock when it returns.
    function test_seatOutAcrossBlocksRestartsClock() public {
        _bumpDirector5();
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 12);
        uint256 delegated = chamber.balanceOf(attacker);
        vm.prank(attacker);
        chamber.undelegate(101, delegated);
        assertEq(chamber.getSeatedAt(5), block.timestamp + BoardTypes.SEATING_DELAY);
    }

    function _bumpDirector5() internal {
        uint256 amount = DIRECTOR_WEIGHT * 1000 + 1 ether;
        token.mint(attacker, amount);
        nft.mintWithTokenId(attacker, 101);
        vm.startPrank(attacker);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, attacker);
        chamber.delegate(101, chamber.balanceOf(attacker));
        vm.stopPrank();
        (uint256[] memory top,) = chamber.getTop(5);
        for (uint256 i; i < top.length; i++) {
            assertTrue(top[i] != 5, "director 5 should be bumped");
        }
    }

    function _stageAttacker() internal {
        uint256 loan = 3 * DIRECTOR_WEIGHT + 3 ether;
        token.mint(attacker, loan);
        nft.mintWithTokenId(attacker, 101);
        nft.mintWithTokenId(attacker, 102);
        nft.mintWithTokenId(attacker, 103);
        vm.startPrank(attacker);
        token.approve(address(chamber), loan);
        chamber.deposit(loan, attacker);
        uint256 each = chamber.balanceOf(attacker) / 3;
        chamber.delegate(101, each);
        chamber.delegate(102, each);
        chamber.delegate(103, each);
        vm.stopPrank();
    }
}
