// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1012-ERC1: wallet transactions can spend third-party approvals given to the chamber
 * @notice Depositors approve the chamber on the asset (often unlimited). A wallet transaction
 *         calling `transferFrom(victim, ...)` would move funds the victim never deposited.
 *         Pull-style calls must name the chamber itself as `from`.
 */
contract FindingR1012ApprovalPullTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public victim = makeAddr("victim");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));
        nft.mintWithTokenId(address(0x1), 1);
        token.mint(address(0x1), 1 ether);
        vm.startPrank(address(0x1));
        token.approve(address(chamber), 1 ether);
        chamber.deposit(1 ether, address(0x1));
        chamber.delegate(1, 1 ether);
        vm.stopPrank();
        vm.roll(block.number + BoardTypes.SEATING_DELAY);

        token.mint(victim, 500 ether);
        vm.prank(victim);
        token.approve(address(chamber), type(uint256).max);
    }

    function test_cannotSubmitTransferFromThirdParty() public {
        bytes memory d = abi.encodeCall(IERC20.transferFrom, (victim, address(0x1), 500 ether));
        vm.prank(address(0x1));
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, address(token), 0, d, "", 0);
    }

    function test_cannotBatchSubmitTransferFromThirdParty() public {
        address[] memory t = new address[](1);
        uint256[] memory v = new uint256[](1);
        bytes[] memory d = new bytes[](1);
        t[0] = address(token);
        d[0] = abi.encodeCall(IERC20.transferFrom, (victim, address(0x1), 500 ether));
        vm.prank(address(0x1));
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitBatchTransactions(1, t, v, d);
    }

    /// Calls to the vault asset are limited to `transfer` / `approve`, so no pull alias reaches it.
    function test_assetOnlyAllowsTransferAndApprove() public {
        bytes memory d = abi.encodeCall(IERC20.transferFrom, (address(chamber), address(0x1), 0));
        vm.prank(address(0x1));
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, address(token), 0, d, "", 0);

        vm.startPrank(address(0x1));
        chamber.submitTransaction(1, address(token), 0, abi.encodeCall(IERC20.transfer, (address(0x1), 0)), "", 0);
        chamber.submitTransaction(1, address(token), 0, abi.encodeCall(IERC20.approve, (address(0x1), 0)), "", 0);
        vm.stopPrank();
    }

    function test_transferFromChamberItselfStillAllowedOnOtherTokens() public {
        MockERC20 other = new MockERC20("O", "O", 0);
        bytes memory d = abi.encodeCall(IERC20.transferFrom, (address(chamber), address(0x1), 0));
        vm.prank(address(0x1));
        chamber.submitTransaction(1, address(other), 0, d, "", 0);
    }
}
