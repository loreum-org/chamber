// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {Board} from "src/Board.sol";
import {Wallet} from "src/Wallet.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

contract ChamberVaultTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;
    uint256 public seats;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

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
        // Test 1:1 conversion when totalSupply is 0
        assertEq(chamber.convertToShares(100e18), 100e18);

        // Give user some shares
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.mint(100e18, user1);
        vm.stopPrank();

        // Should still be 1:1 in this case
        assertEq(chamber.convertToShares(50e18), 50e18);
    }

    function test_Vault_ConvertToAssets() public {
        // Test 1:1 conversion when totalSupply is 0
        assertEq(chamber.convertToAssets(100e18), 100e18);

        // Give user some shares
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.mint(100e18, user1);
        vm.stopPrank();

        // Should still be 1:1 in this case
        assertEq(chamber.convertToAssets(50e18), 50e18);
    }

    function test_Vault_MaxDeposit() public view {
        assertEq(chamber.maxDeposit(user1), type(uint256).max);
    }

    function test_Vault_PreviewDeposit() public view {
        // Should return same amount of shares as assets when ratio is 1:1
        assertEq(chamber.previewDeposit(100e18), 100e18);
    }

    function test_Vault_MaxMint() public view {
        assertEq(chamber.maxMint(user1), type(uint256).max);
    }

    function test_Vault_PreviewMint() public view {
        // Should return same amount of assets as shares when ratio is 1:1
        assertEq(chamber.previewMint(100e18), 100e18);
    }

    function test_Vault_MaxWithdraw() public {
        // User should be able to withdraw 0 when they have no shares
        assertEq(chamber.maxWithdraw(user1), 0);

        // Give user some shares
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.mint(100e18, user1);
        vm.stopPrank();
        // Should be able to withdraw full amount
        assertEq(chamber.maxWithdraw(user1), 100e18);
    }

    function test_Vault_PreviewWithdraw() public view {
        // Should return same amount of shares as assets when ratio is 1:1
        assertEq(chamber.previewWithdraw(100e18), 100e18);
    }

    function test_Vault_MaxRedeem() public {
        // User should be able to redeem 0 when they have no shares
        assertEq(chamber.maxRedeem(user1), 0);

        // Give user some shares
        deal(address(token), user1, 100e18);
        vm.startPrank(user1);
        token.approve(address(chamber), 100e18);
        chamber.mint(100e18, user1);
        vm.stopPrank();

        // Should be able to redeem full amount
        assertEq(chamber.maxRedeem(user1), 100e18);
    }

    function test_Vault_Vault_PreviewRedeem() public view {
        // Should return same amount of assets as shares when ratio is 1:1
        assertEq(chamber.previewRedeem(100e18), 100e18);
    }

    function test_Vault_Deposit() public {
        uint256 depositAmount = 100e18;

        // Mint tokens to user
        deal(address(token), user1, depositAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), depositAmount);

        // Check return value
        uint256 sharesReceived = chamber.deposit(depositAmount, user1);
        assertEq(sharesReceived, depositAmount);

        // Check balances
        assertEq(chamber.balanceOf(user1), depositAmount);
        assertEq(chamber.totalAssets(), depositAmount);
        assertEq(token.balanceOf(address(chamber)), depositAmount);
        assertEq(token.balanceOf(user1), 0);
        vm.stopPrank();
    }

    function test_Vault_Mint() public {
        uint256 mintAmount = 100e18;

        // Mint tokens to user
        deal(address(token), user1, mintAmount);

        vm.startPrank(user1);
        token.approve(address(chamber), mintAmount);

        // Check return value
        uint256 assetsDeposited = chamber.mint(mintAmount, user1);
        assertEq(assetsDeposited, mintAmount);

        // Check balances
        assertEq(chamber.balanceOf(user1), mintAmount);
        assertEq(chamber.totalAssets(), mintAmount);
        assertEq(token.balanceOf(address(chamber)), mintAmount);
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

        vm.prank(user1);
        uint256 sharesRedeemed = chamber.withdraw(depositAmount, user1, user1);

        // Check return value and balances
        assertEq(sharesRedeemed, depositAmount);
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

        vm.prank(user1);
        uint256 assetsReceived = chamber.redeem(depositAmount, user1, user1);

        // Check return value and balances
        assertEq(assetsReceived, depositAmount);
        assertEq(chamber.balanceOf(user1), 0);
        assertEq(chamber.totalAssets(), 0);
        assertEq(token.balanceOf(address(chamber)), 0);
        assertEq(token.balanceOf(user1), depositAmount);
    }
}
