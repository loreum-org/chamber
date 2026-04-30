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
 * @title Finding 8: Permissionless Agent AutoConfirm [MEDIUM] — FIXED
 * @notice Verifies that autoConfirm now requires the caller to be the owner
 *         or an authorized keeper.
 */
contract PermissionlessAutoConfirmTest is Test {
    ChamberRegistry public registry;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public agentOwner = makeAddr("agentOwner");
    address public randomUser = makeAddr("randomUser");
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
     * @notice FIXED: Random users can no longer trigger autoConfirm.
     */
    function test_Fixed_RandomUserBlocked() public {
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(agentOwner, address(policy), "ipfs://metadata");
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

        // Random user is blocked
        vm.prank(randomUser);
        vm.expectRevert(Agent.NotAuthorized.selector);
        agent.autoConfirm(chamberAddr, 0, 1);

        // Only 1 confirmation (from submit auto-confirm)
        (, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 1, "Random user blocked - only 1 confirmation");
    }

    /**
     * @notice FIXED: Owner can still trigger autoConfirm.
     */
    function test_Fixed_OwnerCanAutoConfirm() public {
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(agentOwner, address(policy), "ipfs://metadata");
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

        // Owner can call autoConfirm
        vm.prank(agentOwner);
        agent.autoConfirm(chamberAddr, 0, 1);

        (, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 2, "Owner successfully confirmed");
    }

    /**
     * @notice FIXED: Authorized keepers can trigger autoConfirm.
     */
    function test_Fixed_AuthorizedKeeperCanAutoConfirm() public {
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 2, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        AllowAllPolicy policy = new AllowAllPolicy();
        address payable agentAddr = registry.createAgent(agentOwner, address(policy), "ipfs://metadata");
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

        // Owner authorizes keeper
        vm.prank(agentOwner);
        agent.setKeeper(keeper, true);

        // Keeper can now call autoConfirm
        vm.prank(keeper);
        agent.autoConfirm(chamberAddr, 0, 1);

        (, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 2, "Authorized keeper successfully confirmed");
    }
}
