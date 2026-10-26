// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {ChamberId} from "src/libraries/ChamberId.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @dev No `CHAMBER_ID()`. A quorum upgrade to this must be rejected.
contract NotAChamber {}

/**
 * @title R-1012-L6: ProxyAdmin calls have no compatibility check
 * @notice A quorum could upgrade to a contract with no wallet, or call
 *         `transferOwnership` / `renounceOwnership` and give away the only upgrade path.
 */
contract FindingR1012UpgradeCompatibilityTest is Test {
    Chamber public chamber;
    MockERC20 public token;
    MockERC721 public nft;
    address public director = makeAddr("director");

    function setUp() public {
        token = new MockERC20("T", "T", 0);
        nft = new MockERC721("N", "N");
        chamber = DeployChamber.deployViaFactory(address(token), address(nft), 1, "C", "C", address(0x9));

        nft.mintWithTokenId(director, 1);
        token.mint(director, 1 ether);
        vm.startPrank(director);
        token.approve(address(chamber), 1 ether);
        chamber.deposit(1 ether, director);
        chamber.delegate(1, 1 ether);
        vm.stopPrank();
        vm.roll(block.number + BoardTypes.SEATING_DELAY);
    }

    function _submit(address target, bytes memory data) internal {
        vm.prank(director);
        chamber.submitTransaction(1, target, 0, data, "", 0);
    }

    function test_ownershipCallsAreRejected() public {
        address admin = chamber.getProxyAdmin();
        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, admin, 0, abi.encodeWithSignature("transferOwnership(address)", director), "", 0);

        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, admin, 0, abi.encodeWithSignature("renounceOwnership()"), "", 0);

        assertEq(ProxyAdmin(admin).owner(), address(chamber));
        assertEq(chamber.getTransactionCount(), 0);
    }

    function test_upgradeToNonChamberIsRejected() public {
        address admin = chamber.getProxyAdmin();
        bytes memory data = abi.encodeCall(
            ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(address(chamber)), address(new NotAChamber()), "")
        );
        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, admin, 0, data, "", 0);
    }

    function test_upgradeToAnotherProxyIsRejected() public {
        address admin = chamber.getProxyAdmin();
        Chamber other = new Chamber();
        bytes memory data = abi.encodeCall(
            ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(address(other)), address(other), "")
        );
        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.submitTransaction(1, admin, 0, data, "", 0);
    }

    function test_upgradeToChamberIsAccepted() public {
        Chamber next = new Chamber();
        assertEq(next.CHAMBER_ID(), ChamberId.ID);
        assertEq(chamber.CHAMBER_ID(), ChamberId.ID);

        address admin = chamber.getProxyAdmin();
        bytes memory data = abi.encodeCall(
            ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(address(chamber)), address(next), "")
        );
        _submit(admin, data);
        assertEq(chamber.getTransactionCount(), 1);

        vm.prank(director);
        chamber.executeTransaction(1, 0, "");
        assertEq(chamber.VERSION(), bytes32("1.3.0"));
        assertEq(ProxyAdmin(admin).owner(), address(chamber));
    }

    function test_executeRechecksImplementation() public {
        Chamber next = new Chamber();
        address admin = chamber.getProxyAdmin();
        bytes memory data = abi.encodeCall(
            ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(address(chamber)), address(next), "")
        );
        _submit(admin, data);

        vm.etch(address(next), type(NotAChamber).runtimeCode);
        vm.prank(director);
        vm.expectRevert(IWallet.InvalidTarget.selector);
        chamber.executeTransaction(1, 0, "");

        (bool executed,,,,) = chamber.getTransaction(0);
        assertFalse(executed, "a changed implementation was upgraded");
        assertEq(chamber.VERSION(), bytes32("1.3.0"));
    }
}
