// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {Agent} from "src/Agent.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {ConservativeYieldPolicy} from "src/policies/BasicPolicies.sol";

contract AgentTest is Test {
    Registry registry;
    Agent agentImpl;
    Chamber chamberImpl;
    
    MockERC20 token;
    MockERC721 nft;
    
    address admin = address(0x1);
    address user = address(0x2);
    
    function setUp() public {
        vm.startPrank(admin);
        
        // 1. Deploy Implementations
        chamberImpl = new Chamber();
        agentImpl = new Agent();
        
        // 2. Deploy Registry
        registry = new Registry();
        registry.initialize(address(chamberImpl), address(agentImpl), admin);
        
        // 3. Deploy Mocks
        token = new MockERC20("Test", "TST");
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
        address payable agentAddr = registry.createAgent(user, address(policy));
        Agent agent = Agent(agentAddr);
        
        assertEq(agent.owner(), user);
        assertEq(address(agent.policy()), address(policy));
        
        vm.stopPrank();
    }

    function test_AgentAutoConfirm() public {
        // 1. Setup Chamber
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(
            address(token), address(nft), 1, "Chamber", "CHAM"
        );
        Chamber chamber = Chamber(chamberAddr);
        
        // 2. Setup Agent Director
        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999); // Allowed target
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);
        
        address payable agentAddr = registry.createAgent(user, address(policy));
        Agent agent = Agent(agentAddr);
        
        // 3. Make Agent a Director
        // Mint NFT to Agent
        nft.mintWithTokenId(agentAddr, 1);
        
        // Delegate to Agent (from admin who has tokens)
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether); // Delegate to Agent's NFT
        
        vm.stopPrank();
        
        // 4. Verify Agent is Director
        address[] memory directors = chamber.getDirectors();
        assertEq(directors[0], agentAddr);
        
        // 5. Submit Transaction (as Agent)
        // Agent calls submitTransaction via execute() for now, or we simulate another director submitting
        // Since Agent is the ONLY director (seats=1), it must submit.
        
        vm.prank(user);
        bytes memory submitData = abi.encodeWithSelector(
            IChamber.submitTransaction.selector, 
            1, // tokenId
            address(0x999), 
            0, 
            ""
        );
        // Agent executes submission
        agent.execute(chamberAddr, 0, submitData);
        
        // 6. Test Auto-Confirm (Triggered by anyone)
        // The transaction ID should be 0
        agent.autoConfirm(chamberAddr, 0, 1);
        
        // 7. Verify Confirmation
        (bool executed, uint8 confirmations,,,) = chamber.getTransaction(0);
        assertEq(confirmations, 1);
    }
    
    function test_AgentPolicyRejection() public {
        // Setup similar to above but with invalid target
        vm.startPrank(admin);
        address payable chamberAddr = registry.createChamber(
            address(token), address(nft), 1, "Chamber", "CHAM"
        );
        Chamber chamber = Chamber(chamberAddr);
        
        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);
        
        address payable agentAddr = registry.createAgent(user, address(policy));
        Agent agent = Agent(agentAddr);
        
        nft.mintWithTokenId(agentAddr, 1);
        token.mint(admin, 1000 ether);
        token.approve(chamberAddr, 1000 ether);
        chamber.deposit(1000 ether, admin);
        chamber.delegate(1, 1000 ether);
        vm.stopPrank();
        
        // Submit "Bad" Transaction (Target 0x888 not in whitelist)
        vm.prank(user);
        bytes memory submitData = abi.encodeWithSelector(
            IChamber.submitTransaction.selector, 1, address(0x888), 0, ""
        );
        agent.execute(chamberAddr, 0, submitData);
        
        // Expect Revert on Auto-Confirm
        vm.expectRevert(Agent.PolicyRejection.selector);
        agent.autoConfirm(chamberAddr, 0, 1);
    }
}
