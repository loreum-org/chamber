// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Agent} from "src/Agent.sol";
import {Chamber} from "src/Chamber.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";

contract LifecycleTest is Test {
    ChamberRegistry public registry;
    AgentIdentityRegistry public identityRegistry;
    MockERC20 public token; // The asset token (e.g. DAI)
    MockERC721 public nft; // The membership NFT

    address public admin = makeAddr("admin");
    address public whale = makeAddr("whale");
    address public recipient = makeAddr("recipient");

    address[] public agents;
    uint256[] public agentTokenIds; // NFT IDs held by agents

    function setUp() public {
        // 1. Deploy Environment
        registry = DeployRegistry.deploy(admin);
        identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());

        // Grant REGISTRAR_ROLE to Registry (fix from previous task)
        vm.startPrank(admin);
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));
        vm.stopPrank();

        // 2. Deploy Mock Tokens
        token = new MockERC20("Mock DAI", "mDAI", 18);
        nft = new MockERC721("Chamber Member", "MEM");
    }

    function test_E2E_ChamberLifecycle() public {
        console.log("Starting E2E Chamber Lifecycle Test");

        // --- Step 1: Create Chamber ---
        console.log("Step 1: Creating Chamber");
        vm.startPrank(whale);
        address chamberAddr = registry.createChamber(
            address(token),
            address(nft),
            5, // Seats
            "Treasury Chamber",
            "TCH"
        );
        Chamber chamber = Chamber(payable(chamberAddr));
        vm.stopPrank();
        console.log("Chamber deployed at:", chamberAddr);

        assertEq(chamber.name(), "Treasury Chamber");
        assertEq(chamber.getSeats(), 5);

        // --- Step 2: Deploy 5 Agents ---
        console.log("Step 2: Deploying 5 Agents");
        // Create 5 agents controlled by 5 different owners (or same owner for simplicity)
        // We'll make 'admin' the owner of all agents for easier control in test
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(admin);
            address agentAddr = registry.createAgent(admin, address(0), string.concat("ipfs://agent-", vm.toString(i)));
            agents.push(agentAddr);
            vm.stopPrank();

            // Mint Membership NFT to Agent
            // In reality, this might be governed, but MockERC721 allows public minting
            uint256 tokenId = nft.mint(agentAddr);
            agentTokenIds.push(tokenId);
            console.log("Agent deployed:", i);
            console.log("Address:", agentAddr);
            console.log("Identity ID:", tokenId);
        }

        assertEq(agents.length, 5);

        // --- Step 3: Fund & Delegate ---
        console.log("Step 3: Funding and Delegating");
        // Whale mints tokens and deposits into Chamber
        token.mint(whale, 10000e18);

        vm.startPrank(whale);
        token.approve(address(chamber), 10000e18);
        chamber.deposit(10000e18, whale); // Whale gets shares
        console.log("Whale deposited 10000e18 tokens");

        // Whale delegates to Agents to make them directors
        // 10000 shares total.
        // Delegate 2000 to each agent.
        for (uint256 i = 0; i < 5; i++) {
            chamber.delegate(agentTokenIds[i], 2000e18);
            console.log("Delegated 2000e18 to Agent Identity ID", agentTokenIds[i]);
        }
        vm.stopPrank();

        // Verify Directors
        // Since we delegated equal amounts, they should all be on board (5 seats)
        // We might need to promote them or wait?
        // Chamber usually auto-promotes on delegate if sorted list allows.

        // Let's check isDirector logic or getDirectors
        console.log("Verifying Directors...");
        address[] memory directors = chamber.getDirectors();
        assertEq(directors.length, 5);
        // Directors array returns addresses of the token owners (which are the Agents)

        bool found = false;
        for (uint256 i = 0; i < directors.length; i++) {
            if (directors[i] == agents[0]) found = true;
        }
        assertTrue(found, "Agent 0 should be a director");
        console.log("Agent 0 confirmed as director");

        // --- Step 4: Execute Transaction ---
        console.log("Step 4: Executing Transaction");
        // Goal: Transfer 100 token from Chamber to Recipient

        // 4a. Submit Transaction
        // Agent 0 submits.
        // Agent contract must call chamber.submitTransaction.
        // We use Agent.execute to make the agent perform the call.

        /* bytes memory submitData = abi.encodeWithSelector(
            Chamber.submitTransaction.selector,
            agentTokenIds[0], // tokenId used by Agent 0
            recipient,        // target
            100e18,           // value (Wait, ERC20 transfer value is in data, transaction value is ETH)
                              // If we want to send ERC20, target is Token, value is 0, data is transfer call
            hex""             // data placeholder
        ); */

        // Actually we want to transfer ERC20 tokens from the Chamber.
        // Target: token address
        // Value: 0 (ETH)
        // Data: token.transfer(recipient, 100e18)

        bytes memory transferData = abi.encodeWithSelector(IERC20.transfer.selector, recipient, 100e18);

        bytes memory submitCall = abi.encodeWithSelector(
            Chamber.submitTransaction.selector,
            agentTokenIds[0], // Agent 0's tokenId
            address(token), // Target: The Token Contract
            0, // ETH Value
            transferData // Calldata
        );

        vm.startPrank(admin); // Admin owns Agent 0
        console.log("Submitting transaction via Agent 0...");
        Agent(payable(agents[0])).execute(address(chamber), 0, submitCall);
        vm.stopPrank();

        // Transaction ID should be 0
        (bool executed, uint8 confirmations, address target,,) = chamber.getTransaction(0);
        assertEq(target, address(token));
        assertEq(confirmations, 1); // Submitter auto-confirms
        console.log("Transaction submitted. Confirmations:", confirmations);

        // 4b. Confirm Transaction (Quorum = 3 for 5 seats)
        // We need 3 confirmations total. Agent 0 already confirmed.

        // Agent 1 confirms
        console.log("Agent 1 confirming...");
        bytes memory confirmCall1 = abi.encodeWithSelector(
            Chamber.confirmTransaction.selector,
            agentTokenIds[1],
            0 // txId
        );
        vm.startPrank(admin);
        Agent(payable(agents[1])).execute(address(chamber), 0, confirmCall1);
        vm.stopPrank();

        // Agent 2 confirms
        console.log("Agent 2 confirming...");
        bytes memory confirmCall2 = abi.encodeWithSelector(
            Chamber.confirmTransaction.selector,
            agentTokenIds[2],
            0 // txId
        );
        vm.startPrank(admin);
        Agent(payable(agents[2])).execute(address(chamber), 0, confirmCall2);
        vm.stopPrank();

        // Check confirmations
        (, confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 3);
        console.log("Confirmations reached:", confirmations);

        // 4c. Execute Transaction
        // Anyone can execute if confirmed? Or only director?
        // Agent 0 executes.

        console.log("Executing transaction...");
        bytes memory executeCall = abi.encodeWithSelector(
            Chamber.executeTransaction.selector,
            agentTokenIds[0],
            0 // txId
        );

        uint256 balBefore = token.balanceOf(recipient);

        vm.startPrank(admin);
        Agent(payable(agents[0])).execute(address(chamber), 0, executeCall);
        vm.stopPrank();

        // --- Step 5: Verification ---
        console.log("Step 5: Verification");
        uint256 balAfter = token.balanceOf(recipient);
        console.log("Recipient balance:", balAfter);
        assertEq(balAfter - balBefore, 100e18, "Recipient should have received 100 tokens");

        (executed,,,,) = chamber.getTransaction(0);
        assertTrue(executed, "Transaction should be executed");
    }
}
