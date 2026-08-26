// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Factory} from "src/Factory.sol";
import {Chamber} from "src/Chamber.sol";

contract DeployFactory is Script {
    function run() external {
        address admin;

        try vm.envAddress("ADMIN") returns (address envAdmin) {
            admin = envAdmin;
        } catch {
            admin = msg.sender;
        }

        vm.startBroadcast();

        address impl;
        try vm.envAddress("CHAMBER_IMPLEMENTATION") returns (address envImpl) {
            impl = envImpl;
        } catch {
            impl = address(new Chamber());
        }

        Factory factory = new Factory(impl, admin);

        vm.stopBroadcast();

        console.log("Factory deployed at:", address(factory));
        console.log("Chamber implementation:", factory.implementation());
        console.log("Owner:", factory.owner());
    }
}
