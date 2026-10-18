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

    function setUp() public {
        MockERC20 token = new MockERC20("T", "T", 0);
        MockERC721 nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));
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
}
