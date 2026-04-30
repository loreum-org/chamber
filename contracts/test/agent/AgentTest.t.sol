// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {Agent} from "src/Agent.sol";
import {IAgentPolicy} from "src/Agent.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {AllowAllPolicy, ConservativeYieldPolicy} from "src/policies/BasicPolicies.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";

contract AgentTest is Test {
    ChamberRegistry registry;
    Agent agentImpl;
    Chamber chamberImpl;

    MockERC20 token;
    MockERC721 nft;

    address admin = address(0x1);
    address user = address(0x2);

    function setUp() public {
        vm.startPrank(admin);

        // Use helper to deploy everything correctly
        registry = DeployRegistry.deploy(admin);

        // Grant REGISTRAR_ROLE to Registry
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));

        // Deploy Mocks
        token = new MockERC20("Test", "TST", 18);
        nft = new MockERC721("Pass", "PASS");

        vm.stopPrank();
    }

    function test_AgentDeployment() public {
        vm.startPrank(user);

        // Deploy Policy
        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        // Deploy Agent via Registry
        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        Agent agent = Agent(agentAddr);

        assertEq(agent.owner(), user);
        assertEq(address(agent.policy()), address(policy));

        vm.stopPrank();
    }

    function test_AgentAutoConfirm() public {
        // 1. Setup Chamber with 2 seats
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        // 2. Setup Agent Director
        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999); // Allowed target
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        Agent agent = Agent(agentAddr);

        // 3. Make Agent and Admin Directors
        // Mint NFT to Agent (ID 1) and Admin (ID 2)
        nft.mintWithTokenId(agentAddr, 1);
        nft.mintWithTokenId(admin, 2);

        // Delegate to Agent and Admin
        token.mint(admin, 2000 ether);
        token.approve(chamberAddr, 2000 ether);
        chamber.deposit(2000 ether, admin);
        chamber.delegate(1, 1000 ether); // Delegate to Agent
        chamber.delegate(2, 1000 ether); // Delegate to Admin

        vm.stopPrank();

        // 4. Verify Directors
        address[] memory directors = chamber.getDirectors();
        assertEq(directors[0], agentAddr);
        assertEq(directors[1], admin);

        // 5. Submit Transaction (as Admin)
        vm.prank(admin);
        chamber.submitTransaction(
            2, // tokenId (Admin)
            address(0x999),
            0,
            ""
        );

        // 6. Test Auto-Confirm (Triggered by owner)
        // The transaction ID should be 0
        vm.prank(user);
        agent.autoConfirm(chamberAddr, 0, 1);

        // 7. Verify Confirmation
        (bool executed, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 2); // Admin + Agent
    }

    function test_AgentPolicyRejection() public {
        // Setup similar to above but with invalid target
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 1, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        Agent agent = Agent(agentAddr);

        nft.mintWithTokenId(agentAddr, 1);
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);
        vm.stopPrank();

        // Submit "Bad" Transaction (Target 0x888 not in whitelist)
        vm.prank(user);
        bytes memory submitData = abi.encodeWithSelector(Chamber.submitTransaction.selector, 1, address(0x888), 0, "");
        agent.execute(chamberAddr, 0, submitData);

        // Expect Revert on Auto-Confirm (owner calls)
        vm.prank(user);
        vm.expectRevert(Agent.PolicyRejection.selector);
        agent.autoConfirm(chamberAddr, 0, 1);
    }

    // ─── Registry / getters ────────────────────────────────────────────

    function test_Agent_Registry_Getter() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);
        assertEq(agent.registry(), address(registry));
    }

    function test_Agent_AuthorizedKeepers_Getter() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        address keeper = address(0xBEEF);
        assertFalse(agent.authorizedKeepers(keeper));

        vm.prank(user);
        agent.setKeeper(keeper, true);
        assertTrue(agent.authorizedKeepers(keeper));
    }

    // ─── setPolicy ─────────────────────────────────────────────────────

    function test_Agent_SetPolicy() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        AllowAllPolicy newPolicy = new AllowAllPolicy();

        vm.prank(user);
        agent.setPolicy(address(newPolicy));

        assertEq(address(agent.policy()), address(newPolicy));
    }

    function test_Agent_SetPolicy_NotOwner_Reverts() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        vm.prank(address(0xDEAD));
        vm.expectRevert(Agent.NotOwner.selector);
        agent.setPolicy(address(0));
    }

    // ─── setKeeper ─────────────────────────────────────────────────────

    function test_Agent_SetKeeper() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        address keeper = address(0xCAFE);
        vm.prank(user);
        agent.setKeeper(keeper, true);
        assertTrue(agent.authorizedKeepers(keeper));

        vm.prank(user);
        agent.setKeeper(keeper, false);
        assertFalse(agent.authorizedKeepers(keeper));
    }

    function test_Agent_SetKeeper_NotOwner_Reverts() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        vm.prank(address(0xDEAD));
        vm.expectRevert(Agent.NotOwner.selector);
        agent.setKeeper(address(0xCAFE), true);
    }

    // ─── autoConfirm ───────────────────────────────────────────────────

    function test_Agent_AutoConfirm_ByKeeper() public {
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        nft.mintWithTokenId(agentAddr, 1);
        nft.mintWithTokenId(admin, 2);
        token.mint(admin, 2000 ether);
        token.approve(chamberAddr, 2000 ether);
        chamber.deposit(2000 ether, admin);
        chamber.delegate(1, 1000 ether);
        chamber.delegate(2, 1000 ether);
        vm.stopPrank();

        vm.prank(admin);
        chamber.submitTransaction(2, address(0x999), 0, "");

        address keeper = address(0xBEEF);
        vm.prank(user);
        agent.setKeeper(keeper, true);

        vm.prank(keeper);
        agent.autoConfirm(chamberAddr, 0, 1);

        (, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 2);
    }

    function test_Agent_AutoConfirm_Unauthorized_Reverts() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        vm.prank(address(0xDEAD));
        vm.expectRevert(Agent.NotAuthorized.selector);
        agent.autoConfirm(address(0), 0, 1);
    }

    function test_Agent_AutoConfirm_NoPolicy_Reverts() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        vm.prank(user);
        vm.expectRevert("No policy set");
        agent.autoConfirm(address(0), 0, 1);
    }

    // ─── isValidSignature ──────────────────────────────────────────────

    function test_Agent_IsValidSignature_Address32_Valid() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        bytes32 hash = keccak256("test");
        bytes memory sig = abi.encode(user); // 32-byte address encoding

        bytes4 result = agent.isValidSignature(hash, sig);
        assertEq(result, IERC1271.isValidSignature.selector);
    }

    function test_Agent_IsValidSignature_Address32_Invalid() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        bytes32 hash = keccak256("test");
        // 32 bytes encoding of a non-owner address
        bytes memory sig = abi.encode(address(0xDEAD));

        // Falls through to ECDSA which also fails → 0xffffffff
        bytes4 result = agent.isValidSignature(hash, sig);
        assertEq(result, bytes4(0xffffffff));
    }

    function test_Agent_IsValidSignature_ECDSA_Valid() public {
        uint256 ownerPk = 0xA11CE;
        address ownerAddr = vm.addr(ownerPk);

        // Deploy agent with ownerAddr as owner
        vm.prank(ownerAddr);
        address payable agentAddr = registry.createAgent(ownerAddr, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        bytes32 hash = keccak256("test data");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, hash);
        bytes memory sig = abi.encodePacked(r, s, v);

        bytes4 result = agent.isValidSignature(hash, sig);
        assertEq(result, IERC1271.isValidSignature.selector);
    }

    function test_Agent_IsValidSignature_ECDSA_Invalid() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        bytes32 hash = keccak256("test");
        // Random 65-byte signature (not from owner)
        bytes memory sig = new bytes(65);

        bytes4 result = agent.isValidSignature(hash, sig);
        assertEq(result, bytes4(0xffffffff));
    }

    // ─── execute ───────────────────────────────────────────────────────

    function test_Agent_Execute_Failure_Reverts() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        // Sending ETH the agent doesn't have causes the low-level call to fail
        vm.prank(user);
        vm.expectRevert("Execution failed");
        agent.execute(address(0xDEAD), 1 ether, "");
    }

    // ─── getIdentityId ─────────────────────────────────────────────────

    function test_Agent_Initialize_ZeroOwner_Reverts() public {
        Agent agentImpl = new Agent();
        ProxyAdmin pa = new ProxyAdmin(address(this));

        vm.expectRevert("Zero address owner");
        new TransparentUpgradeableProxy(
            address(agentImpl),
            address(pa),
            abi.encodeWithSelector(Agent.initialize.selector, address(0), address(0), address(0))
        );
    }

    function test_Agent_GetIdentityId_ZeroRegistry() public {
        // Deploy agent impl directly
        Agent agentImpl = new Agent();

        // Deploy proxy with registry = address(0)
        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(agentImpl),
            address(pa),
            abi.encodeWithSelector(Agent.initialize.selector, user, address(0), address(0))
        );

        Agent agent = Agent(payable(address(proxy)));
        assertEq(agent.getIdentityId(), 0);
    }

    function test_Agent_GetIdentityId_ZeroIdentityRegistry() public {
        // Deploy registry without agentIdentityRegistry
        ChamberRegistry registryImpl = new ChamberRegistry();
        Chamber chamberImpl = new Chamber();
        Agent agentImpl2 = new Agent();

        ProxyAdmin pa = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy registryProxy = new TransparentUpgradeableProxy(
            address(registryImpl),
            address(pa),
            abi.encodeWithSelector(
                ChamberRegistry.initialize.selector,
                address(chamberImpl),
                address(agentImpl2),
                address(0), // no identity registry
                address(this)
            )
        );
        ChamberRegistry reg2 = ChamberRegistry(address(registryProxy));

        address payable agentAddr = reg2.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        // registry is set but agentIdentityRegistry returns address(0)
        assertEq(agent.getIdentityId(), 0);
    }

    // ─── getProxyAdmin / supportsInterface / receive ───────────────────

    function test_Agent_GetProxyAdmin() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        address pa = agent.getProxyAdmin();
        assertNotEq(pa, address(0));
    }

    function test_Agent_SupportsInterface() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");
        Agent agent = Agent(agentAddr);

        assertTrue(agent.supportsInterface(type(IERC1271).interfaceId));
        // ERC165 itself
        assertTrue(agent.supportsInterface(0x01ffc9a7));
        assertFalse(agent.supportsInterface(0xdeadbeef));
    }

    function test_Agent_Receive_ETH() public {
        vm.prank(user);
        address payable agentAddr = registry.createAgent(user, address(0), "ipfs://meta");

        vm.deal(address(this), 1 ether);
        (bool ok,) = agentAddr.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(agentAddr).balance, 1 ether);
    }

    // ─── BasicPolicies ─────────────────────────────────────────────────

    function test_AllowAllPolicy_AlwaysApproves() public {
        AllowAllPolicy pol = new AllowAllPolicy();
        // canApprove returns true regardless of inputs
        assertTrue(pol.canApprove(address(0), 0));
    }

    function test_ConservativeYieldPolicy_ValueExceedsMax_ReturnsFalse() public {
        // Setup a chamber and a transaction with value > MAX_VALUE (10 ether)
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 1, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        nft.mintWithTokenId(admin, 1);
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);

        // Fund the chamber with enough ETH to allow large value tx submission
        vm.deal(chamberAddr, 100 ether);

        // Submit transaction with value > MAX_VALUE (10 ether) to whitelisted target
        chamber.submitTransaction(1, address(0x999), 11 ether, "");
        vm.stopPrank();

        // ConservativeYieldPolicy should reject because value > MAX_VALUE
        assertFalse(policy.canApprove(chamberAddr, 0));
    }

    function test_ConservativeYieldPolicy_TargetNotWhitelisted_ReturnsFalse() public {
        // Build a ConservativeYieldPolicy with one allowed target
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 1, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        nft.mintWithTokenId(admin, 1);
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);

        // Submit to a non-whitelisted target
        chamber.submitTransaction(1, address(0x888), 0, "");
        vm.stopPrank();

        assertFalse(policy.canApprove(chamberAddr, 0));
    }

    function test_ConservativeYieldPolicy_ApproveSuccess() public {
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 1, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        nft.mintWithTokenId(admin, 1);
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);

        // Submit to whitelisted target with value <= MAX_VALUE
        chamber.submitTransaction(1, address(0x999), 0, "");
        vm.stopPrank();

        assertTrue(policy.canApprove(chamberAddr, 0));
    }
}
