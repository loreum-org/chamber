// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
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
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract ChamberUpgradeTest is Test {
    Chamber public implementation;
    Chamber public newImplementation;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    IChamber public chamber;
    Chamber public chamberContract;
    address public chamberAddress;
    address public proxyAdminAddr;

    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    /// @dev Old `upgradeImplementation(address,bytes)` selector, removed in 1.3.0.
    bytes4 internal constant OLD_UPGRADE_SELECTOR = 0xc89311b6;

    /// @dev The only upgrade path since 1.3.0: a quorum transaction to the chamber's ProxyAdmin.
    function _upgradeCall(address impl) internal view returns (bytes memory) {
        return abi.encodeCall(ProxyAdmin.upgradeAndCall, (ITransparentUpgradeableProxy(chamberAddress), impl, ""));
    }

    function _impl() internal view returns (address) {
        return address(uint160(uint256(vm.load(chamberAddress, IMPL_SLOT))));
    }

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");

        // Deploy implementations
        implementation = new Chamber();
        newImplementation = new Chamber();

        chamberAddress = address(
            DeployChamber.deployViaFactory(
                address(token),
                address(nft),
                5, // seats
                "Chamber Token",
                "CHMB",
                admin
            )
        );
        chamber = IChamber(chamberAddress);
        proxyAdminAddr = chamber.getProxyAdmin();
        chamberContract = Chamber(payable(chamberAddress));

        // Setup users with NFTs and tokens
        _setupUsers();
    }

    function _setupUsers() internal {
        // Mint NFTs to users
        nft.mintWithTokenId(user1, 1);
        nft.mintWithTokenId(user2, 2);
        nft.mintWithTokenId(user3, 3);

        // Mint tokens and deposit to chamber
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
        vm.roll(block.number + 1);
    }

    function test_Chamber_GetProxyAdmin() public view {
        address proxyAdminAddress = chamber.getProxyAdmin();
        assertNotEq(proxyAdminAddress, address(0));

        // Verify it's a ProxyAdmin contract
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        assertEq(proxyAdmin.owner(), chamberAddress);
    }

    function test_Chamber_ProxyAdminOwnership_TransferredToChamber() public view {
        address proxyAdminAddress = chamber.getProxyAdmin();
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);

        // Verify chamber owns the ProxyAdmin
        assertEq(proxyAdmin.owner(), chamberAddress);
    }

    function test_Chamber_UpgradeViaTransaction() public {
        // Get current implementation from ERC1967 slot
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));

        // Encode upgrade call
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        // Submit upgrade transaction as director (user1 with tokenId 1)
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        // Get transaction ID
        uint256 txId = chamber.getTransactionCount() - 1;

        // Confirm by other directors to reach quorum (need 3 out of 5)
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);

        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        // Verify quorum reached
        (, uint8 confirmations,,,) = chamber.getTransaction(txId);
        assertGe(confirmations, chamber.getQuorum());

        // Execute upgrade transaction
        vm.prank(user1);
        chamber.executeTransaction(1, txId, upgradeData);

        // Verify implementation was upgraded
        address newImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(newImpl, address(newImplementation));
        assertNotEq(newImpl, currentImpl);
    }

    function test_Chamber_UpgradeViaTransaction_ForgottenCalldata_UsesStored() public {
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));

        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;
        assertEq(chamber.getTransactionCalldata(txId), upgradeData);

        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        // Execute without re-supplying the original bytes (logs / archives unavailable).
        vm.prank(user1);
        chamber.executeTransaction(1, txId, "");

        address newImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(newImpl, address(newImplementation));
        assertNotEq(newImpl, currentImpl);
    }

    function test_Chamber_UpgradeViaTransaction_WrongCalldata_Reverts() public {
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;

        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        bytes memory wrongData = _upgradeCall(address(implementation));

        vm.prank(user1);
        vm.expectRevert(IWallet.DataHashMismatch.selector);
        chamber.executeTransaction(1, txId, wrongData);
    }

    function test_Chamber_UpgradeViaTransaction_WithInitialization() public {
        // Create a new implementation with a different version
        Chamber v2Implementation = new Chamber();

        // Init data is forwarded by ProxyAdmin as a delegatecall into the new implementation.
        bytes memory upgradeData = abi.encodeCall(
            ProxyAdmin.upgradeAndCall,
            (
                ITransparentUpgradeableProxy(chamberAddress),
                address(v2Implementation),
                abi.encodeWithSignature("getSeats()")
            )
        );

        // Submit upgrade transaction
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;

        // Confirm by directors
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);

        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        // Execute upgrade
        vm.prank(user1);
        chamber.executeTransaction(1, txId, upgradeData);

        // Verify upgrade succeeded
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address newImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(newImpl, address(v2Implementation));
    }

    function test_Chamber_UpgradeViaTransaction_NonDirector_Reverts() public {
        address nonDirector = makeAddr("nonDirector");

        // Mint NFT to nonDirector but don't delegate, so they're not a director
        nft.mintWithTokenId(nonDirector, 999);

        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        // Non-director cannot submit upgrade transaction (tokenId 999 not in top seats)
        vm.prank(nonDirector);
        vm.expectRevert(IChamber.NotDirector.selector);
        chamber.submitTransaction(999, proxyAdminAddr, 0, upgradeData, "", 0);
    }

    function test_Chamber_UpgradeViaTransaction_InvalidSelector_Reverts() public {
        // Try to submit transaction to chamber with wrong selector
        bytes memory wrongData =
            abi.encodeWithSelector(bytes4(keccak256("wrongFunction()")), address(newImplementation));

        vm.prank(user1);
        vm.expectRevert(IChamber.InvalidTransaction.selector);
        chamber.submitTransaction(1, chamberAddress, 0, wrongData, "", 0);
    }

    function test_Chamber_UpgradeViaTransaction_NotEnoughConfirmations_Reverts() public {
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        // Submit upgrade transaction
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;

        // Try to execute without enough confirmations
        vm.prank(user1);
        vm.expectRevert(IChamber.NotEnoughConfirmations.selector);
        chamber.executeTransaction(1, txId, upgradeData);
    }

    function test_Chamber_UpgradeViaTransaction_ZeroImplementation_Reverts() public {
        bytes memory upgradeData = _upgradeCall(address(0));

        // Submit upgrade transaction
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;

        // Confirm by directors
        vm.prank(user2);
        chamber.confirmTransaction(2, txId);

        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        // ERC1967 rejects a zero implementation; the error is wrapped in TransactionFailed
        vm.prank(user1);
        vm.expectRevert(); // TransactionFailed with ZeroAddress error inside
        chamber.executeTransaction(1, txId, upgradeData);
    }

    /// Nobody but the chamber (via a quorum transaction) can drive its ProxyAdmin.
    function test_Chamber_UpgradeDirectly_Unauthorized_Reverts() public {
        address currentImpl = _impl();
        ProxyAdmin proxyAdmin = ProxyAdmin(chamber.getProxyAdmin());
        address outsider = makeAddr("outsider");

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        proxyAdmin.upgradeAndCall(ITransparentUpgradeableProxy(chamberAddress), address(newImplementation), "");

        // A director acting alone, outside the queue, is just another outsider here.
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        proxyAdmin.upgradeAndCall(ITransparentUpgradeableProxy(chamberAddress), address(newImplementation), "");

        assertEq(_impl(), currentImpl, "Implementation should remain unchanged");
    }

    function test_Chamber_UpgradePreservesState() public {
        // Store some state before upgrade
        uint256 initialSeats = chamber.getSeats();
        string memory initialName = chamber.name();
        string memory initialSymbol = chamber.symbol();
        address initialAsset = chamber.asset();
        address initialNft = address(chamberContract.nft());

        // Get user balances
        uint256 user1Balance = chamber.balanceOf(user1);
        uint256 user2Balance = chamber.balanceOf(user2);

        // Perform upgrade
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);

        uint256 txId = chamber.getTransactionCount() - 1;

        vm.prank(user2);
        chamber.confirmTransaction(2, txId);

        vm.prank(user3);
        chamber.confirmTransaction(3, txId);

        vm.prank(user1);
        chamber.executeTransaction(1, txId, upgradeData);

        // Verify state is preserved
        assertEq(chamber.getSeats(), initialSeats);
        assertEq(chamber.name(), initialName);
        assertEq(chamber.symbol(), initialSymbol);
        assertEq(chamber.asset(), initialAsset);
        assertEq(address(chamberContract.nft()), initialNft);
        assertEq(chamber.balanceOf(user1), user1Balance);
        assertEq(chamber.balanceOf(user2), user2Balance);
    }

    function test_Chamber_UpgradeBatchTransactions() public {
        // Create two new implementations
        Chamber impl1 = new Chamber();
        Chamber impl2 = new Chamber();

        // Prepare upgrade data for both
        bytes[] memory upgradeDataArray = new bytes[](2);
        upgradeDataArray[0] = _upgradeCall(address(impl1));
        upgradeDataArray[1] = _upgradeCall(address(impl2));

        address[] memory targets = new address[](2);
        targets[0] = proxyAdminAddr;
        targets[1] = proxyAdminAddr;

        uint256[] memory values = new uint256[](2);
        values[0] = 0;
        values[1] = 0;

        // Submit batch transactions
        vm.prank(user1);
        chamber.submitBatchTransactions(1, targets, values, upgradeDataArray);

        // Confirm both transactions
        uint256[] memory txIds = new uint256[](2);
        txIds[0] = chamber.getTransactionCount() - 2;
        txIds[1] = chamber.getTransactionCount() - 1;

        vm.prank(user2);
        chamber.confirmBatchTransactions(2, txIds);

        vm.prank(user3);
        chamber.confirmBatchTransactions(3, txIds);

        // Execute first upgrade
        uint256[] memory firstTx = new uint256[](1);
        firstTx[0] = txIds[0];
        bytes[] memory firstData = new bytes[](1);
        firstData[0] = upgradeDataArray[0];
        vm.prank(user1);
        chamber.executeBatchTransactions(1, firstTx, firstData);

        // Verify first upgrade
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address impl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(impl, address(impl1));

        // Execute second upgrade
        uint256[] memory secondTx = new uint256[](1);
        secondTx[0] = txIds[1];
        bytes[] memory secondData = new bytes[](1);
        secondData[0] = upgradeDataArray[1];
        vm.prank(user1);
        chamber.executeBatchTransactions(1, secondTx, secondData);

        // Verify second upgrade
        impl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));
        assertEq(impl, address(impl2));
    }

    /**
     * @notice Once the board hands ProxyAdmin ownership away, the chamber can no longer upgrade itself.
     *   1. Transfer ProxyAdmin ownership to an external address via governance tx.
     *   2. Queue an upgrade to ProxyAdmin; executing it reverts (ProxyAdmin `onlyOwner`), wrapped as
     *      TransactionFailed. ProxyAdmin has no checks beyond ownership; the board owns that decision.
     */
    function test_Chamber_UpgradeImplementation_NotProxyAdminOwner_Reverts() public {
        address proxyAdminAddress = chamber.getProxyAdmin();

        // Step 1: Submit a governance tx that transfers ProxyAdmin ownership away from chamber
        bytes memory transferData = abi.encodeWithSignature("transferOwnership(address)", address(0xDEAD));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddress, 0, transferData, "", 0);
        uint256 transferTxId = chamber.getTransactionCount() - 1;

        vm.prank(user2);
        chamber.confirmTransaction(2, transferTxId);
        vm.prank(user3);
        chamber.confirmTransaction(3, transferTxId);
        vm.prank(user1);
        chamber.executeTransaction(1, transferTxId, transferData);

        // Verify ProxyAdmin owner is now 0xDEAD
        assertEq(ProxyAdmin(proxyAdminAddress).owner(), address(0xDEAD));

        // Step 2: Submit an upgrade transaction to the ProxyAdmin the chamber no longer owns
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);
        uint256 upgradeTxId = chamber.getTransactionCount() - 1;

        vm.prank(user2);
        chamber.confirmTransaction(2, upgradeTxId);
        vm.prank(user3);
        chamber.confirmTransaction(3, upgradeTxId);

        // Step 3: Execute — ProxyAdmin rejects the chamber (not owner) → wrapped as TransactionFailed
        vm.prank(user1);
        vm.expectRevert();
        chamber.executeTransaction(1, upgradeTxId, upgradeData);
    }

    /// (2) Below quorum an upgrade cannot execute: 2 of the 3 required confirmations.
    function test_Chamber_UpgradeViaProxyAdmin_SubQuorum_CannotUpgrade() public {
        address currentImpl = _impl();
        bytes memory upgradeData = _upgradeCall(address(newImplementation));

        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;

        // Only the submitter's confirmation: one short of quorum.
        (, uint8 confirmations,,,) = chamber.getTransaction(txId);
        assertGt(confirmations, 0);
        assertLt(confirmations, chamber.getQuorum());

        vm.prank(user1);
        vm.expectRevert(IChamber.NotEnoughConfirmations.selector);
        chamber.executeTransaction(1, txId, "");
        assertEq(_impl(), currentImpl);
    }

    /// (1) + L-04: the ProxyAdmin upgrade's calldata is stored onchain, so any director can
    /// execute it with empty `data`, and the new implementation is live afterwards.
    function test_Chamber_UpgradeViaProxyAdmin_StoresCalldataAndGoesLive() public {
        bytes memory upgradeData = _upgradeCall(address(newImplementation));
        vm.prank(user1);
        chamber.submitTransaction(1, proxyAdminAddr, 0, upgradeData, "", 0);
        uint256 txId = chamber.getTransactionCount() - 1;
        assertEq(chamber.getTransactionCalldata(txId), upgradeData);

        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);
        vm.prank(user3);
        chamber.executeTransaction(3, txId, "");

        assertEq(_impl(), address(newImplementation));
        assertEq(chamberContract.VERSION(), bytes32("1.3.0"));
        assertEq(ProxyAdmin(chamber.getProxyAdmin()).owner(), chamberAddress, "ProxyAdmin stays with the chamber");
    }

    /// (4) The removed `upgradeImplementation` selector: a direct call (no ETH) lands in the strict
    /// fallback and reverts; a self-call proposal is rejected at submit by the self-call allowlist;
    /// with ETH attached the fallback accepts the ETH and does nothing else.
    function test_Chamber_OldUpgradeSelector_Pinned() public {
        address currentImpl = _impl();
        bytes memory oldCall = abi.encodeWithSelector(OLD_UPGRADE_SELECTOR, address(newImplementation), "");

        (bool ok, bytes memory ret) = chamberAddress.call(oldCall);
        assertFalse(ok);
        assertEq(bytes4(ret), IChamber.InvalidTransaction.selector);

        vm.prank(chamberAddress);
        (ok, ret) = chamberAddress.call(oldCall);
        assertFalse(ok);
        assertEq(bytes4(ret), IChamber.InvalidTransaction.selector);

        vm.prank(user1);
        vm.expectRevert(IChamber.InvalidTransaction.selector);
        chamber.submitTransaction(1, chamberAddress, 0, oldCall, "", 0);

        vm.deal(address(this), 1 ether);
        (ok,) = chamberAddress.call{value: 1 ether}(oldCall);
        assertTrue(ok);
        assertEq(_impl(), currentImpl, "no upgrade through the old selector");
    }
}
