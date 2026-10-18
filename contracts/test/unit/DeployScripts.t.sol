// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, Vm} from "forge-std/Test.sol";
import {Chamber} from "src/Chamber.sol";
import {Factory} from "src/Factory.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber as DeployChamberLib} from "test/utils/DeployChamber.sol";
import {DeployFactory} from "script/DeployFactory.s.sol";
import {DeployChamber as DeployChamberScript} from "script/Chamber.s.sol";
import {DeployChamberImplementation} from "script/DeployChamberImplementation.s.sol";
import {DeployRegistry as RegistryScript} from "script/Registry.s.sol";
import {ScriptDeploy} from "script/ScriptDeploy.sol";
import {Registry} from "src/Registry.sol";
import {ProposeChamberUpgrade, ChamberUpgradeCalldata} from "script/ProposeChamberUpgrade.s.sol";

/// @dev Runs the deploy and upgrade scripts in-process (simulation, no RPC, no broadcast to any network).
contract DeployScriptsTest is Test {
    bytes32 internal constant IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes4 internal constant UPGRADE_AND_CALL = 0x9623609d;

    MockERC20 internal token;
    MockERC721 internal nft;
    address internal admin = makeAddr("factoryAdmin");
    address internal user2 = makeAddr("user2");
    address internal user3 = makeAddr("user3");
    /// @dev Director 1 is the default broadcaster, so `propose(..., doSubmit=true)` submits as a director.
    address internal user1 = DEFAULT_SENDER;

    function setUp() public {
        token = new MockERC20("Test", "TST", 0);
        nft = new MockERC721("NFT", "NFT");
    }

    function _impl(address chamber) internal view returns (address) {
        return address(uint160(uint256(vm.load(chamber, IMPL_SLOT))));
    }

    function _seat(Chamber chamber, address user, uint256 tokenId) internal {
        nft.mintWithTokenId(user, tokenId);
        token.mint(user, 1000e18);
        vm.startPrank(user);
        token.approve(address(chamber), 1000e18);
        chamber.deposit(1000e18, user);
        chamber.delegate(tokenId, 1000e18);
        vm.stopPrank();
    }

    function _boardChamber() internal returns (Chamber chamber) {
        chamber = new DeployChamberScript().deployWith(address(token), address(nft), admin);
        _seat(chamber, user1, 1);
        _seat(chamber, user2, 2);
        _seat(chamber, user3, 3);
        vm.roll(block.number + 1); // seating delay
    }

    // ---------------------------------------------------------------- fresh deploy

    function test_DeployFactoryScript_FreshChamber_OwnershipWiring() public {
        Factory factory = new DeployFactory().run();
        address impl = factory.implementation();
        assertGt(impl.code.length, 0, "implementation deployed");

        address chamber = factory.createChamber(address(token), address(nft), 5, "C", "C");
        ProxyAdmin proxyAdmin = ProxyAdmin(IChamber(chamber).getProxyAdmin());

        assertEq(proxyAdmin.owner(), chamber, "ProxyAdmin owned by the chamber");
        assertTrue(proxyAdmin.owner() != address(factory), "Factory keeps no upgrade rights");
        assertTrue(proxyAdmin.owner() != factory.owner(), "Factory admin keeps no upgrade rights");
        assertEq(_impl(chamber), impl, "proxy points at the Factory implementation");
        assertEq(Chamber(payable(chamber)).VERSION(), bytes32("1.3.0"));
    }

    function test_ChamberScript_UsesFactoryPath_ChamberOwnsProxyAdmin() public {
        Chamber chamber = new DeployChamberScript().deployWith(address(token), address(nft), admin);
        address proxyAdmin = chamber.getProxyAdmin();
        assertEq(ProxyAdmin(proxyAdmin).owner(), address(chamber));
        assertTrue(ProxyAdmin(proxyAdmin).owner() != admin, "admin EOA must not own upgrades");
        assertEq(chamber.getSeats(), 5);
    }

    function test_RegistryScript_Runs() public {
        new RegistryScript().run();
    }

    function test_ScriptDeploy_Registry_InitializedWithChamberImplementation() public {
        Registry registry = ScriptDeploy.deployRegistry(admin);
        address impl = registry.implementation();
        assertGt(impl.code.length, 0);
        assertEq(Chamber(payable(impl)).VERSION(), bytes32("1.3.0"));
    }

    function test_DeployChamberImplementationScript() public {
        address impl = new DeployChamberImplementation().run();
        assertGt(impl.code.length, 0);
        assertLe(impl.code.length, 24_576, "EIP-170");
        assertEq(Chamber(payable(impl)).VERSION(), bytes32("1.3.0"));
        // Bare implementation cannot be initialized (initializers disabled).
        vm.expectRevert();
        Chamber(payable(impl)).initialize(address(token), address(nft), 5, "X", "X");
    }

    // ---------------------------------------------------------------- upgrade path

    function test_UpgradeCalldata_TargetsProxyAdminUpgradeAndCall() public {
        Chamber chamber = new DeployChamberScript().deployWith(address(token), address(nft), admin);
        address impl = address(new Chamber());
        bytes memory init = hex"1234";
        (address target, bytes memory data) = ChamberUpgradeCalldata.build(address(chamber), impl, init);

        assertEq(target, chamber.getProxyAdmin());
        assertEq(bytes4(data), UPGRADE_AND_CALL);
        bytes memory args = new bytes(data.length - 4);
        for (uint256 i; i < args.length; ++i) {
            args[i] = data[i + 4];
        }
        (address proxy, address decodedImpl, bytes memory decodedInit) = abi.decode(args, (address, address, bytes));
        assertEq(proxy, address(chamber));
        assertEq(decodedImpl, impl);
        assertEq(decodedInit, init);
    }

    /// @dev Script-built calldata, submitted by the script, confirmed to quorum, executed with empty data.
    function test_ProposeScript_QuorumExecutesUpgrade() public {
        Chamber chamber = _boardChamber();
        uint256 assetsBefore = chamber.totalAssets();
        address newImpl = new DeployChamberImplementation().run();
        ProposeChamberUpgrade script = new ProposeChamberUpgrade();

        uint256 txId = script.propose(address(chamber), newImpl, "", 1, "ipfs://upgrade", true);
        assertEq(txId, chamber.getTransactionCount() - 1);
        (, bytes memory expected) = ChamberUpgradeCalldata.build(address(chamber), newImpl, "");
        assertEq(chamber.getTransactionCalldata(txId), expected, "calldata stored onchain");

        vm.prank(user2);
        chamber.confirmTransaction(2, txId);
        vm.prank(user3);
        chamber.confirmTransaction(3, txId);
        vm.prank(user3);
        chamber.executeTransaction(3, txId, "");

        assertEq(_impl(address(chamber)), newImpl, "new implementation live");
        assertEq(ProxyAdmin(chamber.getProxyAdmin()).owner(), address(chamber), "ProxyAdmin stays with the chamber");
        assertEq(chamber.totalAssets(), assetsBefore, "state preserved");
        assertEq(chamber.getSeats(), 5);
    }

    function test_ProposeScript_DryRunSubmitsNothing() public {
        Chamber chamber = _boardChamber();
        uint256 countBefore = chamber.getTransactionCount();
        uint256 txId = new ProposeChamberUpgrade().propose(address(chamber), address(new Chamber()), "", 1, "", false);
        assertEq(txId, type(uint256).max);
        assertEq(chamber.getTransactionCount(), countBefore);
    }

    function test_ProposeScript_SubQuorumCannotUpgrade() public {
        Chamber chamber = _boardChamber();
        address oldImpl = _impl(address(chamber));
        address newImpl = address(new Chamber());
        uint256 txId = new ProposeChamberUpgrade().propose(address(chamber), newImpl, "", 1, "", true);

        vm.prank(user1);
        vm.expectRevert(IChamber.NotEnoughConfirmations.selector);
        chamber.executeTransaction(1, txId, "");
        assertEq(_impl(address(chamber)), oldImpl);
    }

    function test_ProposeScript_Preflight_RejectsEoaOwnedProxyAdmin() public {
        // A bare proxy whose ProxyAdmin is an EOA's: the board could never execute an upgrade.
        Chamber bare = DeployChamberLib.deploy(address(token), address(nft), 5, "B", "B", admin);
        ProposeChamberUpgrade script = new ProposeChamberUpgrade();
        address impl = address(new Chamber());
        vm.expectRevert(
            bytes(
                "ProxyAdmin is not owned by the chamber; the board cannot upgrade it (not a Factory-created chamber?)"
            )
        );
        script.preflight(address(bare), impl);
    }

    function test_ProposeScript_Preflight_RejectsBadImplementations() public {
        Chamber chamber = new DeployChamberScript().deployWith(address(token), address(nft), admin);
        ProposeChamberUpgrade script = new ProposeChamberUpgrade();

        vm.expectRevert(bytes("zero implementation"));
        script.preflight(address(chamber), address(0));
        vm.expectRevert(bytes("implementation has no code"));
        script.preflight(address(chamber), makeAddr("eoa"));
        address current = _impl(address(chamber));
        vm.expectRevert(bytes("chamber already runs this implementation"));
        script.preflight(address(chamber), current);
        vm.expectRevert(bytes("implementation has no VERSION(); not a Chamber build?"));
        script.preflight(address(chamber), address(token));
    }

    /// @dev No deploy/upgrade script may use the removed `upgradeImplementation` path.
    function test_NoScriptUsesRemovedUpgradeImplementation() public view {
        Vm.DirEntry[] memory entries = vm.readDir("script");
        uint256 checked;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].isDir) continue;
            string memory raw = vm.readFile(entries[i].path);
            assertFalse(_contains(raw, "upgradeImplementation"), entries[i].path);
            assertFalse(_contains(raw, "c89311b6"), entries[i].path);
            ++checked;
        }
        assertGt(checked, 10);
    }

    function test_UpgradeScriptsGateMainnetBroadcast() public view {
        assertTrue(_contains(vm.readFile("script/ProposeChamberUpgrade.s.sol"), "revertIfBroadcastBlocked"));
        assertTrue(_contains(vm.readFile("script/DeployChamberImplementation.s.sol"), "revertIfBroadcastBlocked"));
        assertTrue(_contains(vm.readFile("script/Chamber.s.sol"), "revertIfBroadcastBlocked"));
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
