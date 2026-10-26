// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {ChamberReads} from "test/utils/ChamberReads.sol";
import {
    ERC4626Upgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";

/**
 * @title Finding 4: ERC4626 Withdraw Bypasses Delegation Locks [CRITICAL] — FIXED
 * @notice Verifies that the _update() override now blocks withdraw/redeem
 *         when the user has active delegations.
 */
contract DelegationBypassViaWithdrawTest is Test {
    Registry public registry;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public attacker = makeAddr("attacker");
    address public victim = makeAddr("victim");
    address public chamberAddress;
    IChamber public chamber;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamberAddress =
            address(DeployChamber.deployViaFactory(address(token), address(nft), 3, "Chamber Token", "CHMB", admin));
        chamber = IChamber(chamberAddress);

        token.mint(attacker, 1000e18);
        nft.mintWithTokenId(attacker, 1);

        token.mint(victim, 500e18);
        nft.mintWithTokenId(victim, 2);
    }

    /**
     * @notice FIXED: withdraw() now reverts when user has active delegations.
     */
    function test_Fixed_WithdrawBlockedByDelegation() public {
        vm.startPrank(attacker);
        token.approve(chamberAddress, 1000e18);
        chamber.deposit(1000e18, attacker);

        // Delegate all shares
        uint256 shares = chamber.balanceOf(attacker);
        chamber.delegate(1, shares);

        // Withdraw stops at maxWithdraw, which excludes delegated shares (R-1012-L1).
        assertEq(chamber.maxWithdraw(attacker), 0);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626Upgradeable.ERC4626ExceededMaxWithdraw.selector, attacker, 1000e18, 0)
        );
        chamber.withdraw(1000e18, attacker, attacker);
        vm.stopPrank();

        // Delegation and balance are intact
        assertGt(chamber.balanceOf(attacker), 0, "Attacker still has shares");
        assertGt(ChamberReads.holderDelegation(chamber, attacker, 1), 0, "Delegation intact");
    }

    /**
     * @notice FIXED: redeem() now reverts when user has active delegations.
     */
    function test_Fixed_RedeemBlockedByDelegation() public {
        vm.startPrank(attacker);
        token.approve(chamberAddress, 1000e18);
        chamber.deposit(1000e18, attacker);

        uint256 shares = chamber.balanceOf(attacker);
        chamber.delegate(1, shares);

        // Redeem stops at maxRedeem, which excludes delegated shares (R-1012-L1).
        assertEq(chamber.maxRedeem(attacker), 0);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626Upgradeable.ERC4626ExceededMaxRedeem.selector, attacker, shares, 0)
        );
        chamber.redeem(shares, attacker, attacker);
        vm.stopPrank();
    }

    /**
     * @notice Verify that undelegating first allows withdrawal (correct flow).
     */
    function test_Fixed_UndelegateThenWithdrawSucceeds() public {
        vm.startPrank(attacker);
        token.approve(chamberAddress, 1000e18);
        chamber.deposit(1000e18, attacker);

        uint256 shares = chamber.balanceOf(attacker);
        chamber.delegate(1, shares);

        // Undelegate first
        chamber.undelegate(1, shares);

        // Now withdraw succeeds
        chamber.withdraw(1000e18, attacker, attacker);
        vm.stopPrank();

        assertEq(chamber.balanceOf(attacker), 0);
        assertEq(token.balanceOf(attacker), 1000e18);
    }
}
