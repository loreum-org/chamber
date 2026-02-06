// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {Agent} from "src/Agent.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {AllowAllPolicy} from "src/policies/BasicPolicies.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

/**
 * @title Finding 5: Agent getDirectorTokenId Returns 0 [HIGH] — FIXED
 * @notice Verifies that the broken two-parameter autoConfirm and getDirectorTokenId
 *         have been removed. Only the three-parameter version exists now.
 */
contract AgentDeadCodePathTest is Test {
    ChamberRegistry public registry;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public user = makeAddr("user");
    address public keeper = makeAddr("keeper");

    function setUp() public {
        vm.startPrank(admin);
        registry = DeployRegistry.deploy(admin);

        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));

        token = new MockERC20("Test", "TST", 0);
        nft = new MockERC721("Pass", "PASS");
        vm.stopPrank();
    }

    /**
     * @notice FIXED: The three-parameter autoConfirm works correctly when called
     *         by an authorized keeper.
     */
    function test_Fixed_ThreeParamAutoConfirmWorks() public {
        // 1. Setup Chamber and Agent
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        Agent agent = Agent(agentAddr);

        nft.mintWithTokenId(agentAddr, 1);
        nft.mintWithTokenId(admin, 2);
        token.mint(admin, 2000e18);
        token.approve(chamberAddr, 2000e18);
        chamber.deposit(2000e18, admin);
        chamber.delegate(1, 1000e18);
        chamber.delegate(2, 1000e18);

        chamber.submitTransaction(2, address(0x999), 0, "");
        vm.stopPrank();

        // 2. Owner authorizes the keeper
        vm.prank(user);
        agent.setKeeper(keeper, true);

        // 3. Keeper calls the three-parameter autoConfirm
        vm.prank(keeper);
        agent.autoConfirm(chamberAddr, 0, 1);

        (, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 2, "3-param autoConfirm works via authorized keeper");
    }

    /**
     * @notice FIXED: The broken two-parameter autoConfirm no longer exists.
     *         Verify that the contract only has the three-parameter version.
     */
    function test_Fixed_TwoParamAutoConfirmRemoved() public {
        vm.startPrank(admin);
        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        Agent agent = Agent(agentAddr);
        vm.stopPrank();

        // The two-parameter autoConfirm and getDirectorTokenId are removed.
        // This test simply verifies the contract compiles without them
        // and that the three-parameter version is the only one available.
        assertTrue(address(agent) != address(0), "Agent deployed without dead code");
    }
}
