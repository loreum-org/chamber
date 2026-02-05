// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "src/Registry.sol";
import {DeployRegistry as DeployRegistryLib} from "test/utils/DeployRegistry.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";

contract DeployAllAnvil is Script {
    function run() external {
        address admin;

        // Try to get admin from env, fall back to msg.sender for local
        try vm.envAddress("ADMIN") returns (address envAdmin) {
            admin = envAdmin;
        } catch {
            admin = msg.sender;
        }

        // Default values for mock tokens, can be overridden with env vars
        string memory tokenName = vm.envOr("TOKEN_NAME", string("Mock Token"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("LORE"));
        uint256 initialSupply = vm.envOr("TOKEN_SUPPLY", uint256(100_000_000 ether));

        string memory nftName = vm.envOr("NFT_NAME", string("Mock NFT"));
        string memory nftSymbol = vm.envOr("NFT_SYMBOL", string("EXPLORERS"));

        vm.startBroadcast();

        // Deploy Registry
        Registry registry = DeployRegistryLib.deploy(admin);
        console.log("Registry deployed at:", address(registry));

        // Deploy MockERC20
        MockERC20 mockERC20 = new MockERC20(tokenName, tokenSymbol, initialSupply);
        console.log("MockERC20 deployed at:", address(mockERC20));
        console.log("  Name:", tokenName);
        console.log("  Symbol:", tokenSymbol);
        console.log("  Initial Supply:", initialSupply / 1 ether, "tokens");

        // Deploy MockERC721
        MockERC721 mockERC721 = new MockERC721(nftName, nftSymbol);
        console.log("MockERC721 deployed at:", address(mockERC721));
        console.log("  Name:", nftName);
        console.log("  Symbol:", nftSymbol);

        vm.stopBroadcast();

        // Write deployment addresses to JSON file for the app to consume
        string memory json = vm.serializeAddress("deployment", "registry", address(registry));
        json = vm.serializeAddress("deployment", "chamberImplementation", registry.implementation());
        json = vm.serializeAddress("deployment", "agentImplementation", registry.agentImplementation());
        json = vm.serializeAddress("deployment", "mockERC20", address(mockERC20));
        json = vm.serializeAddress("deployment", "mockERC721", address(mockERC721));
        json = vm.serializeUint("deployment", "chainId", block.chainid);
        json = vm.serializeUint("deployment", "timestamp", block.timestamp);

        vm.writeJson(json, "./app/src/contracts/deployments.json");
        console.log("Deployment addresses written to app/src/contracts/deployments.json");
    }
}
