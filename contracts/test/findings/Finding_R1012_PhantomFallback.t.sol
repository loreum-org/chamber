// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC20Permit} from "lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title R-1012-L3: payable catch-all fallback made unknown selectors look successful
 * @notice A router calling `permit` on the chamber saw success and went on. Calls with no ETH
 *         now revert; plain ETH and ETH sent with calldata are still accepted.
 */
contract FindingR1012PhantomFallbackTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public director = makeAddr("director");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));
    }

    function _seatDirector() internal {
        nft.mintWithTokenId(director, 1);
        token.mint(director, 1e18);
        vm.startPrank(director);
        token.approve(address(chamber), 1e18);
        chamber.deposit(1e18, director);
        chamber.delegate(1, 1e18);
        vm.stopPrank();
        vm.roll(block.number + 2);
    }

    function test_unknownSelectorReverts() public {
        vm.expectRevert(IChamber.InvalidTransaction.selector);
        IERC20Permit(address(chamber)).permit(address(1), address(2), 1, block.timestamp, 0, bytes32(0), bytes32(0));
    }

    function test_plainEthAccepted() public {
        vm.deal(address(this), 2 ether);
        (bool ok,) = address(chamber).call{value: 1 ether}("");
        assertTrue(ok);
        (ok,) = address(chamber).call{value: 1 ether}(hex"deadbeef");
        assertTrue(ok);
        assertEq(address(chamber).balance, 2 ether);
    }

    /// A self-targeted proposal with an unknown selector is rejected at submit (self-call allowlist),
    /// so it can never reach execute and the fallback.
    function test_selfTargetUnknownSelector_RejectedAtSubmit() public {
        _seatDirector();
        bytes memory data = abi.encodeWithSelector(IERC20Permit.permit.selector, address(1), address(2), 1, 0, 0, 0, 0);
        vm.prank(director);
        vm.expectRevert(IChamber.InvalidTransaction.selector);
        chamber.submitTransaction(1, address(chamber), 0, data, "", 0);
    }

    /// A zero-value call the chamber makes to itself with an unknown selector (the path a
    /// self-targeted execute would take) reverts through the fallback instead of succeeding.
    function test_selfCallUnknownSelector_RevertsInFallback() public {
        vm.prank(address(chamber));
        (bool ok, bytes memory ret) = address(chamber).call(hex"deadbeef");
        assertFalse(ok);
        assertEq(bytes4(ret), IChamber.InvalidTransaction.selector);
    }
}
