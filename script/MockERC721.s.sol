// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {MockERC721} from "test/mock/MockERC721.sol";

contract DeployMockERC721 is Script {
    function run() external {
        // Default values, can be overridden with env vars
        string memory name = vm.envOr("NFT_NAME", string("Mock NFT"));
        string memory symbol = vm.envOr("NFT_SYMBOL", string("MNFT"));

        vm.startBroadcast();

        MockERC721 nft = new MockERC721(name, symbol);

        console.log("MockERC721 deployed at:", address(nft));
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);

        vm.stopBroadcast();
    }
}
