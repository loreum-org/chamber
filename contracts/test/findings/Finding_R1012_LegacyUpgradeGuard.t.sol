// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {Factory} from "src/Factory.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IBoard} from "src/interfaces/IBoard.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {EnumerableSet} from "lib/openzeppelin-contracts/contracts/utils/structs/EnumerableSet.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";

/**
 * @dev Stand-in for a chamber whose delegations were written before 1.2.0. Storage is the same
 *      (1.2.0 only appended `holderEpoch` / `liveDelegation` / `nodeEpoch`), so the only difference
 *      is that `legacyDelegate` writes a delegation the way 1.1.x did: holder rows and board weight,
 *      but no live-weight epoch. Test-only; never deployed.
 */
contract LegacyLayoutChamber is Chamber {
    using EnumerableSet for EnumerableSet.UintSet;

    function legacyDelegate(uint256 tokenId, uint256 amount) external {
        ChamberStorage storage $ = _getChamberStorage();
        $.holderDelegation[msg.sender][tokenId] += amount;
        $.totalHolderDelegations[msg.sender] += amount;
        $.holderDelegatedTokenIds[msg.sender].add(tokenId);
        _delegate(tokenId, amount, $.nft);
    }

    function epochs(address holder, uint256 tokenId) external view returns (uint256 holderEpoch, uint256 nodeEpoch) {
        return (_getChamberStorage().holderEpoch[holder][tokenId], _getBoardStorage().nodeEpoch[tokenId]);
    }
}

/**
 * @title 1.3.0 in-place upgrade guard (#398 follow-up)
 * @notice 1.3.0 deleted the pre-1.2.0 delegation backfill. A pre-1.2.0 chamber is upgraded by its
 *         old code (or its ProxyAdmin), so no 1.3.0 code can veto the implementation switch. The guard
 *         therefore lives in the 1.3.0 delegation paths: a positive delegation row with
 *         `holderEpoch == 0` can only have been written before 1.2.0 (every 1.2.0+ `delegate` sets a
 *         non-zero epoch), and if its node is still on the board, `delegate` / `undelegate` revert
 *         `LegacyDelegation` instead of corrupting board weight. Such chambers must be redeployed.
 *
 *         Upgrades here go through the chamber's ProxyAdmin, the single upgrade path since 1.3.0.
 *         ProxyAdmin has no version checks of its own; the board is responsible for what it approves.
 */
