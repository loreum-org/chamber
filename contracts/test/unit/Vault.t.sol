// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @notice Vault tests updated for _decimalsOffset() = 3
 *         With offset=3, shares = assets * 1000 (virtual shares ratio)
 */
contract ChamberVaultTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;
    uint256 public seats;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    /// @dev Virtual share multiplier from _decimalsOffset() = 3
    uint256 constant SHARE_MULTIPLIER = 1000;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        string memory name = "vERC20";
        string memory symbol = "Vault Token";

        address admin = address(0x9);
        seats = 5;
        chamber = DeployChamber.deploy(address(token), address(nft), seats, name, symbol, admin);
    }

    function test_Vault_Asset() public view {
        address asset = chamber.asset();
        assertEq(asset, address(token));
    }

    function test_Vault_TotalAssets() public {
        // Mint tokens to the vault
        deal(address(token), address(chamber), 100e18);
        assertEq(chamber.totalAssets(), 100e18);
    }

    function test_Vault_ConvertToShares() public {
        // With offset=3, empty vault: shares = assets * 1000
        assertEq(chamber.convertToShares(100e18), 100e18 * SHARE_MULTIPLIER);

        // Deposit to establish ratio
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.deposit(100e18, user1);
        vm.stopPrank();

        // After deposit, ratio is approximately 1:1000
        uint256 shares = chamber.convertToShares(50e18);
        // shares ≈ 50e18 * (100e21 + 1000) / (100e18 + 1) ≈ 50e21
        assertApproxEqRel(shares, 50e18 * SHARE_MULTIPLIER, 1e14); // 0.01% tolerance
    }

    function test_Vault_ConvertToAssets() public {
        // With offset=3, empty vault: assets = shares / 1000
        assertEq(chamber.convertToAssets(100e18), 100e18 / SHARE_MULTIPLIER);

        // Deposit to establish ratio
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.deposit(100e18, user1);
        vm.stopPrank();

        // After deposit, ratio is approximately 1:1000
        uint256 assets = chamber.convertToAssets(50e18 * SHARE_MULTIPLIER);
        assertApproxEqRel(assets, 50e18, 1e14); // 0.01% tolerance
    }

    function test_Vault_MaxDeposit() public view {
        assertEq(chamber.maxDeposit(user1), type(uint256).max);
    }

    function test_Vault_PreviewDeposit() public view {
        // With offset=3: shares = assets * 1000
        assertEq(chamber.previewDeposit(100e18), 100e18 * SHARE_MULTIPLIER);
    }

    function test_Vault_MaxMint() public view {
        assertEq(chamber.maxMint(user1), type(uint256).max);
    }

    function test_Vault_PreviewMint() public view {
        // With offset=3: assets = ceil(shares / 1000)
        // previewMint(100e18 shares) = ceil(100e18 / 1000) = 1e17
        assertEq(chamber.previewMint(100e18), 100e18 / SHARE_MULTIPLIER);
    }

    function test_Vault_MaxWithdraw() public {
        // User should be able to withdraw 0 when they have no shares
        assertEq(chamber.maxWithdraw(user1), 0);

        // Deposit assets
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.deposit(100e18, user1);
        vm.stopPrank();

        // Should be able to withdraw approximately full amount
        uint256 maxWith = chamber.maxWithdraw(user1);
        assertApproxEqAbs(maxWith, 100e18, 1); // Within 1 wei due to rounding
    }

    function test_Vault_PreviewWithdraw() public view {
        // With offset=3: shares = assets * 1000
        assertEq(chamber.previewWithdraw(100e18), 100e18 * SHARE_MULTIPLIER);
    }

    function test_Vault_MaxRedeem() public {
        // User should be able to redeem 0 when they have no shares
        assertEq(chamber.maxRedeem(user1), 0);

        // Deposit assets
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.deposit(100e18, user1);
        vm.stopPrank();

        // Should be able to redeem full share amount
        uint256 expectedShares = 100e18 * SHARE_MULTIPLIER;
        assertEq(chamber.maxRedeem(user1), expectedShares);
    }

    function test_Vault_Vault_PreviewRedeem() public view {
        // With offset=3: assets = shares / 1000
        assertEq(chamber.previewRedeem(100e18), 100e18 / SHARE_MULTIPLIER);
    }

    function test_Vault_Deposit() public {
        uint256 depositAmount = 100e18;

        // Mint tokens to user
        deal(address(token), user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);

        // With offset=3, shares received = depositAmount * 1000
        uint256 expectedShares = depositAmount * SHARE_MULTIPLIER;
        uint256 sharesReceived = chamber.deposit(depositAmount, user1);
        assertEq(sharesReceived, expectedShares);

        // Check balances
        assertEq(chamber.balanceOf(user1), expectedShares);
        assertEq(chamber.totalAssets(), depositAmount);
        assertEq(token.balanceOf(address(chamber)), depositAmount);
        assertEq(token.balanceOf(user1), 0);
        vm.stopPrank();
    }

    function test_Vault_Mint() public {
        // Minting 100e18 shares costs 100e18/1000 = 1e17 assets
        uint256 mintShares = 100e18 * SHARE_MULTIPLIER; // Mint 100e21 shares = 100e18 assets
        uint256 expectedAssets = 100e18;

        // Mint tokens to user (enough to cover)
        deal(address(token), user1, expectedAssets);

        vm.startPrank(user1);
        token.approve(address(chamber), expectedAssets);

        uint256 assetsDeposited = chamber.mint(mintShares, user1);
        assertEq(assetsDeposited, expectedAssets);

        // Check balances
        assertEq(chamber.balanceOf(user1), mintShares);
        assertEq(chamber.totalAssets(), expectedAssets);
        assertEq(token.balanceOf(address(chamber)), expectedAssets);
        assertEq(token.balanceOf(user1), 0);
        vm.stopPrank();
    }

    function test_Vault_Withdraw() public {
        uint256 depositAmount = 100e18;

        // Setup: deposit assets first
        deal(address(token), user1, depositAmount);
        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);
        vm.stopPrank();

        uint256 expectedShares = depositAmount * SHARE_MULTIPLIER;

        vm.prank(user1);
        uint256 sharesRedeemed = chamber.withdraw(depositAmount, user1, user1);

        // Check return value and balances
        assertEq(sharesRedeemed, expectedShares);
        assertEq(chamber.balanceOf(user1), 0);
        assertEq(chamber.totalAssets(), 0);
        assertEq(token.balanceOf(address(chamber)), 0);
        assertEq(token.balanceOf(user1), depositAmount);
    }

    function test_Vault_Redeem() public {
        uint256 depositAmount = 100e18;

        // Setup: deposit assets first
        deal(address(token), user1, depositAmount);
        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);
        chamber.deposit(depositAmount, user1);
        vm.stopPrank();

        uint256 sharesToRedeem = depositAmount * SHARE_MULTIPLIER;

        vm.prank(user1);
        uint256 assetsReceived = chamber.redeem(sharesToRedeem, user1, user1);

        // Check return value and balances
        assertEq(assetsReceived, depositAmount);
        assertEq(chamber.balanceOf(user1), 0);
        assertEq(chamber.totalAssets(), 0);
        assertEq(token.balanceOf(address(chamber)), 0);
        assertEq(token.balanceOf(user1), depositAmount);
    }
}
