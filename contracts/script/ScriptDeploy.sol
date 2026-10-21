// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Chamber} from "src/Chamber.sol";
import {Factory} from "src/Factory.sol";
import {Registry} from "src/Registry.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title ScriptDeploy
 * @notice Deploy helpers for `forge script`. Lives under `script/` on purpose: `new Chamber()` inside
 *         `test/` helpers is rewritten to `vm.deployCode`, which cannot link BoardLib / WalletLib, so
 *         scripts importing `test/utils/Deploy*.sol` fail with "no bytecode for contract ... unlinked".
 */
library ScriptDeploy {
    /// @notice Product create path: new implementation, new Factory, `createChamber`.
    /// @dev Reverts unless the chamber owns its ProxyAdmin (the board is the only upgrader).
    function deployChamberViaFactory(
        address asset,
        address nft,
        uint256 seats,
        string memory name,
        string memory symbol,
        address factoryAdmin
    ) internal returns (Chamber chamber, Factory factory) {
        factory = new Factory(address(new Chamber()), factoryAdmin);
        chamber = Chamber(factory.createChamber(asset, nft, seats, name, symbol));
        require(
            ProxyAdmin(chamber.getProxyAdmin()).owner() == address(chamber), "ProxyAdmin must be owned by the chamber"
        );
    }

    /// @notice Registry implementation + proxy, initialized with a fresh Chamber implementation.
    function deployRegistry(address admin) internal returns (Registry registry) {
        Registry registryImplementation = new Registry();
        Chamber chamberImplementation = new Chamber();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(registryImplementation),
            admin,
            abi.encodeWithSelector(Registry.initialize.selector, address(chamberImplementation), admin)
        );
        registry = Registry(address(proxy));
    }
}
