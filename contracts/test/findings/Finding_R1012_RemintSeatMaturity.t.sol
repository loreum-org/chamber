// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/**
 * @title R-1012-L4 (seat half): a burned top-seat tokenId keeps a mature `seatedAt`
 * @notice Syncing while `ownerOf` fails deleted `seatedOwner` and left `seatedAt` in place, so the
 *         next mint of that id acted immediately. Session-key revival was removed in 1.3.0.
 */
contract FindingR1012RemintSeatMaturityTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public director = makeAddr("director");
    address public buyer = makeAddr("buyer");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deploy(address(token), address(nft), 1, "C", "C", address(0x9));

        nft.mintWithTokenId(director, 1);
        token.mint(director, 1 ether);
        vm.startPrank(director);
        token.approve(address(chamber), 1 ether);
        chamber.deposit(1 ether, director);
        chamber.delegate(1, 1 ether);
        vm.stopPrank();
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        assertLe(chamber.getSeatedAt(1), block.number, "incumbent should be seated");
    }

    function test_remintAfterBurnedSyncWaitsOutSeatingDelay() public {
        nft.burn(1);
        chamber.syncSeating(1);
        nft.mintWithTokenId(buyer, 1);

        assertGt(chamber.getSeatedAt(1), block.number, "reminted id inherited a mature seat");

        vm.prank(buyer);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.updateSeats(1, 2);

        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.prank(buyer);
        chamber.updateSeats(1, 2);
        (uint256 proposed,,,) = chamber.getSeatUpdate();
        assertEq(proposed, 2);
    }
}
