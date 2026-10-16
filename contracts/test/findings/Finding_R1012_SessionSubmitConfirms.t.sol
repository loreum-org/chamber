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
 * @notice Submitting auto-confirms for the submitting token. A session key keeps SUBMIT-only
 *         (propose-only) use, but its submit only votes when the key could confirm right now:
 *         CONFIRM scope and past `liveAt`, same as `confirmTransaction`.
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

    /// A propose-only key (no CONFIRM) can still submit, but the submit casts no vote.
    function test_submitOnlyKeySubmitsWithoutVoting() public {
        _setKey(chamber.SESSION_SCOPE_SUBMIT());

        vm.prank(sessionKey);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
        assertFalse(chamber.getConfirmation(TOKEN_OWNER, 0));

        // Still no vote after liveAt: the key never had CONFIRM.
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.prank(sessionKey);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
        assertFalse(chamber.getConfirmation(TOKEN_OWNER, 1));

        // And it cannot confirm separately.
        vm.prank(sessionKey);
        vm.expectRevert(IChamber.NotDirector.selector);
        chamber.confirmTransaction(TOKEN_OWNER, 1);
    }

    /// A freshly set key with CONFIRM submits before `liveAt` without a vote, and votes after.
    function test_newKeySubmitVotesOnlyAfterLiveAt() public {
        _setKey(chamber.SESSION_SCOPE_SUBMIT() | chamber.SESSION_SCOPE_CONFIRM());

        vm.prank(sessionKey);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
        assertFalse(chamber.getConfirmation(TOKEN_OWNER, 0));

        vm.roll(block.number + BoardTypes.SEATING_DELAY);
        vm.prank(sessionKey);
        chamber.submitTransaction(TOKEN_OWNER, address(0xCAFE), 0, "");
        assertTrue(chamber.getConfirmation(TOKEN_OWNER, 1));
    }

    /// The NFT owner itself always votes when submitting.
    function test_ownerSubmitStillVotes() public {
        vm.prank(user1);
        chamber.submitTransaction(1, address(0xCAFE), 0, "");
        assertTrue(chamber.getConfirmation(1, 0));
    }
}
