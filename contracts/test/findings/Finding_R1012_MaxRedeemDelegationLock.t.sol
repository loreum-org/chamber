// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title R-1012-L1: maxWithdraw / maxRedeem ignored the delegation lock
 * @notice ERC-4626 requires redeem(maxRedeem(owner)) to succeed. Delegated shares are locked
 *         in `_update`, so the max functions must stop at `balance - totalHolderDelegations`.
 */
contract FindingR1012MaxRedeemDelegationLockTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public holder = makeAddr("holder");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));
    }

    function test_maxRedeemAndWithdrawStopAtDelegationLock() public {
        uint256 assets = 100 ether;
        nft.mintWithTokenId(holder, 1);
        token.mint(holder, assets);
        vm.startPrank(holder);
        token.approve(address(chamber), assets);
        chamber.deposit(assets, holder);

        uint256 shares = chamber.balanceOf(holder);
        uint256 locked = shares / 2;
        chamber.delegate(1, locked);

        uint256 maxShares = chamber.maxRedeem(holder);
        uint256 maxAssets = chamber.maxWithdraw(holder);
        assertEq(maxShares, shares - locked, "maxRedeem includes delegated shares");
        assertEq(maxAssets, chamber.previewRedeem(maxShares), "maxWithdraw is not the redeemable asset value");

        uint256 redeemed = chamber.redeem(maxShares, holder, holder);
        assertEq(redeemed, maxAssets);
        assertEq(chamber.balanceOf(holder), locked);
        assertEq(chamber.maxRedeem(holder), 0);
        vm.stopPrank();
    }

    function test_maxRedeemIsFullBalanceWithoutDelegation() public {
        uint256 assets = 10 ether;
        token.mint(holder, assets);
        vm.startPrank(holder);
        token.approve(address(chamber), assets);
        chamber.deposit(assets, holder);
        vm.stopPrank();

        assertEq(chamber.maxRedeem(holder), chamber.balanceOf(holder));
        assertEq(chamber.maxWithdraw(holder), chamber.previewRedeem(chamber.balanceOf(holder)));
    }
}
