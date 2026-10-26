// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {ChamberAuthHarness} from "test/symbolic/ChamberAuthHarness.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";

/// @dev Contract wallet that owns a membership NFT and acts as itself.
contract MockContractOwner {
    function execute(address target, bytes calldata data) external {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }
}

/// @notice Symbolic verification of Chamber director auth and wallet queue
/// @dev Uses ChamberAuthHarness: Halmos 0.3.3 cannot `new Chamber()` (`vm.deployCode`).
contract ChamberSymTest is Test, SymTest {
    ChamberAuthHarness internal chamber;
    MockERC721 internal nft;
    MockContractOwner internal contractOwner;

    address internal constant USER = address(0xBEEF);
    address internal constant USER2 = address(0xCAFE);
    address internal constant TARGET = address(0x100);

    function setUp() public {
        nft = new MockERC721("Mock NFT", "MNFT");
        contractOwner = new MockContractOwner();
        chamber = new ChamberAuthHarness(address(nft), 2);
    }

    /// @dev Constructor writes the intended membership NFT and seat count.
    ///      Live quorum is reachable directors (PMN-M01): empty board → n=0 → 1.
    function symbolicInitializeStoresConfig() public view {
        assertEq(address(chamber.nft()), address(nft));
        assertEq(chamber.getSeats(), 2);
        assertEq(chamber.getReachableDirectorCount(), 0);
        assertEq(chamber.getQuorum(), 1);
    }

    /// @dev Zero or >20 seats cannot construct the harness (same bounds as Chamber.initialize)
    function symbolicInitializeInvalidSeatsReverts() public {
        uint256 seats = svm.createUint256("seats");
        vm.assume(seats == 0 || seats > 20);

        (bool success,) = address(this).call(abi.encodeCall(this.deployHarness, (address(nft), seats)));
        assertFalse(success);
    }

    function deployHarness(address nft_, uint256 seats) external {
        new ChamberAuthHarness(nft_, seats);
    }

    /// @dev Holder delegation never exceeds share balance
    function symbolicDelegationBoundedByBalance() public {
        uint256 tokenId = svm.createUint(16, "tokenId");
        uint256 depositAmount = svm.createUint(64, "depositAmount");
        uint256 delegateAmount = svm.createUint(64, "delegateAmount");
        vm.assume(tokenId > 0);
        vm.assume(depositAmount > 0 && delegateAmount > 0 && delegateAmount <= depositAmount);

        _fundAndDelegate(USER, tokenId, depositAmount, delegateAmount);

        assertLe(chamber.holderDelegation(USER, tokenId), chamber.shareBalance(USER));
        assertEq(chamber.holderDelegation(USER, tokenId), delegateAmount);
        assertEq(chamber.totalHolderDelegations(USER), delegateAmount);
    }

    /// @dev Board node amount matches holder delegation after delegate
    function symbolicBoardNodeMatchesDelegation() public {
        uint256 tokenId = svm.createUint(16, "tokenId");
        uint256 depositAmount = svm.createUint(64, "depositAmount");
        uint256 delegateAmount = svm.createUint(64, "delegateAmount");
        vm.assume(tokenId > 0);
        vm.assume(depositAmount > 0 && delegateAmount > 0 && delegateAmount <= depositAmount);

        _fundAndDelegate(USER, tokenId, depositAmount, delegateAmount);

        (, uint256 nodeAmount,,) = chamber.getMember(tokenId);
        assertEq(nodeAmount, delegateAmount);
    }

    /// @dev Partial undelegate reduces holder and node amounts consistently
    function symbolicUndelegateAccounting() public {
        uint256 tokenId = svm.createUint(16, "tokenId");
        uint256 depositAmount = svm.createUint(64, "depositAmount");
        uint256 delegateAmount = svm.createUint(64, "delegateAmount");
        uint256 undelegateAmount = svm.createUint(64, "undelegateAmount");
        vm.assume(tokenId > 0);
        vm.assume(depositAmount > 0 && delegateAmount > 0 && delegateAmount <= depositAmount);
        vm.assume(undelegateAmount > 0 && undelegateAmount <= delegateAmount);

        _fundAndDelegate(USER, tokenId, depositAmount, delegateAmount);

        vm.prank(USER);
        chamber.undelegate(tokenId, undelegateAmount);

        uint256 expected = delegateAmount - undelegateAmount;
        assertEq(chamber.holderDelegation(USER, tokenId), expected);
        assertEq(chamber.totalHolderDelegations(USER), expected);

        (, uint256 nodeAmount,,) = chamber.getMember(tokenId);
        assertEq(nodeAmount, expected);
    }

    /// @dev Transfer cannot drop a holder's share balance below their outstanding delegation
    function symbolicTransferRespectsDelegation() public {
        uint256 tokenId = svm.createUint(16, "tokenId");
        uint256 shares = svm.createUint(48, "shares");
        vm.assume(tokenId > 0 && shares > 0);

        nft.mintWithTokenId(USER, tokenId);
        chamber.mintShares(USER, shares);

        uint256 delegateAmount = svm.createUint(48, "delegateAmount");
        uint256 transferAmount = svm.createUint(48, "transferAmount");
        vm.assume(delegateAmount > 0 && delegateAmount <= shares);
        vm.assume(transferAmount > 0 && transferAmount <= shares);
        vm.assume(shares - transferAmount < delegateAmount);

        vm.startPrank(USER);
        chamber.delegate(tokenId, delegateAmount);
        (bool success,) = address(chamber).call(abi.encodeCall(chamber.transfer, (USER2, transferAmount)));
        vm.stopPrank();

        assertFalse(success);
        assertEq(chamber.shareBalance(USER), shares);
        assertEq(chamber.totalHolderDelegations(USER), delegateAmount);
    }

    /// @dev Only the NFT owner can act for a seated token; any other symbolic caller cannot
    function symbolicUnauthorizedCallerCannotAct() public {
        address caller = svm.createAddress("caller");
        vm.assume(caller != USER && caller != address(0));

        _fundAndDelegate(USER, 1, 1e18, 1e18);
        _rollDelay();

        vm.prank(caller);
        (bool callerOk,) = address(chamber).call(_submitTx(1));
        assertFalse(callerOk);

        vm.prank(USER);
        (bool ownerOk,) = address(chamber).call(_submitTx(1));
        assertTrue(ownerOk);
    }

    /// @dev A newly seated token cannot submit until the seating delay elapses
    function symbolicImmatureDirectorCannotSubmit() public {
        _fundAndDelegate(USER, 1, 1e18, 1e18);

        vm.prank(USER);
        (bool success,) = address(chamber).call(_submitTx(1));
        assertFalse(success);
    }

    /// @dev Wallet submit / confirm / execute require a current, mature director token
    function symbolicWalletQueueRequiresDirector() public {
        address stranger = svm.createAddress("stranger");
        vm.assume(stranger != USER && stranger != USER2 && stranger != address(0));

        _fundAndDelegate(USER, 1, 2e18, 2e18);
        _fundAndDelegate(USER2, 2, 1e18, 1e18);
        _rollDelay();

        vm.prank(stranger);
        (bool submitOk,) = address(chamber).call(_submitTx(1));
        assertFalse(submitOk);

        vm.prank(USER);
        chamber.submitTransaction(1, TARGET, 0, "");
        assertTrue(chamber.getConfirmation(1, 0));
        assertEq(chamber.getTransactionRequiredQuorum(0), 2);
        assertEq(chamber.getReachableDirectorCount(), 2);

        vm.prank(stranger);
        (bool confirmOk,) = address(chamber).call(abi.encodeCall(chamber.confirmTransaction, (2, 0)));
        assertFalse(confirmOk);

        vm.prank(USER);
        (bool executeEarly,) = address(chamber).call(abi.encodeCall(chamber.executeTransaction, (1, 0, bytes(""))));
        assertFalse(executeEarly);

        vm.prank(USER2);
        chamber.confirmTransaction(2, 0);

        vm.prank(USER);
        chamber.executeTransaction(1, 0, "");
        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
    }

    /// @dev Two cancel votes (quorum 2) mark the nonce cancelled and block execute
    function symbolicWalletCancelRequiresQuorum() public {
        _fundAndDelegate(USER, 1, 2e18, 2e18);
        _fundAndDelegate(USER2, 2, 1e18, 1e18);
        _rollDelay();

        vm.prank(USER);
        chamber.submitTransaction(1, TARGET, 0, "");

        vm.prank(USER);
        chamber.cancelTransaction(1, 0);
        assertFalse(chamber.getCancelled(0));

        vm.prank(USER2);
        chamber.cancelTransaction(2, 0);
        assertTrue(chamber.getCancelled(0));

        vm.prank(USER);
        (bool success,) = address(chamber).call(abi.encodeCall(chamber.executeTransaction, (1, 0, bytes(""))));
        assertFalse(success);
    }

    /// @dev PMN-M01: a chamber-held top-seat NFT drops out of the reachable quorum denominator
    function symbolicReachableQuorumDropsChamberHeldSeat() public {
        _fundAndDelegate(USER, 1, 2e18, 2e18);
        _fundAndDelegate(USER2, 2, 1e18, 1e18);
        _rollDelay();

        assertEq(chamber.getReachableDirectorCount(), 2);
        assertEq(chamber.getQuorum(), 2);

        vm.prank(USER2);
        nft.transferFrom(USER2, address(chamber), 2);

        // R-1012-G1: a chamber-held seat keeps counting until it is cleaned up.
        assertEq(chamber.getQuorum(), 2);
        chamber.cleanupInertSeat(2);
        assertEq(chamber.getReachableDirectorCount(), 1);
        assertEq(chamber.getQuorum(), 1);
        assertEq(chamber.getSeats(), 2);
    }

    /// @dev R-1012-G1: weight cannot be delegated to a chamber-held token
    function symbolicCannotDelegateToChamberHeld(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1e18);
        _fundAndDelegate(USER, 1, 2e18, 1e18);
        vm.prank(USER);
        nft.transferFrom(USER, address(chamber), 1);
        vm.prank(USER);
        (bool ok,) = address(chamber).call(abi.encodeCall(chamber.delegate, (uint256(1), amount)));
        assertFalse(ok);
    }

    /// @dev PMN-H01: after ownerOf changes, the new controller waits until syncSeating + delay
    function symbolicControlTransferRequiresSyncSeating() public {
        _fundAndDelegate(address(contractOwner), 1, 2e18, 2e18);
        _fundAndDelegate(USER, 2, 1e18, 1e18);
        _rollDelay();

        contractOwner.execute(
            address(nft), abi.encodeCall(nft.transferFrom, (address(contractOwner), USER2, uint256(1)))
        );

        vm.prank(USER2);
        (bool beforeSync,) = address(chamber).call(_submitTx(1));
        assertFalse(beforeSync);

        uint256 syncBlock = vm.getBlockNumber();
        chamber.syncSeating(1);
        assertEq(chamber.getSeatedAt(1), syncBlock + BoardTypes.SEATING_DELAY);

        vm.prank(USER2);
        (bool beforeDelay,) = address(chamber).call(_submitTx(1));
        assertFalse(beforeDelay);

        _rollDelay();
        vm.prank(USER2);
        chamber.submitTransaction(1, TARGET, 0, "");
        assertEq(chamber.getTransactionCount(), 1);
    }

    function _rollDelay() internal {
        uint256 n = vm.getBlockNumber();
        vm.roll(n + BoardTypes.SEATING_DELAY);
    }

    function _submitTx(uint256 tokenId) internal view returns (bytes memory) {
        return abi.encodeCall(ChamberAuthHarness.submitTransaction, (tokenId, TARGET, uint256(0), bytes("")));
    }

    function _fundAndDelegate(address holder, uint256 tokenId, uint256 shares, uint256 delegateAmount) internal {
        nft.mintWithTokenId(holder, tokenId);
        chamber.mintShares(holder, shares);
        vm.prank(holder);
        chamber.delegate(tokenId, delegateAmount);
    }
}
