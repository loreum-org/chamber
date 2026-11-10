// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1110-M1: wallet calls to tokens are not filtered (accepted risk)
 * @notice Since 1.4.0 the board may call any function on the vault asset, for example an owner-only
 *         function after the LORE ownership handoff. The flip side: a quorum can spend any approval a
 *         holder gave the chamber. These tests pin both, so a future change is deliberate.
 */
contract FindingR1110UnfilteredTokenCallsTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public director = makeAddr("director");
    address public holder = makeAddr("holder");

    function setUp() public {
        token = new MockERC20("LORE", "LORE", 0);
        nft = new MockERC721("Explorers", "LOREUM");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "cLORE", "cLORE", address(0x9));
        nft.mintWithTokenId(director, 1);
        token.mint(director, 100 ether);
        vm.startPrank(director);
        token.approve(address(chamber), 100 ether);
        chamber.deposit(100 ether, director);
        chamber.delegate(1, chamber.balanceOf(director));
        vm.stopPrank();
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + BoardTypes.SEATING_DELAY);
    }

    function _run(bytes memory data) internal {
        vm.startPrank(director);
        chamber.submitTransaction(1, address(token), 0, data, "", 0);
        chamber.executeTransaction(1, chamber.getTransactionCount() - 1, data);
        vm.stopPrank();
    }

    function test_boardCanCallAnyAssetFunction() public {
        _run(abi.encodeWithSelector(MockERC20.mint.selector, address(chamber), 5 ether));
        assertEq(token.balanceOf(address(chamber)), 105 ether);
    }

    function test_boardCanSpendHolderApproval() public {
        token.mint(holder, 50 ether);
        vm.prank(holder);
        token.approve(address(chamber), type(uint256).max);
        _run(abi.encodeWithSelector(token.transferFrom.selector, holder, director, 50 ether));
        assertEq(token.balanceOf(holder), 0, "approved, never deposited, still taken");
    }
}
