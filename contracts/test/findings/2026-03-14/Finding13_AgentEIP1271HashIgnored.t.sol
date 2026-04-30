// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {Agent} from "src/Agent.sol";
import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";

/**
 * @title Finding 13: Agent isValidSignature 32-Byte Path Ignores Hash [MEDIUM] — OPEN
 *
 * @notice The 32-byte signature shortcut in Agent.isValidSignature() validates any
 *         message hash when the signature encodes the owner's address, ignoring the
 *         hash parameter entirely.
 *
 * Root cause:
 *   isValidSignature(bytes32 hash, bytes memory signature) {
 *       if (signature.length == 32) {
 *           address authorizedSender = abi.decode(signature, (address));
 *           if (authorizedSender == _owner) return magic; // hash is never checked!
 *       }
 *   }
 *
 * Impact: Any external protocol that calls isValidSignature with a 32-byte signature
 *         encoding the owner address will receive the magic value for ANY hash —
 *         including hashes the owner never approved.
 *
 * Fix: Remove the 32-byte shortcut path, or restrict it to known callers.
 */
contract AgentEIP1271HashIgnoredTest is Test {
    ChamberRegistry public registry;
    address public admin = makeAddr("admin");
    address public agentOwner = makeAddr("agentOwner");
    Agent public agentContract;

    bytes4 internal constant MAGIC_VALUE = IERC1271.isValidSignature.selector;
    bytes4 internal constant INVALID_VALUE = 0xffffffff;

    function setUp() public {
        registry = DeployRegistry.deploy(admin);

        // Grant REGISTRAR_ROLE to registry so createAgent can register identities
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        bytes32 registrarRole = identityRegistry.REGISTRAR_ROLE();
        vm.startPrank(admin);
        identityRegistry.grantRole(registrarRole, address(registry));
        vm.stopPrank();

        address agentAddress = registry.createAgent(agentOwner, address(0), "ipfs://test");
        agentContract = Agent(payable(agentAddress));
    }

    /**
     * @notice Demonstrates the vulnerability: any hash is accepted when the signature
     *         is a 32-byte encoding of the owner address.
     */
    function test_Vuln_AnyHashAcceptedWith32ByteSignature() public {
        // Craft a 32-byte signature encoding the owner address
        bytes memory ownerSignature = abi.encode(agentOwner);
        assertEq(ownerSignature.length, 32, "Signature is 32 bytes");

        // Hash 1: A completely arbitrary hash the owner never saw
        bytes32 arbitraryHash1 = keccak256("I authorize the attacker to drain all funds");
        bytes4 result1 = agentContract.isValidSignature(arbitraryHash1, ownerSignature);
        assertEq(result1, MAGIC_VALUE, "VULN: arbitrary hash 1 accepted");

        // Hash 2: Another arbitrary hash
        bytes32 arbitraryHash2 = keccak256("Transfer 1000 ETH to attacker.eth");
        bytes4 result2 = agentContract.isValidSignature(arbitraryHash2, ownerSignature);
        assertEq(result2, MAGIC_VALUE, "VULN: arbitrary hash 2 accepted");

        // Hash 3: Zero hash
        bytes32 zeroHash = bytes32(0);
        bytes4 result3 = agentContract.isValidSignature(zeroHash, ownerSignature);
        assertEq(result3, MAGIC_VALUE, "VULN: zero hash accepted");

        console.log("[VULN] isValidSignature returns magic value for ANY hash with 32-byte owner encoding");
    }

    /**
     * @notice A non-owner address as a 32-byte signature is correctly rejected.
     */
    function test_Baseline_NonOwnerSignatureRejected() public {
        address nonOwner = makeAddr("nonOwner");
        bytes memory nonOwnerSignature = abi.encode(nonOwner);
        bytes32 someHash = keccak256("some data");

        bytes4 result = agentContract.isValidSignature(someHash, nonOwnerSignature);
        assertEq(result, INVALID_VALUE, "Non-owner 32-byte signature correctly rejected");

        console.log("[BASELINE] Non-owner 32-byte signature rejected");
    }

    /**
     * @notice The ECDSA path correctly binds the hash to the owner's signature.
     */
    function test_Fixed_ECDSAPathRequiresCorrectHash() public {
        uint256 ownerPrivKey = 0xABCD1234;
        address ownerEOA = vm.addr(ownerPrivKey);

        // Deploy a fresh agent with an EOA owner
        address agentAddress = registry.createAgent(ownerEOA, address(0), "ipfs://eoa-agent");
        Agent eoaAgent = Agent(payable(agentAddress));

        bytes32 realHash = keccak256("Real message owner approved");
        bytes32 fakeHash = keccak256("Fake message owner never saw");

        // Sign the real hash
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPrivKey, realHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Real hash with correct sig: accepted
        bytes4 result1 = eoaAgent.isValidSignature(realHash, sig);
        assertEq(result1, MAGIC_VALUE, "Real hash accepted");

        // Fake hash with same sig: rejected
        bytes4 result2 = eoaAgent.isValidSignature(fakeHash, sig);
        assertEq(result2, INVALID_VALUE, "Fake hash rejected");

        console.log("[BASELINE] ECDSA path correctly binds hash to signature");
    }

    /**
     * @notice Demonstrates the Chamber _isDirector context uses the 32-byte path safely.
     *         (Chamber constructs both hash and signature; interaction is internal.)
     */
    function test_Context_ChamberUsageIsSafeButNonStandard() public {
        // The Chamber calls: isValidSignature(
        //   keccak256(abi.encodePacked("DirectorAuth", address(chamber), tokenId, msg.sender)),
        //   abi.encode(msg.sender)
        // )
        // This works correctly within the Chamber flow because the Chamber controls both sides.
        // But any external protocol trusting isValidSignature on this Agent can be spoofed.

        bytes32 chamberHash = keccak256(abi.encodePacked("DirectorAuth", address(0x1234), uint256(1), agentOwner));
        bytes memory chamberSig = abi.encode(agentOwner);

        bytes4 result = agentContract.isValidSignature(chamberHash, chamberSig);
        assertEq(result, MAGIC_VALUE, "Chamber internal flow works");

        // But so does a completely different hash
        bytes32 externalHash = keccak256("external protocol message");
        bytes4 externalResult = agentContract.isValidSignature(externalHash, chamberSig);
        assertEq(externalResult, MAGIC_VALUE, "External hash also 'works' - non-standard behavior");

        console.log("[INFO] Chamber internal usage is safe; external EIP-1271 usage is non-standard");
    }
}
