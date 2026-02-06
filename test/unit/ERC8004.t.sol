// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Agent} from "src/Agent.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {ReputationRegistry} from "src/ReputationRegistry.sol";
import {ValidationRegistry} from "src/ValidationRegistry.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract ERC8004Test is Test {
    ChamberRegistry public registry;
    AgentIdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;

    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public validator = makeAddr("validator");
    address public reputationManager = makeAddr("reputationManager");

    function setUp() public {
        // Deploy Registry and Identity Registry via helper
        registry = DeployRegistry.deploy(admin);
        identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());

        // Grant REGISTRAR_ROLE to Registry so it can register agents
        vm.startPrank(admin);
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));
        vm.stopPrank();

        // Deploy Reputation and Validation Registries manually (since they are new)
        vm.startPrank(admin);

        // Reputation
        ReputationRegistry reputationImpl = new ReputationRegistry();
        TransparentUpgradeableProxy reputationProxy = new TransparentUpgradeableProxy(
            address(reputationImpl), admin, abi.encodeWithSelector(ReputationRegistry.initialize.selector, admin)
        );
        reputationRegistry = ReputationRegistry(address(reputationProxy));

        // Grant Reputation Manager role
        reputationRegistry.grantRole(reputationRegistry.REPUTATION_MANAGER_ROLE(), reputationManager);

        // Validation
        ValidationRegistry validationImpl = new ValidationRegistry();
        TransparentUpgradeableProxy validationProxy = new TransparentUpgradeableProxy(
            address(validationImpl), admin, abi.encodeWithSelector(ValidationRegistry.initialize.selector, admin)
        );
        validationRegistry = ValidationRegistry(address(validationProxy));

        // Grant Validator role
        validationRegistry.grantRole(validationRegistry.VALIDATOR_ROLE(), validator);

        vm.stopPrank();
    }

    function test_ERC8004_CreateAgent_RegistersIdentity() public {
        vm.startPrank(user);

        string memory metadata = "ipfs://QmTest";
        address agentAddr = registry.createAgent(user, address(0), metadata);

        Agent agent = Agent(payable(agentAddr));

        // Check Agent has Identity ID
        uint256 tokenId = agent.getIdentityId();
        assertGt(tokenId, 0);

        // Check Identity Registry has correct mapping
        assertEq(identityRegistry.agentToIdentityId(agentAddr), tokenId);
        assertEq(identityRegistry.identityIdToAgent(tokenId), agentAddr);

        // Check Metadata
        assertEq(identityRegistry.tokenURI(tokenId), metadata);

        // Check Ownership of Identity NFT (should be User)
        assertEq(identityRegistry.ownerOf(tokenId), user);

        vm.stopPrank();
    }

    function test_ERC8004_UpdateAgentMetadata() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Old");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();

        // Update Metadata
        identityRegistry.updateAgentURI(tokenId, "ipfs://New");
        assertEq(identityRegistry.tokenURI(tokenId), "ipfs://New");
        vm.stopPrank();
    }

    function test_ERC8004_ReputationSignals() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        // Post Signal as Manager
        vm.startPrank(reputationManager);
        reputationRegistry.postSignal(tokenId, 85, "Good performance");
        reputationRegistry.postSignal(tokenId, 95, "Excellent uptime");
        vm.stopPrank();

        // Check Average
        assertEq(reputationRegistry.getAverageScore(tokenId), 90);

        // Check Signals
        ReputationRegistry.Signal[] memory signals = reputationRegistry.getSignals(tokenId);
        assertEq(signals.length, 2);
        assertEq(signals[0].score, 85);
        assertEq(signals[1].score, 95);
    }

    function test_ERC8004_ValidationAttestations() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        // Post Validation as Validator
        vm.startPrank(validator);
        validationRegistry.postValidation(
            tokenId,
            "TEE_VERIFICATION",
            true,
            "proof_data_hash",
            1 days // Valid for 1 day
        );
        vm.stopPrank();

        // Check Valid
        assertTrue(validationRegistry.hasValidAttestation(tokenId, "TEE_VERIFICATION"));

        // Check Expiry
        vm.warp(block.timestamp + 1 days + 1 seconds);
        assertFalse(validationRegistry.hasValidAttestation(tokenId, "TEE_VERIFICATION"));
    }
}
