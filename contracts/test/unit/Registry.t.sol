// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {Clones} from "lib/openzeppelin-contracts/contracts/proxy/Clones.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/// @dev Mock chamber that returns address(0) for getProxyAdmin() to trigger defensive check
contract ZeroProxyAdminChamber {
    function initialize(address, address, uint256, string calldata, string calldata) external {}

    function getProxyAdmin() external pure returns (address) {
        return address(0);
    }
}

contract RegistryTest is Test {
    event ChamberImplementationUpdated(address indexed previousImplementation, address indexed newImplementation);

    Registry public registry;
    Chamber public implementation;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");

        implementation = new Chamber();
        registry = DeployRegistry.deploy(admin);
    }

    function test_Registry_Initialize() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), admin));
    }

    function test_Registry_Initialize_ZeroAdmin_Reverts() public {
        address payable proxy = payable(Clones.clone(address(new Registry())));
        Registry proxyRegistry = Registry(proxy);

        vm.expectRevert(Registry.ZeroAddress.selector);
        proxyRegistry.initialize(address(implementation), address(0));
    }

    function test_Registry_Initialize_ZeroImplementation_Reverts() public {
        address payable proxy = payable(Clones.clone(address(new Registry())));
        Registry proxyRegistry = Registry(proxy);

        vm.expectRevert(Registry.ZeroAddress.selector);
        proxyRegistry.initialize(address(0), admin);
    }

    function test_Registry_CreateChamber() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        assertTrue(registry.isChamber(chamber));
        assertEq(registry.getChamberCount(), 1);

        address[] memory chambers = registry.getAllChambers();
        assertEq(chambers.length, 1);
        assertEq(chambers[0], chamber);
    }

    function test_Registry_CreateChamber_ZeroERC20_Reverts() public {
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.createChamber(address(0), address(nft), 5, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_ZeroERC721_Reverts() public {
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.createChamber(address(token), address(0), 5, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_ZeroSeats_Reverts() public {
        vm.expectRevert(Registry.InvalidSeats.selector);
        registry.createChamber(address(token), address(nft), 0, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_TooManySeats_Reverts() public {
        vm.expectRevert(Registry.InvalidSeats.selector);
        registry.createChamber(address(token), address(nft), 21, "Chamber Token", "CHMB");
    }

    function test_Registry_GetChambers_Pagination() public {
        for (uint256 i = 0; i < 5; i++) {
            registry.createChamber(
                address(token),
                address(nft),
                5,
                string.concat("Chamber Token ", vm.toString(i)),
                string.concat("CHMB", vm.toString(i))
            );
        }

        address[] memory chambers = registry.getChambers(2, 1);
        assertEq(chambers.length, 2);
        assertTrue(registry.isChamber(chambers[0]));
        assertTrue(registry.isChamber(chambers[1]));

        chambers = registry.getChambers(2, 5);
        assertEq(chambers.length, 0);

        chambers = registry.getChambers(3, 3);
        assertEq(chambers.length, 2);
    }

    function test_Registry_IsChamber_False() public view {
        assertFalse(registry.isChamber(address(0x1234)));
    }

    function test_Registry_GetAllChambers_Empty() public view {
        address[] memory chambers = registry.getAllChambers();
        assertEq(chambers.length, 0);
    }

    function test_Registry_GetChamberCount_Empty() public view {
        assertEq(registry.getChamberCount(), 0);
    }

    function test_Registry_CreateChamber_UsesTransparentProxy() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(chamber)
        }
        assertGt(codeSize, 0);
        assertTrue(registry.isChamber(chamber));
    }

    function test_Registry_CreateChamber_ProxyAdminOwnership() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        address proxyAdminAddress = IChamber(chamber).getProxyAdmin();
        assertNotEq(proxyAdminAddress, address(0));

        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        assertEq(proxyAdmin.owner(), chamber);
    }

    function test_Registry_CreateChamber_ChamberIsInitialized() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        IChamber chamberContract = IChamber(chamber);
        Chamber chamberImpl = Chamber(payable(chamber));

        assertEq(chamberContract.name(), "Chamber Token");
        assertEq(chamberContract.symbol(), "CHMB");
        assertEq(chamberContract.getSeats(), 5);
        assertEq(chamberContract.asset(), address(token));
        assertEq(address(chamberImpl.nft()), address(nft));
    }

    function test_Registry_Getters() public view {
        assertNotEq(registry.implementation(), address(0));
        assertEq(registry.proxyAdmin(), admin);
    }

    function test_Registry_GetChambersByAsset() public {
        address chamber1 = registry.createChamber(address(token), address(nft), 5, "C1", "C1");
        address chamber2 = registry.createChamber(address(token), address(nft), 3, "C2", "C2");

        address[] memory byChambers = registry.getChambersByAsset(address(token));
        assertEq(byChambers.length, 2);
        assertEq(byChambers[0], chamber1);
        assertEq(byChambers[1], chamber2);
    }

    function test_Registry_GetAssets() public {
        assertEq(registry.getAssets().length, 0);

        registry.createChamber(address(token), address(nft), 5, "C1", "C1");

        address[] memory assets = registry.getAssets();
        assertEq(assets.length, 1);
        assertEq(assets[0], address(token));
    }

    function test_Registry_GetAssets_NoDuplicates() public {
        registry.createChamber(address(token), address(nft), 5, "C1", "C1");
        registry.createChamber(address(token), address(nft), 3, "C2", "C2");

        address[] memory assets = registry.getAssets();
        assertEq(assets.length, 1);
    }

    function test_Registry_SubChamber_ParentChild() public {
        address payable parent = registry.createChamber(address(token), address(nft), 5, "Parent", "PAR");

        MockERC721 nft2 = new MockERC721("NFT2", "NFT2");
        address payable child = registry.createChamber(parent, address(nft2), 3, "Child", "CHLD");

        assertEq(registry.getParentChamber(child), parent);

        address[] memory children = registry.getChildChambers(parent);
        assertEq(children.length, 1);
        assertEq(children[0], child);
    }

    function test_Registry_GetParentChamber_None() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "C1", "C1");
        assertEq(registry.getParentChamber(chamber), address(0));
    }

    function test_Registry_GetChildChambers_None() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "C1", "C1");
        assertEq(registry.getChildChambers(chamber).length, 0);
    }

    function test_Registry_CreateChamber_ZeroImplementationAfterInit_Reverts() public {
        bytes32 baseSlot = 0xf6315592a63ddf317bd8b41aa1ba894c04251b3cfbd8a95258342cd83f2a4600;
        vm.store(address(registry), baseSlot, bytes32(0));

        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.createChamber(address(token), address(nft), 5, "C", "C");
    }

    function test_Registry_TransferChamberAdmin_ZeroProxyAdmin_Reverts() public {
        ZeroProxyAdminChamber badChamberImpl = new ZeroProxyAdminChamber();

        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(new Registry()),
            address(pa),
            abi.encodeWithSelector(Registry.initialize.selector, address(badChamberImpl), address(this))
        );
        Registry reg2 = Registry(address(proxy));

        vm.expectRevert(Registry.ZeroAddress.selector);
        reg2.createChamber(address(token), address(nft), 5, "C", "C");
    }

    /// @dev ERC-1967 implementation slot (OpenZeppelin `ERC1967Utils.IMPLEMENTATION_SLOT`)
    bytes32 internal constant _ERC1967_IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function _proxyImplementation(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, _ERC1967_IMPL_SLOT))));
    }

    function test_Registry_SetChamberImplementation_UpdatesPointer() public {
        Chamber newImpl = new Chamber();
        address prev = registry.implementation();

        vm.expectEmit(true, true, false, false);
        emit ChamberImplementationUpdated(prev, address(newImpl));

        vm.prank(admin);
        registry.setChamberImplementation(address(newImpl));

        assertEq(registry.implementation(), address(newImpl));
    }

    function test_Registry_SetChamberImplementation_NewChamberUsesPointer() public {
        Chamber newImpl = new Chamber();
        vm.prank(admin);
        registry.setChamberImplementation(address(newImpl));

        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");
        assertEq(_proxyImplementation(chamber), address(newImpl));
    }

    function test_Registry_SetChamberImplementation_SameImplementation_NoEmit() public {
        address curr = registry.implementation();
        vm.recordLogs();

        vm.prank(admin);
        registry.setChamberImplementation(curr);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 0);
    }

    function test_Registry_SetChamberImplementation_Zero_Reverts() public {
        vm.prank(admin);
        vm.expectRevert(Registry.ZeroAddress.selector);
        registry.setChamberImplementation(address(0));
    }

    function test_Registry_SetChamberImplementation_NotAdmin_Reverts() public {
        Chamber newImpl = new Chamber();
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert();
        registry.setChamberImplementation(address(newImpl));
    }
}
