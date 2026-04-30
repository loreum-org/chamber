// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {Agent} from "src/Agent.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {ConservativeYieldPolicy} from "src/policies/BasicPolicies.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";

contract AgentSecurityTest is Test {
    ChamberRegistry registry;
    MockERC20 token;
    MockERC721 nft;

    address admin = address(0x1);
    address user = address(0x2);
    address attacker = address(0xBAD);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy Registry & Helper contracts
        registry = DeployRegistry.deploy(admin);
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));

        token = new MockERC20("Test", "TST", 18);
        nft = new MockERC721("Pass", "PASS");

        vm.stopPrank();
    }

    function test_Exploit_ImpersonateAgent() public {
        // 1. Setup Chamber with 1 seat
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(address(token), address(nft), 1, "Chamber", "CHAM");
        Chamber chamber = Chamber(chamberAddr);

        // 2. Setup Agent
        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");
        // Agent agent = Agent(agentAddr);

        // 3. Make Agent a Director
        nft.mintWithTokenId(agentAddr, 1);

        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);

        vm.stopPrank();

        // 4. Attacker attempts to submit transaction on behalf of Agent (Token ID 1)
        vm.startPrank(attacker);

        // Target can be anything
        address target = address(0x123);

        // EXPECTATION: This should FAIL if secure, but currently SUCCEEDS due to the vulnerability
        vm.expectRevert(); // Expect any revert (specifically IChamber.NotDirector)
        chamber.submitTransaction(
            1, // Agent's Token ID
            target,
            0,
            ""
        );

        // Check if transaction was actually submitted
        // (bool executed, , address txTarget, , ) = chamber.getTransaction(0);
        // assertEq(txTarget, target);
        // assertEq(executed, false);

        vm.stopPrank();
    }
}
