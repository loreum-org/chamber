// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/**
 * @title H-02: Live board ranking has no seating delay
 * @notice A tokenId that newly enters the top-`seats` set cannot confirm or execute
 *         until `SEATING_DELAY` (1 block) elapses. Already-seated directors keep rights.
 */
contract FindingH02SeatingDelayTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    uint256 public constant SEATS = 3;
    uint256 public constant SEATING_DELAY = 1;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), SEATS, "vERC20", "VLT", address(0x9));

        _seat(user1, 1, 100 ether);
        _seat(user2, 2, 100 ether);
        vm.roll(block.number + SEATING_DELAY);
    }

    function test_H02_NewDirectorCannotConfirmUntilDelay() public {
        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");

        _seat(user3, 3, 50 ether);

        assertEq(chamber.getSeatedAt(3), block.number + SEATING_DELAY, "new top-seat token activates next block");
        assertTrue(_isLiveDirector(3), "live ranking includes the new token immediately");

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.confirmTransaction(3, 0);

        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        assertTrue(chamber.getConfirmation(2, 0), "existing seated director can still confirm");
    }

    function test_H02_NewDirectorCannotExecuteUntilDelay() public {
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 1 ether, "");
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);

        _seat(user3, 3, 50 ether);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.executeTransaction(3, 0, "");

        vm.prank(user1);
        chamber.executeTransaction(1, 0, "");
        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed, "existing seated director can still execute");
    }

    function test_H02_NewDirectorCannotSubmitUntilDelay() public {
        _seat(user3, 3, 50 ether);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.submitTransaction(3, address(0x3), 0, "");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1, "existing seated director can still submit");
    }

    function test_H02_NewDirectorCanActAfterDelay() public {
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 1 ether, "");

        _seat(user3, 3, 50 ether);
        vm.roll(block.number + SEATING_DELAY);

        vm.prank(user3);
        chamber.confirmTransaction(3, 0);
        assertTrue(chamber.getConfirmation(3, 0));

        vm.prank(user3);
        chamber.executeTransaction(3, 0, "");
        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
    }

    function test_H02_ExistingDirectorUnaffectedByLaterSeating() public {
        uint256 seatedAtBefore = chamber.getSeatedAt(1);

        _seat(user3, 3, 50 ether);

        assertEq(chamber.getSeatedAt(1), seatedAtBefore, "incumbent seating checkpoint is unchanged");
        assertTrue(block.number >= seatedAtBefore);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);

        assertTrue(chamber.getConfirmation(1, 0));
        assertTrue(chamber.getConfirmation(2, 0));
    }

    function test_H02_ReseatedTokenMustWaitAgain() public {
        _seat(user3, 3, 50 ether);
        vm.roll(block.number + SEATING_DELAY);

        uint256 firstActivation = chamber.getSeatedAt(3);

        vm.prank(user3);
        chamber.undelegate(3, 50 ether);
        assertEq(chamber.getSeatedAt(3), 0);

        vm.prank(user3);
        chamber.delegate(3, 50 ether);
        assertGt(chamber.getSeatedAt(3), firstActivation, "re-entry writes a later activation block");

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.submitTransaction(3, address(0x3), 0, "");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1);
    }

    /// @dev ERC-7201 Board storage + inlined SeatUpdate (4 slots) + head + tail + packed size/seats.
    bytes32 private constant _BOARD_STORAGE_SLOT = 0xae916af301d5dc481b59b170e7db23e36b830da7017e456f99549768499c8800;
    uint256 private constant _SEATED_AT_SLOT_OFFSET = 8;

    /**
     * @notice After an in-place impl upgrade, `seatedAt` is unset (0) for every incumbent.
     *         Those directors must still submit/confirm/execute immediately.
     */
    function test_H02_PostUpgradeUnsetSeatedAt_IncumbentsCanActImmediately() public {
        deal(address(chamber), 1 ether);
        _simulatePostUpgradeStorage(1);
        _simulatePostUpgradeStorage(2);
        assertEq(chamber.getSeatedAt(1), 0);
        assertEq(chamber.getSeatedAt(2), 0);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 1 ether, "");
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user1);
        chamber.executeTransaction(1, 0, "");

        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed, "upgrade must not lock incumbents with unset seatedAt");
    }

    /**
     * @notice Post-upgrade incumbents stay live; a tokenId that newly enters the top set
     *         still waits `SEATING_DELAY` even after a later board mutation.
     */
    function test_H02_PostUpgradeUnsetSeatedAt_NewSeatStillWaits() public {
        _simulatePostUpgradeStorage(1);
        _simulatePostUpgradeStorage(2);
        assertEq(chamber.getSeatedAt(1), 0);

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");

        _seat(user3, 3, 50 ether);
        assertGt(chamber.getSeatedAt(3), 0, "new seat still receives an activation block");
        assertEq(chamber.getSeatedAt(1), 0, "incumbent checkpoint stays unset after refresh");

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.confirmTransaction(3, 0);

        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        assertTrue(chamber.getConfirmation(2, 0));

        vm.roll(block.number + SEATING_DELAY);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);
        assertTrue(chamber.getConfirmation(3, 0));
    }

    /**
     * @notice A later delegate (which runs `_refreshSeating`) must not stamp incumbents
     *         and lock them for a block.
     */
    function test_H02_PostUpgradeUnsetSeatedAt_RefreshDoesNotLockIncumbents() public {
        _simulatePostUpgradeStorage(1);
        _simulatePostUpgradeStorage(2);

        token.mint(user1, 1 ether);
        vm.startPrank(user1);
        token.approve(address(chamber), 1 ether);
        chamber.deposit(1 ether, user1);
        chamber.delegate(1, 1 ether);
        vm.stopPrank();

        assertEq(chamber.getSeatedAt(1), 0, "refresh must not assign an activation to an incumbent");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1);
    }

    function test_H02_PostUpgradeUnsetSeatedAt_ReentryStillWaits() public {
        _simulatePostUpgradeStorage(1);
        _simulatePostUpgradeStorage(2);

        _seat(user3, 3, 50 ether);
        vm.roll(block.number + SEATING_DELAY);

        vm.prank(user3);
        chamber.undelegate(3, 50 ether);
        assertEq(chamber.getSeatedAt(3), 0);

        vm.prank(user3);
        chamber.delegate(3, 50 ether);
        assertGt(chamber.getSeatedAt(3), 0);

        vm.prank(user3);
        vm.expectRevert(IChamber.DirectorNotSeated.selector);
        chamber.submitTransaction(3, address(0x3), 0, "");

        vm.prank(user1);
        chamber.submitTransaction(1, address(0x3), 0, "");
        assertEq(chamber.getTransactionCount(), 1);
    }

    function _seatedAtSlot(uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encode(tokenId, uint256(_BOARD_STORAGE_SLOT) + _SEATED_AT_SLOT_OFFSET));
    }

    /// @dev Zero `seatedAt[tokenId]` as an in-place upgrade would: the new mapping is empty.
    function _simulatePostUpgradeStorage(uint256 tokenId) internal {
        uint256 recorded = chamber.getSeatedAt(tokenId);
        assertGt(recorded, 0, "precondition: token has a checkpoint to clear");
        assertEq(
            uint256(vm.load(address(chamber), _seatedAtSlot(tokenId))),
            recorded,
            "seatedAt ERC-7201 slot offset must match BoardStorage layout"
        );
        vm.store(address(chamber), _seatedAtSlot(tokenId), bytes32(0));
        assertEq(chamber.getSeatedAt(tokenId), 0);
    }

    function _seat(address user, uint256 tokenId, uint256 amount) internal {
        try nft.ownerOf(tokenId) returns (address owner) {
            if (owner != user) revert("token already minted to another owner");
        } catch {
            nft.mintWithTokenId(user, tokenId);
        }

        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        chamber.delegate(tokenId, amount);
        vm.stopPrank();
    }

    function _isLiveDirector(uint256 tokenId) internal view returns (bool) {
        (uint256[] memory topIds,) = chamber.getTop(SEATS);
        for (uint256 i = 0; i < topIds.length; i++) {
            if (topIds[i] == tokenId) return true;
        }
        return false;
    }
}
