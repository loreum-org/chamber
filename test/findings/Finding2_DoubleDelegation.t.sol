// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

contract DoubleDelegationTest is Test {
    ChamberRegistry public registry;
    Chamber public implementation;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public attacker = makeAddr("attacker");
    address public chamberAddress;
    IChamber public chamber;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        implementation = new Chamber();
        registry = DeployRegistry.deploy(admin);

        chamberAddress = registry.createChamber(address(token), address(nft), 5, "Chamber Token", "CHMB");
        chamber = IChamber(chamberAddress);

        token.mint(attacker, 100e18);
        nft.mintWithTokenId(attacker, 1);
        nft.mintWithTokenId(attacker, 2);
    }

    function test_Exploit_DoubleDelegation() public {
        vm.startPrank(attacker);
        token.approve(chamberAddress, 100e18);
        chamber.deposit(100e18, attacker);

        // Attacker has 100 tokens deposited
        // Delegate 100 to ID 1
        chamber.delegate(1, 100e18);

        // Delegate another 100 to ID 2 (using the SAME tokens)
        // This should fail now
        vm.expectRevert(IChamber.InsufficientChamberBalance.selector);
        chamber.delegate(2, 100e18);
        vm.stopPrank();

        // Verify total delegation is correct
        uint256 totalDelegated = chamber.getTotalAgentDelegations(attacker);
        uint256 balance = chamber.balanceOf(attacker);

        assertEq(totalDelegated, 100e18, "Delegated amount should NOT be inflated");
        assertEq(balance, 100e18, "Balance should remain 100");
    }
}
