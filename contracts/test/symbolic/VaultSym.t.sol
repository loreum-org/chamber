// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/// @notice Symbolic verification of Chamber ERC4626 vault invariants via Halmos
/// @dev Avoids convertToAssets / previewRedeem paths that introduce nonlinear division and timeout solvers
contract VaultSymTest is Test, SymTest {
    Chamber internal chamber;
    MockERC20 internal token;
    MockERC721 internal nft;

    address internal constant USER = address(0xBEEF);

    /// @dev Virtual share multiplier from Chamber._decimalsOffset() = 3
    uint256 internal constant SHARE_MULTIPLIER = 1000;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 1_000_000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), 5, "vERC20", "Vault Token", address(0x9));
    }

    /// @dev On an empty vault, previewDeposit scales assets by the decimals offset
    function symbolicPreviewDepositOnEmptyVault() public {
        uint256 amount = svm.createUint(96, "amount");
        vm.assume(amount > 0);

        assertEq(chamber.totalAssets(), 0);
        assertEq(chamber.previewDeposit(amount), amount * SHARE_MULTIPLIER);
    }

    /// @dev On an empty vault, deposit mints shares equal to assets times the decimals offset
    function symbolicEmptyVaultShareMultiplier() public {
        uint256 amount = svm.createUint(96, "amount");
        vm.assume(amount > 0);

        token.mint(USER, amount);
        vm.startPrank(USER);
        token.approve(address(chamber), amount);
        uint256 shares = chamber.deposit(amount, USER);
        vm.stopPrank();

        assertEq(shares, amount * SHARE_MULTIPLIER);
        assertEq(chamber.totalAssets(), amount);
        assertEq(chamber.balanceOf(USER), shares);
        assertEq(IERC20(address(token)).balanceOf(address(chamber)), amount);
    }
}
