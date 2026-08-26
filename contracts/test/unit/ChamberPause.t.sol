// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {PausableUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import {
    ERC4626Upgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";

/// @notice L-02: board-quorum pause for vault + wallet execute (no EOA guardian)
contract ChamberPauseTest is Test {
    Chamber public chamber;
    IERC20 public token;
    IERC721 public nft;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public stranger = address(0xBEEF);

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 1_000_000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        chamber = DeployChamber.deploy(address(token), address(nft), 5, "vERC20", "Vault Token", address(0x9));
        _addDirectors();
    }

    function test_Pause_BlocksDeposit() public {
        _pauseViaQuorum();

        uint256 amount = 1 ether;
        MockERC20(address(token)).mint(stranger, amount);

        vm.startPrank(stranger);
        token.approve(address(chamber), amount);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626Upgradeable.ERC4626ExceededMaxDeposit.selector, stranger, amount, uint256(0))
        );
        chamber.deposit(amount, stranger);
        vm.stopPrank();
    }

    function test_Pause_BlocksExecute() public {
        address recipient = address(0x3);
        bytes memory data = "";
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, recipient, 1 ether, data);
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        _pauseViaQuorum();

        vm.prank(user1);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        chamber.executeTransaction(1, 0, data);
    }

    function test_Unpause_RestoresDeposit() public {
        _pauseViaQuorum();
        _unpauseViaQuorum();

        uint256 amount = 1 ether;
        MockERC20(address(token)).mint(stranger, amount);

        vm.startPrank(stranger);
        token.approve(address(chamber), amount);
        uint256 shares = chamber.deposit(amount, stranger);
        vm.stopPrank();

        assertGt(shares, 0);
        assertGt(chamber.balanceOf(stranger), 0);
    }

    function test_Unpause_RestoresExecute() public {
        address recipient = address(0x3333);
        bytes memory data = "";
        deal(address(chamber), 1 ether);

        vm.prank(user1);
        chamber.submitTransaction(1, recipient, 1 ether, data);
        vm.prank(user2);
        chamber.confirmTransaction(2, 0);
        vm.prank(user3);
        chamber.confirmTransaction(3, 0);

        _pauseViaQuorum();
        _unpauseViaQuorum();

        vm.prank(user1);
        chamber.executeTransaction(1, 0, data);

        (bool executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed);
        assertEq(recipient.balance, 1 ether);
    }

    function test_NonDirector_CannotPause() public {
        vm.prank(stranger);
        vm.expectRevert(IChamber.NotAuthorized.selector);
        chamber.pause();

        MockERC721(address(nft)).mintWithTokenId(stranger, 999);

        bytes memory pauseData = abi.encodeWithSelector(IChamber.pause.selector);
        vm.prank(stranger);
        vm.expectRevert(IChamber.NotDirector.selector);
        chamber.submitTransaction(999, address(chamber), 0, pauseData);
    }

    function test_DirectorDirectPause_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(IChamber.NotAuthorized.selector);
        chamber.pause();

        vm.prank(user1);
        vm.expectRevert(IChamber.NotAuthorized.selector);
        chamber.unpause();
    }

    function test_PauseViaQuorum_SetsPaused() public {
        assertFalse(chamber.paused());
        _pauseViaQuorum();
        assertTrue(chamber.paused());
        assertEq(chamber.maxDeposit(user1), 0);
        assertEq(chamber.maxMint(user1), 0);
        assertEq(chamber.maxWithdraw(user1), 0);
        assertEq(chamber.maxRedeem(user1), 0);
    }

    function test_UnpauseViaQuorum_WhilePaused() public {
        _pauseViaQuorum();
        assertTrue(chamber.paused());
        _unpauseViaQuorum();
        assertFalse(chamber.paused());
    }

    function test_SubmitPauseSelector_Allowed() public {
        bytes memory pauseData = abi.encodeWithSelector(IChamber.pause.selector);
        vm.prank(user1);
        chamber.submitTransaction(1, address(chamber), 0, pauseData);

        (,, address target,, bytes32 dataHash) = chamber.getTransaction(0);
        assertEq(target, address(chamber));
        assertEq(dataHash, keccak256(pauseData));
    }

    function _addDirectors() internal {
        uint256 amount = 1 ether;

        MockERC721(address(nft)).mintWithTokenId(user1, 1);
        MockERC721(address(nft)).mintWithTokenId(user2, 2);
        MockERC721(address(nft)).mintWithTokenId(user3, 3);

        MockERC20(address(token)).mint(user1, amount);
        MockERC20(address(token)).mint(user2, amount);
        MockERC20(address(token)).mint(user3, amount);

        vm.startPrank(user1);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user1);
        chamber.delegate(1, 1);
        vm.stopPrank();

        vm.startPrank(user2);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user2);
        chamber.delegate(2, 1);
        vm.stopPrank();

        vm.startPrank(user3);
        token.approve(address(chamber), amount);
        chamber.deposit(amount, user3);
        chamber.delegate(3, 1);
        vm.stopPrank();
        vm.roll(block.number + 1);
    }

    function _pauseViaQuorum() internal {
        bytes memory pauseData = abi.encodeWithSelector(IChamber.pause.selector);
        _executeSelfCall(pauseData);
    }

    function _unpauseViaQuorum() internal {
        bytes memory unpauseData = abi.encodeWithSelector(IChamber.unpause.selector);
        _executeSelfCall(unpauseData);
    }

    function _executeSelfCall(bytes memory data) internal {
        uint256 txId = chamber.getTransactionCount();

        vm.prank(user1);
        chamber.submitTransaction(1, address(chamber), 0, data);
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);
        vm.prank(user1);
        chamber.executeTransaction(1, txId, data);
    }
}
