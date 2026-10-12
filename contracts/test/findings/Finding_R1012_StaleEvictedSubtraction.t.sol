// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title R-1012-DOS1: delegations stranded by eviction are later subtracted from a re-inserted node
 * @notice After a token is evicted, its holders keep `holderDelegation`. If the token is
 *         re-inserted by someone else, undelegating the stranded amount must not reduce the
 *         new node, which only holds weight delegated after re-insertion.
 */
contract FindingR1012StaleEvictedSubtractionTest is Test {
    MockERC20 public token;
    MockERC721 public nft;
    IChamber public chamber;

    address public attacker = makeAddr("attacker");
    address public victim = makeAddr("victim");
    address public filler = makeAddr("filler");

    uint256 internal constant T = 55;
    uint256 internal constant Y = 200;

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = IChamber(
            address(DeployChamber.deployViaFactory(address(token), address(nft), 5, "C", "C", makeAddr("admin")))
        );

        nft.mintWithTokenId(victim, T);
        nft.mintWithTokenId(attacker, Y);
        for (uint256 i = 1; i <= 49; i++) {
            nft.mintWithTokenId(filler, i);
        }
        _fund(attacker, 1000e18);
        _fund(victim, 1000e18);
        _fund(filler, 100_000e18);

        vm.startPrank(filler);
        for (uint256 i = 1; i <= 49; i++) {
            chamber.delegate(i, 52);
        }
        vm.stopPrank();
    }

    function _fund(address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.startPrank(who);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, who);
        vm.stopPrank();
    }

    /// Strand 50 on T by delegating, getting evicted, and freeing the evicting slot.
    function _strandOnT() internal {
        vm.startPrank(attacker);
        chamber.delegate(T, 50); // tail, board full
        chamber.delegate(Y, 51); // evicts T
        chamber.undelegate(Y, 51); // board back to 49
        vm.stopPrank();
        (uint256 id,,,) = chamber.getMember(T);
        assertEq(id, 0, "T evicted");
        assertEq(chamber.getHolderDelegation(attacker, T), 50, "stranded delegation kept");
    }

    function test_strandedUndelegateDoesNotReduceNewNode() public {
        _strandOnT();

        vm.prank(victim);
        chamber.delegate(T, 1000);

        vm.prank(attacker);
        chamber.undelegate(T, 50);

        (, uint256 amount,,) = chamber.getMember(T);
        assertEq(amount, 1000, "victim's node weight must be untouched");
        assertEq(chamber.getHolderDelegation(attacker, T), 0);
    }

    function test_victimCanFullyUndelegateAndRedeem() public {
        _strandOnT();

        vm.prank(victim);
        chamber.delegate(T, 1000);
        vm.prank(attacker);
        chamber.undelegate(T, 50);

        vm.startPrank(victim);
        chamber.undelegate(T, 1000);
        chamber.redeem(chamber.balanceOf(victim), victim, victim);
        vm.stopPrank();
        (uint256 id,,,) = chamber.getMember(T);
        assertEq(id, 0, "node removed once the live weight is gone");
    }

    /// Stranded weight re-delegated after eviction counts from that point on.
    function test_holderRedelegatingAfterEvictionKeepsBothParts() public {
        _strandOnT();

        vm.prank(attacker);
        chamber.delegate(T, 10); // re-inserts T with only the new 10
        (, uint256 amount,,) = chamber.getMember(T);
        assertEq(amount, 10);
        assertEq(chamber.getHolderDelegation(attacker, T), 60);

        vm.prank(attacker);
        chamber.undelegate(T, 60);
        (uint256 id,,,) = chamber.getMember(T);
        assertEq(id, 0);
        assertEq(chamber.getHolderDelegation(attacker, T), 0);
    }
}
