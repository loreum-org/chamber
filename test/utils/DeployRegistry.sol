// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {Agent} from "src/Agent.sol";
import {TransparentUpgradeableProxy} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

library DeployRegistry {
    function deploy(address admin) internal returns (Registry) {
        // Deploy implementations
        Registry registryImplementation = new Registry();
        Chamber chamberImplementation = new Chamber();
        Agent agentImplementation = new Agent();
        
        // Deploy proxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(registryImplementation),
            address(admin),
            abi.encodeWithSelector(
                Registry.initialize.selector, 
                address(chamberImplementation), 
                address(agentImplementation),
                admin
            )
        );
        
        return Registry(address(proxy));
    }
}