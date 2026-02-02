// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {Clones} from "lib/openzeppelin-contracts/contracts/proxy/Clones.sol";

contract RegistryTest is Test {
    Registry public registry;
    Chamber public implementation;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");

        // Deploy implementation
        implementation = new Chamber();

        // Deploy and initialize registry
        registry = DeployRegistry.deploy(admin);
        vm.prank(admin);
    }

    function test_Registry_Initialize() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), admin));
    }

    function test_Registry_Initialize_ZeroAdmin_Reverts() public {
        // Use a minimal proxy to test initialization with zero admin
        address payable proxy = payable(Clones.clone(address(new Registry())));
        Registry proxyRegistry = Registry(proxy);

        vm.expectRevert(Registry.ZeroAddress.selector);
        proxyRegistry.initialize(address(implementation), address(0));
    }

    function test_Registry_Initialize_ZeroImplementation_Reverts() public {
        // Use a minimal proxy to test initialization with zero implementation
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
        // Create 5 chambers
        for (uint256 i = 0; i < 5; i++) {
            registry.createChamber(
                address(token),
                address(nft),
                5,
                string.concat("Chamber Token ", vm.toString(i)),
                string.concat("CHMB", vm.toString(i))
            );
        }

        // Test pagination
        address[] memory chambers = registry.getChambers(2, 1);
        assertEq(chambers.length, 2);
        assertTrue(registry.isChamber(chambers[0]));
        assertTrue(registry.isChamber(chambers[1]));

        // Test with skip >= total
        chambers = registry.getChambers(2, 5);
        assertEq(chambers.length, 0);

        // Test with remaining < limit
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

        // Verify it's a proxy by checking code size (proxies have different code)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(chamber)
        }
        assertGt(codeSize, 0);

        // Verify chamber is registered
        assertTrue(registry.isChamber(chamber));
    }

    function test_Registry_CreateChamber_ProxyAdminOwnership() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        // Get ProxyAdmin address from chamber
        address proxyAdminAddress = IChamber(chamber).getProxyAdmin();
        assertNotEq(proxyAdminAddress, address(0));

        // Verify ProxyAdmin ownership was transferred to chamber
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        assertEq(proxyAdmin.owner(), chamber);
    }

    function test_Registry_CreateChamber_ChamberIsInitialized() public {
        address chamber = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");

        IChamber chamberContract = IChamber(chamber);
        Chamber chamberImpl = Chamber(payable(chamber));

        // Verify chamber is initialized
        assertEq(chamberContract.name(), "Chamber Token");
        assertEq(chamberContract.symbol(), "CHMB");
        assertEq(chamberContract.getSeats(), 5);
        assertEq(chamberContract.asset(), address(token));
        assertEq(address(chamberImpl.nft()), address(nft));
    }
}
