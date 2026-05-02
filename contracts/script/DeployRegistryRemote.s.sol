// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "src/Registry.sol";
import {DeployRegistry as DeployRegistryLib} from "test/utils/DeployRegistry.sol";

/**
 * @title DeployRegistryRemote
 * @notice Mainnet / Sepolia: deploys Chamber implementation, Registry implementation, and Registry
 *         TransparentUpgradeableProxy initialized with `Registry.initialize(chamberImpl, ADMIN)`.
 * @dev Set `ADMIN` to the account that must own Registry proxy upgrades (OpenZeppelin Transparent
 *      `ProxyAdmin` owner) **and** that receives registry admin roles (`Registry.initialize`). Prefer a multisig.
 *
 * Run (example — signing with Ledger account 0):
 *
 * ```
 * export ADMIN=0xYourMultisigOrColdWallet
 * export SEPOLIA_RPC_URL=...
 * export ETHERSCAN_API_KEY=...
 *
 * # From repo `contracts/` (recommended: correct RPC + ETH_RPC_URL for verify probes)
 * make deploy-registry-remote-sepolia EXTRA_FORGE_ARGS='--ledger --broadcast'
 *
 * # Or invoke forge directly — always pass a real HTTPS Sepolia/Mainnet RPC, never rely on localhost:
 * forge script script/DeployRegistryRemote.s.sol:DeployRegistryRemote \
 *   --rpc-url sepolia \
 *   --broadcast \
 *   -vvvv
 * ```
 *
 * Etherscan verification: this project uses `via_ir = true`. `forge script --verify` often omits `--via-ir`
 * and uses a compiler label that does not match the exact solc commit you built with, producing
 * "deployment bytecode does NOT match". Prefer deploying without `--verify`, then from `contracts/` run
 * `make etherscan-verify-cmd CONTRACT=Chamber ADDRESS=<impl> CHAIN=sepolia` (same for `Registry`).
 *
 * Artifacts: `contracts/deployments-registry-remote-<chainId>.json`
 */
contract DeployRegistryRemote is Script {
    uint256 internal constant MAINNET_CHAIN_ID = 1;
    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;

    function run() external {
        uint256 cid = block.chainid;
        if (cid != MAINNET_CHAIN_ID && cid != SEPOLIA_CHAIN_ID) {
            revert(string.concat("DeployRegistryRemote: unsupported chain ", vm.toString(cid)));
        }

        address admin = vm.envAddress("ADMIN");

        vm.startBroadcast();

        DeployRegistryLib.Deployment memory d = DeployRegistryLib.deployFull(admin);

        vm.stopBroadcast();

        Registry registryProxy = d.registryProxy;

        console.log("========================================");
        console.log("DeployRegistryRemote");
        console.log("========================================");
        console.log("chainId                ", cid);
        console.log("ADMIN                  ", admin);
        console.log("Registry (proxy)       ", address(registryProxy));
        console.log("Registry implementation", d.registryImplementation);
        console.log("Chamber implementation ", d.chamberImplementation);
        console.log("(registry.impl pointer) ", registryProxy.implementation());
        console.log("========================================");

        string memory json = vm.serializeAddress("deployment", "registry", address(registryProxy));
        json = vm.serializeAddress("deployment", "registryImplementation", d.registryImplementation);
        json = vm.serializeAddress("deployment", "chamberImplementation", d.chamberImplementation);
        json = vm.serializeAddress("deployment", "admin", admin);
        json = vm.serializeUint("deployment", "chainId", cid);
        json = vm.serializeUint("deployment", "timestamp", block.timestamp);

        string memory outFile = string.concat("deployments-registry-remote-", vm.toString(cid), ".json");
        vm.writeJson(json, outFile);

        console.log("Wrote", outFile);
    }
}
