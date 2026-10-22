// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @notice L-04: self-call and ProxyAdmin (upgrade) calldata is stored onchain so execution does not depend on logs.
contract FindingL04UpgradeCalldataLivenessTest is Test {
    Registry public registry;
    Chamber public newImplementation;
    MockERC20 public token;
    MockERC721 public nft;

    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    IChamber public chamber;
    address public chamberAddress;
    address public proxyAdminAddr;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        newImplementation = new Chamber();
        chamberAddress =
            address(DeployChamber.deployViaFactory(address(token), address(nft), 5, "Chamber Token", "CHMB", admin));
        chamber = IChamber(chamberAddress);
        proxyAdminAddr = chamber.getProxyAdmin();

        _setupDirectors();
        vm.roll(block.number + 1);
    }

    function _setupDirectors() internal {
        nft.mintWithTokenId(user1, 1);
        nft.mintWithTokenId(user2, 2);
        nft.mintWithTokenId(user3, 3);

        uint256 amount = 1000e18;
        token.mint(user1, amount);
        token.mint(user2, amount);
        token.mint(user3, amount);

        vm.startPrank(user1);
        token.approve(chamberAddress, amount);
        chamber.deposit(amount, user1);
        chamber.delegate(1, amount);
        vm.stopPrank();

        vm.startPrank(user2);
        token.approve(chamberAddress, amount);
        chamber.deposit(amount, user2);
        chamber.delegate(2, amount);
        vm.stopPrank();

        vm.startPrank(user3);
        token.approve(chamberAddress, amount);
        chamber.deposit(amount, user3);
        chamber.delegate(3, amount);
        vm.stopPrank();
    }

    function _upgradeCall(address impl) internal view returns (bytes memory) {
        return abi.encodeCall(ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(chamberAddress), impl, ""));
    }

    function _reachQuorum(uint256 txId) internal {
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);
    }

    function test_L04_UpgradeExecutesWithoutResuppliedCalldata() public {
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));

        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;

        assertEq(chamber.getTransactionCalldata(txId), upgradeData);
        (,,,, bytes32 dataHash) = chamber.getTransaction(txId);
        assertEq(dataHash, keccak256(upgradeData));

        _reachQuorum(txId);

        vm.prank(user1);
        chamber.executeTransaction(1, txId, "");

        address upgraded = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(upgraded, address(newImplementation));
        assertNotEq(upgraded, currentImpl);
    }

    function test_L04_BatchUpgradeExecutesWithoutResuppliedCalldata() public {
        Chamber impl1 = new Chamber();
        bytes[] memory upgradeDataArray = new bytes[](1);
        upgradeDataArray[0] = _upgradeCall(address(impl1));

        address[] memory targets = new address[](1);
        targets[0] = proxyAdminAddr;
        uint256[] memory values = new uint256[](1);

        vm.prank(user1);
        chamber.submitBatchTransactions(1, targets, values, upgradeDataArray);

        uint256 txId = chamber.getTransactionCount() - 1;
        assertEq(chamber.getTransactionCalldata(txId), upgradeDataArray[0]);
        _reachQuorum(txId);

        uint256[] memory txIds = new uint256[](1);
        txIds[0] = txId;
        bytes[] memory emptyData = new bytes[](1);

        vm.prank(user1);
        chamber.executeBatchTransactions(1, txIds, emptyData);

        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address upgraded = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(upgraded, address(impl1));
    }

    function test_L04_NormalTreasuryTxStillHashChecks() public {
        address recipient = address(0x1234);
        bytes memory transferData = abi.encodeWithSignature("transfer(address,uint256)", recipient, 1e18);

        vm.prank(user1);
        chamber.submitTransaction(1, address(token), 0, transferData, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;

        assertEq(chamber.getTransactionCalldata(txId).length, 0);
        _reachQuorum(txId);

        vm.prank(user1);
        vm.expectRevert(IWallet.DataHashMismatch.selector);
        chamber.executeTransaction(1, txId, "");

        vm.prank(user1);
        vm.expectRevert(IWallet.DataHashMismatch.selector);
        chamber.executeTransaction(1, txId, hex"cafebabe");

        vm.prank(user1);
        chamber.executeTransaction(1, txId, transferData);

        (bool executed,,,,) = chamber.getTransaction(txId);
        assertTrue(executed);
        assertEq(token.balanceOf(recipient), 1e18);
    }
}
