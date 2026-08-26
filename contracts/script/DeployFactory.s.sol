// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Factory} from "src/Factory.sol";
import {Chamber} from "src/Chamber.sol";

/// @notice Deploys a non-proxy Factory next to (not instead of) an existing Chamber implementation.
contract DeployFactory is Script {
    function run() external {
        address admin;

        try vm.envAddress("ADMIN") returns (address envAdmin) {
            admin = envAdmin;
        } catch {
            admin = msg.sender;
        }

        vm.startBroadcast();

        address chamberImplementation;
        try vm.envAddress("CHAMBER_IMPLEMENTATION") returns (address envImpl) {
            chamberImplementation = envImpl;
        } catch {
            chamberImplementation = address(new Chamber());
        }

        Factory factory = new Factory(chamberImplementation, admin);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("DeployFactory");
        console.log("========================================");
        console.log("ADMIN                  ", admin);
        console.log("Factory                ", address(factory));
        console.log("Chamber implementation ", factory.implementation());
        console.log("========================================");
    }
}