contract FindingR1012LegacyUpgradeGuardTest is Test {
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    MockERC20 internal token;
    MockERC721 internal nft;
    address internal admin = makeAddr("admin");
    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal user3 = makeAddr("user3");
    uint256 internal constant AMOUNT = 1000e18;

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        nft.mintWithTokenId(user1, 1);
        nft.mintWithTokenId(user2, 2);
        nft.mintWithTokenId(user3, 3);
        nft.mintWithTokenId(user1, 4);
    }

    function _create(address impl) internal returns (Chamber chamber) {
        Factory factory = new Factory(impl, admin);
        chamber = Chamber(factory.createChamber(address(token), address(nft), 5, "C", "C"));
    }

    function _fund(Chamber chamber, address user, uint256 amount) internal {
        token.mint(user, amount);
        vm.startPrank(user);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user);
        vm.stopPrank();
    }

    /// @dev Board-approved transaction to the chamber's ProxyAdmin (3 of 3 seated directors), the
    ///      only upgrade path since 1.3.0.
    function _upgrade(Chamber chamber, address newImpl) internal {
        bytes memory data =
            abi.encodeCall(ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(address(chamber)), newImpl, ""));
        address proxyAdmin = chamber.getProxyAdmin();
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdmin, 0, data, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);
        vm.prank(user1);
        chamber.executeTransaction(1, txId, data);
        assertEq(address(uint160(uint256(vm.load(address(chamber), IMPL_SLOT)))), newImpl);
    }

    function _nodeAmount(Chamber chamber, uint256 tokenId) internal view returns (uint256) {
        (uint256[] memory ids, uint256[] memory amounts) = chamber.getTop(10);
        for (uint256 i; i < ids.length; ++i) {
            if (ids[i] == tokenId) return amounts[i];
        }
        return 0;
    }

    /// (a) A chamber whose rows carry 1.2.0+ epochs upgrades to 1.3.0 in place and keeps working.
    function test_UpgradeFrom12xLayout_Succeeds() public {
        Chamber chamber = _create(address(new Chamber()));
        address[3] memory users = [user1, user2, user3];
        for (uint256 i; i < 3; ++i) {
            _fund(chamber, users[i], AMOUNT);
            vm.prank(users[i]);
            chamber.delegate(i + 1, AMOUNT);
        }
        vm.roll(block.number + BoardTypes.SEATING_DELAY + 1);

        _upgrade(chamber, address(new Chamber()));
        assertEq(chamber.VERSION(), bytes32("1.3.0"));

        // Delegation moves cleanly after the upgrade and the board tracks it exactly.
        vm.prank(user1);
        chamber.undelegate(1, 400e18);
        assertEq(_nodeAmount(chamber, 1), 600e18);
        vm.prank(user1);
        chamber.delegate(1, 100e18);
        assertEq(_nodeAmount(chamber, 1), 700e18);
        (uint256[] memory ids, uint256[] memory amounts) = chamber.getDelegations(user1);
        assertEq(ids.length, 1);
        assertEq(amounts[0], 700e18);
    }

    /// (b) A chamber with pre-1.2.0 rows that is upgraded in place anyway cannot move that weight:
    ///     both paths revert and the board, holder rows and share lock are untouched.
    function test_UpgradeFromPre120Layout_LegacyRowsFailClosed() public {
        LegacyLayoutChamber legacyImpl = new LegacyLayoutChamber();
        Chamber chamber = _create(address(legacyImpl));
        address[3] memory users = [user1, user2, user3];
        for (uint256 i; i < 3; ++i) {
            _fund(chamber, users[i], AMOUNT);
            vm.prank(users[i]);
            LegacyLayoutChamber(payable(address(chamber))).legacyDelegate(i + 1, AMOUNT);
        }
        vm.roll(block.number + BoardTypes.SEATING_DELAY + 1);

        _upgrade(chamber, address(new Chamber()));

        vm.prank(user1);
        vm.expectRevert(IBoard.LegacyDelegation.selector);
        chamber.undelegate(1, 400e18);

        _fund(chamber, user1, 100e18);
        vm.prank(user1);
        vm.expectRevert(IBoard.LegacyDelegation.selector);
        chamber.delegate(1, 100e18);

        assertEq(_nodeAmount(chamber, 1), AMOUNT, "board weight unchanged");
        (, uint256[] memory amounts) = chamber.getDelegations(user1);
        assertEq(amounts[0], AMOUNT, "holder row unchanged");

        // The legacy weight still locks the shares that back it, so no phantom seat weight appears.
        uint256 free = chamber.balanceOf(user1) - AMOUNT;
        vm.prank(user1);
        vm.expectRevert(IChamber.ExceedsDelegatedAmount.selector);
        chamber.transfer(user2, free + 1);

        // New weight on a token with no legacy row is tracked normally.
        vm.prank(user1);
        chamber.delegate(4, 100e18);
        assertEq(_nodeAmount(chamber, 4), 100e18);
        vm.prank(user1);
        chamber.undelegate(4, 100e18);
        assertEq(_nodeAmount(chamber, 4), 0);
    }

    /// (c) Why the guard is needed: on a pre-1.2.0 row the epoch is 0 while the node is still on the
    ///     board. 1.3.0's live-weight check (`holderEpoch == nodeEpoch + 1`) would make
    ///     `consumeLiveDelegation` return 0, so an unguarded `undelegate` would cut `holderDelegation`
    ///     and `totalHolderDelegations` (freeing the shares) while the node kept the full weight:
    ///     seat weight backed by nothing. 1.2.0 handled this with the `stored == 0` backfill that
    ///     #398 removed.
    function test_WhyGuard_LegacyRowHasNoEpochWhileNodeHoldsWeight() public {
        LegacyLayoutChamber chamber = LegacyLayoutChamber(payable(address(_create(address(new LegacyLayoutChamber())))));
        _fund(Chamber(payable(address(chamber))), user1, AMOUNT);
        vm.prank(user1);
        chamber.legacyDelegate(1, AMOUNT);

        (uint256 holderEpoch, uint256 nodeEpoch) = chamber.epochs(user1, 1);
        assertEq(holderEpoch, 0, "pre-1.2.0 row has no epoch");
        assertTrue(holderEpoch != nodeEpoch + 1, "unguarded consume would treat it as not live and return 0");
        assertEq(_nodeAmount(Chamber(payable(address(chamber))), 1), AMOUNT, "node still holds the weight");

        // The guard fails closed instead of returning 0.
        vm.prank(user1);
        vm.expectRevert(IBoard.LegacyDelegation.selector);
        chamber.undelegate(1, 1);

        // A 1.2.0+ row on another node gets a non-zero epoch and moves weight exactly.
        _fund(Chamber(payable(address(chamber))), user2, AMOUNT);
        vm.prank(user2);
        chamber.delegate(2, AMOUNT);
        (holderEpoch, nodeEpoch) = chamber.epochs(user2, 2);
        assertEq(holderEpoch, nodeEpoch + 1);
        vm.prank(user2);
        chamber.undelegate(2, AMOUNT);
        assertEq(_nodeAmount(Chamber(payable(address(chamber))), 2), 0);
    }

    /// A legacy row whose node has already left the board holds no board weight, so it can be
    /// withdrawn: the guard only fires when the node is still present.
    function test_LegacyRowOnRemovedNode_CanUndelegate() public {
        LegacyLayoutChamber chamber = LegacyLayoutChamber(payable(address(_create(address(new LegacyLayoutChamber())))));
        _fund(Chamber(payable(address(chamber))), user1, AMOUNT);
        vm.prank(user1);
        chamber.legacyDelegate(1, AMOUNT);

        // Burn the NFT and clean up the inert seat so node 1 leaves the board.
        nft.burn(1);
        chamber.cleanupInertSeat(1);
        assertEq(_nodeAmount(Chamber(payable(address(chamber))), 1), 0);

        vm.prank(user1);
        chamber.undelegate(1, AMOUNT);
        (uint256[] memory ids,) = chamber.getDelegations(user1);
        assertEq(ids.length, 0);
    }
}
