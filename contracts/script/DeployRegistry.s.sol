// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployRegistry is Script {
    function run() external {
        address admin;

        try vm.envAddress("ADMIN") returns (address envAdmin) {
            admin = envAdmin;
        } catch {
            admin = msg.sender;
        }

        vm.startBroadcast();

        Registry registryImplementationContract = new Registry();
        Chamber chamberImplementationContract = new Chamber();

        TransparentUpgradeableProxy registryProxy = new TransparentUpgradeableProxy(
            address(registryImplementationContract),
            address(admin),
            abi.encodeWithSelector(Registry.initialize.selector, address(chamberImplementationContract), admin)
        );

        vm.stopBroadcast();

        console.log("========================================");
        console.log("DeployRegistry");
        console.log("========================================");
        console.log("ADMIN                  ", admin);
        console.log("Registry (proxy)       ", address(registryProxy));
        console.log("Registry implementation", address(registryImplementationContract));
        console.log("Chamber implementation ", address(chamberImplementationContract));
        console.log("========================================");
    }
}
