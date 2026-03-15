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

    // ─── AgentIdentityRegistry ─────────────────────────────────────────

    function test_AgentIdentityRegistry_RegisterAgent_AlreadyRegistered_Reverts() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        vm.stopPrank();

        // Try to register the same agent address again (REGISTRAR_ROLE held by registry & admin)
        vm.startPrank(admin);
        vm.expectRevert("Agent already registered");
        identityRegistry.registerAgent(user, agentAddr, "ipfs://Duplicate");
        vm.stopPrank();
    }

    function test_AgentIdentityRegistry_RegisterAgent_ZeroAddress_Reverts() public {
        vm.startPrank(admin);
        vm.expectRevert("Invalid agent address");
        identityRegistry.registerAgent(user, address(0), "ipfs://Invalid");
        vm.stopPrank();
    }

    function test_AgentIdentityRegistry_RegisterAgent_NotRegistrar_Reverts() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        identityRegistry.registerAgent(user, address(0x1234), "ipfs://Unauthorized");
    }

    function test_AgentIdentityRegistry_SupportsInterface() public view {
        // ERC-721 interface
        assertTrue(identityRegistry.supportsInterface(0x80ac58cd));
        // ERC-165 interface
        assertTrue(identityRegistry.supportsInterface(0x01ffc9a7));
        // AccessControl interface
        assertTrue(identityRegistry.supportsInterface(0x7965db0b));
        // Random unsupported interface
        assertFalse(identityRegistry.supportsInterface(0xdeadbeef));
    }

    function test_AgentIdentityRegistry_UpdateAgentURI_NotOwner_Reverts() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Original");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.prank(address(0xBAD));
        vm.expectRevert("Caller is not owner");
        identityRegistry.updateAgentURI(tokenId, "ipfs://Hijacked");
    }

    // ─── ReputationRegistry ────────────────────────────────────────────

    function test_ReputationRegistry_PostSignal_ScoreOver100_Reverts() public {
        vm.prank(reputationManager);
        vm.expectRevert("Score must be 0-100");
        reputationRegistry.postSignal(1, 101, "Too high");
    }

    function test_ReputationRegistry_PostSignal_NotManager_Reverts() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        reputationRegistry.postSignal(1, 50, "Unauthorized");
    }

    function test_ReputationRegistry_GetSignals_Paginated() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.startPrank(reputationManager);
        reputationRegistry.postSignal(tokenId, 10, "Low");
        reputationRegistry.postSignal(tokenId, 50, "Mid");
        reputationRegistry.postSignal(tokenId, 90, "High");
        vm.stopPrank();

        // Paginate: skip first, take 2
        ReputationRegistry.Signal[] memory page = reputationRegistry.getSignals(tokenId, 1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].score, 50);
        assertEq(page[1].score, 90);
    }

    function test_ReputationRegistry_GetSignals_Paginated_OffsetPastEnd() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.prank(reputationManager);
        reputationRegistry.postSignal(tokenId, 50, "Score");

        // offset >= total → empty array
        ReputationRegistry.Signal[] memory page = reputationRegistry.getSignals(tokenId, 10, 5);
        assertEq(page.length, 0);
    }

    function test_ReputationRegistry_GetSignals_Paginated_RemainingLtLimit() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.startPrank(reputationManager);
        reputationRegistry.postSignal(tokenId, 10, "A");
        reputationRegistry.postSignal(tokenId, 20, "B");
        vm.stopPrank();

        // limit > remaining (1 element left after offset=1)
        ReputationRegistry.Signal[] memory page = reputationRegistry.getSignals(tokenId, 1, 100);
        assertEq(page.length, 1);
        assertEq(page[0].score, 20);
    }

    function test_ReputationRegistry_GetSignalCount() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        assertEq(reputationRegistry.getSignalCount(tokenId), 0);

        vm.prank(reputationManager);
        reputationRegistry.postSignal(tokenId, 70, "Good");

        assertEq(reputationRegistry.getSignalCount(tokenId), 1);
    }

    function test_ReputationRegistry_GetAverageScore_NoSignals() public view {
        // Agent ID with no signals → returns 0
        assertEq(reputationRegistry.getAverageScore(9999), 0);
    }

    // ─── ValidationRegistry ────────────────────────────────────────────

    function test_ValidationRegistry_PostValidation_NotValidator_Reverts() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        validationRegistry.postValidation(1, "TYPE", true, "data", 1 days);
    }

    function test_ValidationRegistry_GetValidations_Paginated() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.startPrank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data1", 1 days);
        validationRegistry.postValidation(tokenId, "TYPE_B", true, "data2", 2 days);
        validationRegistry.postValidation(tokenId, "TYPE_C", false, "data3", 3 days);
        vm.stopPrank();

        // Get page starting at index 1, limit 2
        ValidationRegistry.Validation[] memory page = validationRegistry.getValidations(tokenId, 1, 2);
        assertEq(page.length, 2);
        assertEq(keccak256(bytes(page[0].validationType)), keccak256(bytes("TYPE_B")));
        assertEq(keccak256(bytes(page[1].validationType)), keccak256(bytes("TYPE_C")));
    }

    function test_ValidationRegistry_GetValidations_Paginated_OffsetPastEnd() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.prank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data", 1 days);

        // offset past end → empty array
        ValidationRegistry.Validation[] memory page = validationRegistry.getValidations(tokenId, 10, 5);
        assertEq(page.length, 0);
    }

    function test_ValidationRegistry_GetValidations_Paginated_RemainingLtLimit() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.startPrank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data1", 1 days);
        validationRegistry.postValidation(tokenId, "TYPE_B", true, "data2", 2 days);
        vm.stopPrank();

        // limit > remaining (1 left after offset=1)
        ValidationRegistry.Validation[] memory page = validationRegistry.getValidations(tokenId, 1, 100);
        assertEq(page.length, 1);
        assertEq(keccak256(bytes(page[0].validationType)), keccak256(bytes("TYPE_B")));
    }

    function test_ValidationRegistry_GetValidationCount() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        assertEq(validationRegistry.getValidationCount(tokenId), 0);

        vm.prank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data", 1 days);

        assertEq(validationRegistry.getValidationCount(tokenId), 1);
    }

    function test_ValidationRegistry_GetValidations_Legacy() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        vm.startPrank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data1", 1 days);
        validationRegistry.postValidation(tokenId, "TYPE_B", false, "data2", 2 days);
        vm.stopPrank();

        ValidationRegistry.Validation[] memory all = validationRegistry.getValidations(tokenId);
        assertEq(all.length, 2);
        assertTrue(all[0].isValid);
        assertFalse(all[1].isValid);
    }

    function test_ValidationRegistry_PostValidation_Invalid_DoesNotUpdateExpiry() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        // Post invalid validation (isValid=false) → latestValidExpiry should NOT be updated
        vm.prank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", false, "data", 1 days);

        // No valid attestation exists
        assertFalse(validationRegistry.hasValidAttestation(tokenId, "TYPE_A"));
    }

    function test_ValidationRegistry_PostValidation_ExpiryNotUpdatedIfSmaller() public {
        vm.startPrank(user);
        address agentAddr = registry.createAgent(user, address(0), "ipfs://Meta");
        uint256 tokenId = Agent(payable(agentAddr)).getIdentityId();
        vm.stopPrank();

        // Post a validation with long expiry
        vm.prank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data", 365 days);

        // Post another with shorter expiry — should not overwrite the longer one
        vm.prank(validator);
        validationRegistry.postValidation(tokenId, "TYPE_A", true, "data2", 1 days);

        // Warp past 1 day — attestation should still be valid (365-day expiry still active)
        vm.warp(block.timestamp + 2 days);
        assertTrue(validationRegistry.hasValidAttestation(tokenId, "TYPE_A"));
    }
}
