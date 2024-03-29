// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


import { MultiProxy } from "src/proxy/MultiProxy.sol";    
import { MultiBeacon } from "src/proxy/MultiBeacon.sol";
import { Chamber } from "src/Chamber.sol";
import { Registry } from "src/Registry.sol";

contract DeployRegistry {

    Chamber chamberImpl;
    MultiBeacon chamberBeacon;
    Registry registryImpl;
    MultiBeacon registryBeacon;
    MultiProxy multiProxy;

    function deploy(address _owner) public returns (address) {
        chamberImpl = new Chamber();
        chamberBeacon = new MultiBeacon(address(chamberImpl), _owner);

        registryImpl = new Registry();
        registryBeacon = new MultiBeacon(address(registryImpl), _owner);

        bytes memory data = abi.encodeWithSelector(Registry.initialize.selector, address(chamberBeacon), _owner);
        MultiProxy registry = new MultiProxy(address(registryBeacon), data, _owner);

        return address(registry);
    }

    function getImplementations() public view returns (address, address){
        return (address(chamberImpl), address(registryImpl));
    }
}