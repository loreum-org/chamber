// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, stdStorage, StdStorage} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title M-06: Wallet transactions have no deadline — FIXED
 * @notice After the stored deadline, execute reverts. Before the deadline,
 *         a fully confirmed transaction still executes.
 */
contract FindingM06WalletExpiryTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    using stdStorage for StdStorage;

    uint256 public constant SEATS = 5;
    bytes internal constant EMPTY = "";

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 100_000_000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), SEATS, "vERC20", "VLT", address(0x9));

        _setupDirector(user1, 1, 1 ether);
        _setupDirector(user2, 2, 1 ether);
        _setupDirector(user3, 3, 1 ether);
        vm.roll(block.number + 1);
    }

    function test_M06_ExecuteAfterDeadline_Reverts() public {
        address target = address(0x3);
        uint256 value = 1 ether;
        uint256 deadline = block.timestamp + 7 days;
        deal(address(chamber), value);

        vm.prank(user1);
        chamber.submitTransaction(1, target, value, EMPTY, deadline);
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        vm.warp(deadline + 1);

        assertTrue(chamber.isTransactionExpired(0));
        vm.expectRevert(IWallet.TransactionExpired.selector);
        vm.prank(user1);
        chamber.executeTransaction(1, 0, EMPTY);
    }

    function test_M06_ExecuteBeforeDeadline_Succeeds() public {
        address target = address(0x4);
        uint256 value = 1 ether;
        uint256 deadline = block.timestamp + 7 days;
        deal(address(chamber), value);

        vm.prank(user1);
        chamber.submitTransaction(1, target, value, EMPTY, deadline);
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        vm.warp(deadline);

        assertFalse(chamber.isTransactionExpired(0));
        vm.prank(user1);
        chamber.executeTransaction(1, 0, EMPTY);

        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
        assertEq(target.balance, value);
    }

    function test_M06_DefaultSubmit_UsesThirtyDayMaxAge() public {
        uint256 submittedAt = block.timestamp;

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, EMPTY);

        assertEq(chamber.getTransactionDeadline(0), submittedAt + chamber.DEFAULT_TRANSACTION_MAX_AGE());
        assertEq(chamber.DEFAULT_TRANSACTION_MAX_AGE(), 30 days);
    }

    function test_M06_LegacyUnsetDeadline_ConfirmAndExecute_Succeeds() public {
        address target = address(0x5);
        uint256 value = 1 ether;
        deal(address(chamber), value);

        vm.prank(user1);
        chamber.submitTransaction(1, target, value, EMPTY);
        _clearStoredDeadline(0);

        assertEq(chamber.getTransactionDeadline(0), 0);
        assertFalse(chamber.isTransactionExpired(0));

        vm.warp(block.timestamp + 365 days);
        assertFalse(chamber.isTransactionExpired(0));

        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);
        vm.prank(user1);
        chamber.executeTransaction(1, 0, EMPTY);

        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
        assertEq(target.balance, value);
    }

    function test_M06_FourArgSubmit_ExpiresAfterThirtyDays() public {
        address target = address(0x6);
        uint256 value = 1 ether;
        uint256 submittedAt = block.timestamp;
        deal(address(chamber), value);

        vm.prank(user1);
        chamber.submitTransaction(1, target, value, EMPTY);
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        uint256 deadline = chamber.getTransactionDeadline(0);
        assertEq(deadline, submittedAt + chamber.DEFAULT_TRANSACTION_MAX_AGE());

        vm.warp(deadline + 1);
        assertTrue(chamber.isTransactionExpired(0));
        vm.expectRevert(IWallet.TransactionExpired.selector);
        vm.prank(user1);
        chamber.executeTransaction(1, 0, EMPTY);
    }

    /// @dev Simulate a pre-upgrade pending nonce: mapping value is still the zero default.
    function _clearStoredDeadline(uint256 nonce) internal {
        stdstore.target(address(chamber)).sig(chamber.getTransactionDeadline.selector).with_key(nonce).checked_write(
            uint256(0)
        );
    }

    function _setupDirector(address user, uint256 tokenId, uint256 amount) internal {
        nft.mintWithTokenId(user, tokenId);
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }
}
