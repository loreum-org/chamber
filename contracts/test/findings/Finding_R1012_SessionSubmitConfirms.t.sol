// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

contract SessionOwner {
    function execute(address target, bytes calldata data) external {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }
}

/**
 * @title R-1012-SK1: a SUBMIT-only session key also casts the seat's confirm vote
 * @notice Submitting auto-confirms for the submitting token, so submit must need the
 *         CONFIRM scope bit and the post-set `liveAt` delay, same as `confirmTransaction`.
 */
contract FindingR1012SessionSubmitConfirmsTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    SessionOwner public owner;

    address public user1 = address(0x1);
    address public sessionKey = address(0xB0B);
    uint256 public constant TOKEN_OWNER = 3;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), 3, "vMCK", "VLT", address(0x9));
        owner = new SessionOwner();

        _seat(user1, 1, 100 ether);
        _seat(address(0x2), 2, 100 ether);
        _seat(address(owner), TOKEN_OWNER, 100 ether);
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
    }

    function _seat(address user, uint256 tokenId, uint256 amount) internal {
        nft.mintWithTokenId(user, tokenId);
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }

    function _setKey(uint32 scope) internal {
        owner.execute(
            address(chamber),
            abi.encodeCall(chamber.setDirectorOperator, (TOKEN_OWNER, sessionKey, block.timestamp + 1 days, scope))
        );
    }

    /// A key without CONFIRM must not be able to add a confirmation by submitting.
    function test_submitOnlyKeyCannotVoteBySubmitting() public {
        _setKey(chamber.SESSION_SCOPE_SUBMIT());
        vm.roll(block.number + BoardTypes.SEATING_DELAY);

        vm.prank(sessionKey);
        vm.expectRevert(IChamber.NotDirector.selector);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
    }

    /// A freshly set key must not vote (via submit) before `liveAt`.
    function test_newKeyCannotSubmitBeforeLiveAt() public {
        _setKey(chamber.SESSION_SCOPE_SUBMIT() | chamber.SESSION_SCOPE_CONFIRM());

        vm.prank(sessionKey);
        vm.expectRevert(IChamber.NotDirector.selector);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");

        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.prank(sessionKey);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
        assertTrue(chamber.getConfirmation(TOKEN_OWNER, 0));
    }
}
