// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {Clones} from "lib/openzeppelin-contracts/contracts/proxy/Clones.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Agent} from "src/Agent.sol";

/// @dev Minimal agent implementation where getProxyAdmin() always reverts
contract RevertingAgentImpl {
    bool private _initialized;

    function initialize(address, address, address) external {
        _initialized = true;
    }

    function getProxyAdmin() external pure returns (address) {
        revert("Simulated ProxyAdmin failure");
    }
}

/// @dev Mock chamber that returns address(0) for getProxyAdmin() to trigger defensive check
contract ZeroProxyAdminChamber {
    function initialize(address, address, uint256, string calldata, string calldata) external {}

    function getProxyAdmin() external pure returns (address) {
        return address(0);
    }
}

contract ChamberRegistryTest is Test {
    ChamberRegistry public registry;
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

        // Grant REGISTRAR_ROLE to registry so createAgent can register identities
        vm.startPrank(admin);
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));
        vm.stopPrank();
    }

    function test_Registry_Initialize() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.ADMIN_ROLE(), admin));
    }

    function test_Registry_Initialize_ZeroAdmin_Reverts() public {
        // Use a minimal proxy to test initialization with zero admin
        address payable proxy = payable(Clones.clone(address(new ChamberRegistry())));
        ChamberRegistry proxyRegistry = ChamberRegistry(proxy);

        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        proxyRegistry.initialize(address(implementation), address(0), address(0), address(0));
    }

    function test_Registry_Initialize_ZeroImplementation_Reverts() public {
        // Use a minimal proxy to test initialization with zero implementation
        address payable proxy = payable(Clones.clone(address(new ChamberRegistry())));
        ChamberRegistry proxyRegistry = ChamberRegistry(proxy);

        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        proxyRegistry.initialize(address(0), address(0), address(0), admin);
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
        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        registry.createChamber(address(0), address(nft), 5, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_ZeroERC721_Reverts() public {
        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        registry.createChamber(address(token), address(0), 5, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_ZeroSeats_Reverts() public {
        vm.expectRevert(ChamberRegistry.InvalidSeats.selector);
        registry.createChamber(address(token), address(nft), 0, "Chamber Token", "CHMB");
    }

    function test_Registry_CreateChamber_TooManySeats_Reverts() public {
        vm.expectRevert(ChamberRegistry.InvalidSeats.selector);
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

    // ─── Registry getters ──────────────────────────────────────────────

    function test_Registry_Getters() public view {
        assertNotEq(registry.implementation(), address(0));
        assertNotEq(registry.agentImplementation(), address(0));
        assertNotEq(registry.agentIdentityRegistry(), address(0));
        // proxyAdmin is set to admin in DeployRegistry
        assertEq(registry.proxyAdmin(), admin);
    }

    // ─── createAgent ───────────────────────────────────────────────────

    function test_Registry_CreateAgent() public {
        address payable agentAddr = registry.createAgent(admin, address(0), "ipfs://meta");
        assertNotEq(agentAddr, address(0));
        assertTrue(registry.isAgent(agentAddr));
    }

    function test_Registry_CreateAgent_WithoutIdentityRegistry() public {
        // Deploy a registry with no agentIdentityRegistry
        ChamberRegistry reg2Impl = new ChamberRegistry();
        Chamber chamberImpl2 = new Chamber();

        // Reuse existing AgentImpl from deployed registry
        address agentImplAddr = registry.agentImplementation();

        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(reg2Impl),
            address(pa),
            abi.encodeWithSelector(
                ChamberRegistry.initialize.selector,
                address(chamberImpl2),
                agentImplAddr,
                address(0), // no identity registry
                address(this)
            )
        );
        ChamberRegistry reg2 = ChamberRegistry(address(proxy));

        // createAgent should work without registering identity
        address payable agentAddr = reg2.createAgent(admin, address(0), "ipfs://meta");
        assertNotEq(agentAddr, address(0));
        assertTrue(reg2.isAgent(agentAddr));
    }

    function test_Registry_CreateAgent_ZeroOwner_Reverts() public {
        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        registry.createAgent(address(0), address(0), "ipfs://meta");
    }

    // ─── isAgent ───────────────────────────────────────────────────────

    function test_Registry_IsAgent_True() public {
        address payable agentAddr = registry.createAgent(admin, address(0), "ipfs://meta");
        assertTrue(registry.isAgent(agentAddr));
    }

    function test_Registry_IsAgent_False() public view {
        assertFalse(registry.isAgent(address(0xDEAD)));
    }

    // ─── getAllAgents ───────────────────────────────────────────────────

    function test_Registry_GetAllAgents() public {
        assertEq(registry.getAllAgents().length, 0);

        registry.createAgent(admin, address(0), "ipfs://meta1");
        registry.createAgent(admin, address(0), "ipfs://meta2");

        address[] memory agents = registry.getAllAgents();
        assertEq(agents.length, 2);
    }

    // ─── getChambersByAsset / getAssets ────────────────────────────────

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
        // Two chambers with same asset → asset only appears once
        registry.createChamber(address(token), address(nft), 5, "C1", "C1");
        registry.createChamber(address(token), address(nft), 3, "C2", "C2");

        address[] memory assets = registry.getAssets();
        assertEq(assets.length, 1);
    }

    // ─── Sub-chamber (parent / child hierarchy) ────────────────────────

    function test_Registry_SubChamber_ParentChild() public {
        // Create parent chamber
        address payable parent = registry.createChamber(address(token), address(nft), 5, "Parent", "PAR");

        // Use parent chamber's ERC20 shares as asset for child
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

    // ─── _transferAgentAdmin catch path ───────────────────────────────

    // ─── Defensive zero-address guards ────────────────────────────────

    /// @dev Tests ChamberRegistry.createChamber line 147: `$.implementation == address(0)`
    function test_Registry_CreateChamber_ZeroImplementationAfterInit_Reverts() public {
        // ChamberRegistryStorage base slot
        bytes32 baseSlot = 0xf6315592a63ddf317bd8b41aa1ba894c04251b3cfbd8a95258342cd83f2a4600;
        // `implementation` is the first field → at baseSlot + 0
        vm.store(address(registry), baseSlot, bytes32(0));

        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        registry.createChamber(address(token), address(nft), 5, "C", "C");
    }

    /// @dev Tests ChamberRegistry.createAgent line 193: `$.agentImplementation == address(0)`
    function test_Registry_CreateAgent_ZeroAgentImplementationAfterInit_Reverts() public {
        bytes32 baseSlot = 0xf6315592a63ddf317bd8b41aa1ba894c04251b3cfbd8a95258342cd83f2a4600;
        // `agentImplementation` is the second field → at baseSlot + 1
        bytes32 agentImplSlot = bytes32(uint256(baseSlot) + 1);
        vm.store(address(registry), agentImplSlot, bytes32(0));

        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        registry.createAgent(admin, address(0), "ipfs://meta");
    }

    /// @dev Tests ChamberRegistry._transferChamberAdmin line 324: `proxyAdminAddress == address(0)`
    function test_Registry_TransferChamberAdmin_ZeroProxyAdmin_Reverts() public {
        // Redeploy registry with ZeroProxyAdminChamber as the chamber implementation
        ZeroProxyAdminChamber badChamberImpl = new ZeroProxyAdminChamber();
        Chamber chamberImpl2 = new Chamber();
        Agent agentImpl2 = new Agent();

        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(new ChamberRegistry()),
            address(pa),
            abi.encodeWithSelector(
                ChamberRegistry.initialize.selector,
                address(badChamberImpl), // chamber impl returns address(0) for getProxyAdmin
                address(agentImpl2),
                address(0),
                address(this)
            )
        );
        ChamberRegistry reg2 = ChamberRegistry(address(proxy));

        vm.expectRevert(ChamberRegistry.ZeroAddress.selector);
        reg2.createChamber(address(token), address(nft), 5, "C", "C");
    }

    function test_Registry_CreateAgent_GetProxyAdminReverts() public {
        // Deploy a registry that uses a mock agent implementation where getProxyAdmin() reverts
        RevertingAgentImpl revertingImpl = new RevertingAgentImpl();
        Chamber chamberImpl2 = new Chamber();

        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(new ChamberRegistry()),
            address(pa),
            abi.encodeWithSelector(
                ChamberRegistry.initialize.selector,
                address(chamberImpl2),
                address(revertingImpl), // agent implementation that reverts getProxyAdmin
                address(0),
                address(this)
            )
        );
        ChamberRegistry reg2 = ChamberRegistry(address(proxy));

        vm.expectRevert("Failed to get ProxyAdmin");
        reg2.createAgent(admin, address(0), "ipfs://meta");
    }
}
