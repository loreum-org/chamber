// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1012-G1: chamber-held membership NFTs as seat sinks
 * @notice Chamber-held tokenIds are excluded from the reachable-director count (PMN-M01) but
 *         still occupy rank. Pushing them into the top seats with same-block capital removes
 *         honest directors and lowers the live quorum, so one incumbent can act alone.
 *         Chamber-held tokenIds must not displace directors.
 */
contract FindingR1012ChamberHeldSeatSinkTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public attacker = makeAddr("attacker");
    address public h2 = makeAddr("h2");
    address public h3 = makeAddr("h3");
    address public depositor = makeAddr("depositor");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 3, "C", "C", address(0x9));

        _seat(attacker, 1, 100 ether);
        _seat(h2, 2, 100 ether);
        _seat(h3, 3, 100 ether);
        token.mint(depositor, 1000 ether);
        vm.startPrank(depositor);
        token.approve(address(chamber), 1000 ether);
        chamber.deposit(1000 ether, depositor);
        vm.stopPrank();
        vm.roll(block.number + BoardTypes.SEATING_DELAY);

        // Chamber-held memberships: a treasury reserve, or NFTs anyone sent in.
        nft.mintWithTokenId(address(chamber), 10);
        nft.mintWithTokenId(address(chamber), 11);
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

    /// Same-transaction capital (a flash loan) must not let one incumbent drain the vault by
    /// pushing tokens it then hands to the chamber over the honest directors.
    function test_incumbentCannotDrainViaChamberHeldSeats() public {
        assertEq(chamber.getQuorum(), 2);
        nft.mintWithTokenId(attacker, 20);
        nft.mintWithTokenId(attacker, 21);

        token.mint(attacker, 1000 ether); // stands in for a flash loan
        vm.startPrank(attacker);
        token.approve(address(chamber), type(uint256).max);
        chamber.deposit(1000 ether, attacker);
        uint256 s = chamber.balanceOf(attacker) - chamber.getTotalHolderDelegations(attacker);
        chamber.delegate(20, s / 3);
        chamber.delegate(21, s / 3);
        chamber.delegate(1, s / 3);
        nft.transferFrom(attacker, address(chamber), 20);
        nft.transferFrom(attacker, address(chamber), 21);
        vm.stopPrank();

        assertGe(chamber.getQuorum(), 2, "quorum must not drop below the honest board's");

        bytes memory d = abi.encodeCall(IERC20.transfer, (attacker, token.balanceOf(address(chamber))));
        vm.startPrank(attacker);
        chamber.submitTransaction(1, address(token), 0, d);
        vm.expectRevert(IChamber.NotEnoughConfirmations.selector);
        chamber.executeTransaction(1, 0, d);
        vm.stopPrank();
    }

    /// Weight cannot be delegated to a chamber-held token.
    function test_cannotDelegateToChamberHeldToken() public {
        vm.prank(h2);
        vm.expectRevert(IChamber.InvalidTokenId.selector);
        chamber.delegate(10, 1);
    }

    /// A chamber-held node can be dropped by anyone, restoring the honest directors.
    function test_cleanupDropsChamberHeldNode() public {
        nft.mintWithTokenId(attacker, 20);
        token.mint(attacker, 1000 ether);
        vm.startPrank(attacker);
        token.approve(address(chamber), type(uint256).max);
        chamber.deposit(1000 ether, attacker);
        chamber.delegate(20, 500 ether);
        nft.transferFrom(attacker, address(chamber), 20);
        vm.stopPrank();

        chamber.cleanupInertSeat(20);
        (uint256 id,,,) = chamber.getMember(20);
        assertEq(id, 0);
        (uint256[] memory top,) = chamber.getTop(3);
        assertEq(top.length, 3);
        for (uint256 i; i < top.length; i++) {
            assertTrue(top[i] != 20);
        }

        vm.prank(attacker);
        chamber.undelegate(20, 500 ether); // stranded weight is still withdrawable
        assertEq(chamber.getHolderDelegation(attacker, 20), 0);
    }
}
