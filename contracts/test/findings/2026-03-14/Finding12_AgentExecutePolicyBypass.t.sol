// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {Agent} from "src/Agent.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IWallet} from "src/interfaces/IWallet.sol";
import {IAgentPolicy} from "src/Agent.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

/**
 * @title Finding 12: Agent execute() Bypasses Governance Policy [MEDIUM] — OPEN
 *
 * @notice Agent.execute() allows the owner to make arbitrary external calls,
 *         including chamber.confirmTransaction(), without going through the
 *         policy check enforced by autoConfirm(). The policy system is advisory.
 *
 * Root cause:
 *   Agent.execute() is onlyOwner but has no policy gate.
 *   Agent.autoConfirm() correctly enforces policy.canApprove() before confirming.
 *   The owner can bypass autoConfirm() by calling execute() directly.
 *
 * Fix: Document execute() as a policy bypass escape hatch (Option A), or remove
 *      execute() when strict policy enforcement is required (Option B).
 */
contract AgentExecutePolicyBypassTest is Test {
    ChamberRegistry public registry;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public agentOwner = makeAddr("agentOwner");
    address public chamberAddress;
    IChamber public chamber;
    Agent public agentContract;

    uint256 public constant AGENT_TOKEN_ID = 1;
    uint256 public constant OTHER_TOKEN_ID = 2;
    address public otherDirector = makeAddr("otherDirector");

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 0);
        nft = new MockERC721("Mock NFT", "MNFT");
        registry = DeployRegistry.deploy(admin);

        // 2 seats so agent + otherDirector are both directors
        chamberAddress = registry.createChamber(address(token), address(nft), 2, "Chamber Token", "CHMB");
        chamber = IChamber(chamberAddress);

        // Grant REGISTRAR_ROLE to registry so createAgent can register identities
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        bytes32 registrarRole = identityRegistry.REGISTRAR_ROLE();
        vm.startPrank(admin);
        identityRegistry.grantRole(registrarRole, address(registry));
        vm.stopPrank();

        // Deploy agent and make it a director
        address agentAddress = registry.createAgent(agentOwner, address(0), "ipfs://agent-meta");
        agentContract = Agent(payable(agentAddress));

        nft.mintWithTokenId(address(agentContract), AGENT_TOKEN_ID);
        token.mint(agentOwner, 1000e18);

        // agentOwner deposits and transfers shares to agent
        vm.startPrank(agentOwner);
        token.approve(chamberAddress, 1000e18);
        chamber.deposit(1000e18, agentOwner);
        uint256 shares = chamber.balanceOf(agentOwner);
        chamber.transfer(address(agentContract), shares);
        vm.stopPrank();

        // Agent delegates to become a director
        bytes memory delegateCall = abi.encodeWithSelector(
            IChamber.delegate.selector, AGENT_TOKEN_ID, chamber.balanceOf(address(agentContract))
        );
        vm.prank(agentOwner);
        agentContract.execute(chamberAddress, 0, delegateCall);

        // Set up a second director (regular EOA) to submit transactions
        nft.mintWithTokenId(otherDirector, OTHER_TOKEN_ID);
        token.mint(otherDirector, 500e18);
        vm.startPrank(otherDirector);
        token.approve(chamberAddress, 500e18);
        chamber.deposit(500e18, otherDirector);
        chamber.delegate(OTHER_TOKEN_ID, chamber.balanceOf(otherDirector));
        vm.stopPrank();
    }

    /**
     * @notice Confirms that autoConfirm() correctly enforces a reject-all policy.
     */
    /**
     * @notice Confirms that autoConfirm() correctly enforces a reject-all policy.
     *         otherDirector submits a tx; agent tries to confirm via autoConfirm → rejected.
     */
    function test_Fixed_AutoConfirmEnforcesPolicy() public {
        RejectAllPolicy rejectPolicy = new RejectAllPolicy();
        vm.prank(agentOwner);
        agentContract.setPolicy(address(rejectPolicy));

        // otherDirector submits a transaction (agent has NOT confirmed it)
        uint256 txId = _submitTxByOtherDirector();

        // Agent has NOT confirmed this tx yet — policy should block it
        vm.prank(agentOwner);
        vm.expectRevert(Agent.PolicyRejection.selector);
        agentContract.autoConfirm(chamberAddress, txId, AGENT_TOKEN_ID);

        assertFalse(chamber.getConfirmation(AGENT_TOKEN_ID, txId), "Agent did NOT confirm");
        console.log("[BASELINE] autoConfirm correctly rejected by RejectAllPolicy");
    }

    /**
     * @notice Demonstrates that execute() bypasses the policy.
     *         Agent owner calls execute() → confirmTransaction directly, no policy check.
     */
    function test_Vuln_ExecuteBypassesPolicy() public {
        RejectAllPolicy rejectPolicy = new RejectAllPolicy();
        vm.prank(agentOwner);
        agentContract.setPolicy(address(rejectPolicy));

        // otherDirector submits a transaction
        uint256 txId = _submitTxByOtherDirector();

        // autoConfirm would reject due to policy
        vm.prank(agentOwner);
        vm.expectRevert(Agent.PolicyRejection.selector);
        agentContract.autoConfirm(chamberAddress, txId, AGENT_TOKEN_ID);
        assertFalse(chamber.getConfirmation(AGENT_TOKEN_ID, txId), "Not yet confirmed");

        // But execute() bypasses policy entirely — directly calls confirmTransaction
        bytes memory confirmCalldata = abi.encodeWithSelector(IWallet.confirmTransaction.selector, AGENT_TOKEN_ID, txId);

        vm.prank(agentOwner);
        agentContract.execute(chamberAddress, 0, confirmCalldata);

        assertTrue(chamber.getConfirmation(AGENT_TOKEN_ID, txId), "Transaction confirmed via execute() bypass");
        console.log("[VULN] execute() bypassed policy - transaction confirmed without policy approval");
    }

    /**
     * @notice Non-owner cannot use execute() — access control is correct.
     */
    function test_Baseline_NonOwnerCannotUseExecute() public {
        uint256 txId = _submitTxByOtherDirector();
        address attacker = makeAddr("attacker");
        bytes memory calldata_ = abi.encodeWithSelector(IWallet.confirmTransaction.selector, AGENT_TOKEN_ID, txId);

        vm.prank(attacker);
        vm.expectRevert(Agent.NotOwner.selector);
        agentContract.execute(chamberAddress, 0, calldata_);

        console.log("[BASELINE] Non-owner correctly blocked from execute()");
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    /// @dev otherDirector submits a transaction; agent (AGENT_TOKEN_ID) has NOT yet confirmed it
    function _submitTxByOtherDirector() internal returns (uint256 txId) {
        txId = chamber.getNextTransactionId();
        vm.prank(otherDirector);
        chamber.submitTransaction(OTHER_TOKEN_ID, makeAddr("target"), 0, bytes(""));
        // otherDirector auto-confirmed it (via _submitTransaction), but agent has not
        assertFalse(chamber.getConfirmation(AGENT_TOKEN_ID, txId), "Agent has not confirmed");
        assertTrue(chamber.getConfirmation(OTHER_TOKEN_ID, txId), "Other director auto-confirmed");
    }
}

/**
 * @notice A policy that rejects all transactions.
 */
contract RejectAllPolicy is IAgentPolicy {
    function canApprove(address, uint256) external pure override returns (bool) {
        return false;
    }
}
