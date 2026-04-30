// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {Agent} from "src/Agent.sol";
import {AgentIdentityRegistry} from "src/AgentIdentityRegistry.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

library DeployRegistry {
    function deploy(address admin) internal returns (ChamberRegistry) {
        // Deploy implementations
        ChamberRegistry registryImplementation = new ChamberRegistry();
        Chamber chamberImplementation = new Chamber();
        Agent agentImplementation = new Agent();

        // Deploy AgentIdentityRegistry implementation
        AgentIdentityRegistry identityRegistryImpl = new AgentIdentityRegistry();

        // Deploy AgentIdentityRegistry proxy
        TransparentUpgradeableProxy identityRegistryProxy = new TransparentUpgradeableProxy(
            address(identityRegistryImpl),
            address(admin),
            abi.encodeWithSelector(AgentIdentityRegistry.initialize.selector, admin)
        );

        // Deploy Registry proxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(registryImplementation),
            address(admin),
            abi.encodeWithSelector(
                ChamberRegistry.initialize.selector,
                address(chamberImplementation),
                address(agentImplementation),
                address(identityRegistryProxy),
                admin
            )
        );

        return ChamberRegistry(address(proxy));
    }
}
