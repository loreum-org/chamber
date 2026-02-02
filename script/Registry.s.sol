// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "src/Registry.sol";
import {DeployRegistry as DeployRegistryLib} from "test/utils/DeployRegistry.sol";

contract DeployRegistry is Script {
    function run() external {
        address admin;
        
        // Try to get admin from env, fall back to msg.sender for local
        try vm.envAddress("ADMIN") returns (address envAdmin) {
            admin = envAdmin;
        } catch {
            admin = msg.sender;
        }

        vm.startBroadcast();

        Registry registry = DeployRegistryLib.deploy(admin);
        console.log("Registry deployed at:", address(registry));

        vm.stopBroadcast();
    }
} 