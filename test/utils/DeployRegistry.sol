// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {TransparentUpgradeableProxy} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
library DeployRegistry {
    function deploy(address admin) internal returns (Registry) {
        // Deploy implementation
        Registry registryImplementation = new Registry();
        Chamber chamberImplementation = new Chamber();
        
        // Deploy proxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(registryImplementation),
            address(admin),
            abi.encodeWithSelector(Registry.initialize.selector, address(chamberImplementation), admin)
        );
        
        return Registry(address(proxy));
    }
}