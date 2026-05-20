// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

library DeployRegistry {
    /// @notice Outcome of deploying Registry proxy + implementations (used by prod scripts).
    struct Deployment {
        Registry registryProxy;
        address registryImplementation;
        address chamberImplementation;
    }

    function deploy(address admin) internal returns (Registry) {
        return deployFull(admin).registryProxy;
    }

    /// @dev Deploys Chamber implementation, Registry implementation, then Registry `TransparentUpgradeableProxy`,
    ///      initialized via `Registry.initialize(chamberImplementation, admin)`.
    function deployFull(address admin) internal returns (Deployment memory d) {
        Registry registryImplementationContract = new Registry();
        Chamber chamberImplementationContract = new Chamber();

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(registryImplementationContract),
            address(admin),
            abi.encodeWithSelector(Registry.initialize.selector, address(chamberImplementationContract), admin)
        );

        return Deployment({
            registryProxy: Registry(address(proxy)),
            registryImplementation: address(registryImplementationContract),
            chamberImplementation: address(chamberImplementationContract)
        });
    }
}
