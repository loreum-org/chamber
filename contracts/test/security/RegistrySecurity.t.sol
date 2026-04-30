// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "lib/forge-std/src/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {ConservativeYieldPolicy} from "src/policies/BasicPolicies.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {StorageSlot} from "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol";

contract RegistrySecurityTest is Test {
    ChamberRegistry registry;
    address admin = address(0x1);
    address user = address(0x2);

    function setUp() public {
        vm.startPrank(admin);
        registry = DeployRegistry.deploy(admin);
        AgentIdentityRegistry identityRegistry = AgentIdentityRegistry(registry.agentIdentityRegistry());
        identityRegistry.grantRole(identityRegistry.REGISTRAR_ROLE(), address(registry));
        vm.stopPrank();
    }

    function test_AgentOwnershipTransfer() public {
        vm.startPrank(user);

        address[] memory whitelist = new address[](1);
        whitelist[0] = address(0x999);
        ConservativeYieldPolicy policy = new ConservativeYieldPolicy(whitelist);

        address payable agentAddr = registry.createAgent(user, address(policy), "ipfs://metadata");

        vm.stopPrank();

        // Get ProxyAdmin of the Agent
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdminAddr = StorageSlot.getAddressSlot(adminSlot).value;
        // Wait, I can't read storage of another contract directly in Solidity unless I use vm.load or I am the contract.
        // But here I am in a test, so I can use vm.load

        bytes32 val = vm.load(agentAddr, adminSlot);
        address proxyAdminAddress = address(uint160(uint256(val)));

        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);

        // CHECK: Who owns the ProxyAdmin?
        // BEFORE FIX: It should be Registry
        // AFTER FIX: It should be User

        // For now, I assert it is User (expecting failure if bug exists)
        // Or I can assert it is Registry to confirm bug first.

        // I want the test to FAIL if the bug exists (i.e., if Owner != User).
        assertEq(proxyAdmin.owner(), user, "Agent ProxyAdmin should be owned by User");
    }
}
