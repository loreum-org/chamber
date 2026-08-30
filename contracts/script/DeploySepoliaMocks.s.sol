// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../test/mock/MockERC20.sol";
import {MockERC721} from "../test/mock/MockERC721.sol";

/// @notice Deploys permissionless-mint demo ERC-20 and membership ERC-721.
/// After a successful `--broadcast` on Sepolia, copy the printed addresses into
/// `deployments/sepolia.txt` so `getContractAddresses(11155111)` can read them.
contract DeploySepoliaMocks is Script {
    function run() external {
        string memory tokenName = vm.envOr("TOKEN_NAME", string("Loreum"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("LORE"));
        uint256 initialSupply = vm.envOr("TOKEN_SUPPLY", uint256(100_000_000 ether));
        string memory nftName = vm.envOr("NFT_NAME", string("Loreum"));
        string memory nftSymbol = vm.envOr("NFT_SYMBOL", string("EXPLORERS"));

        vm.startBroadcast();
        MockERC20 mockERC20 = new MockERC20(tokenName, tokenSymbol, initialSupply);
        MockERC721 mockERC721 = new MockERC721(nftName, nftSymbol);
        vm.stopBroadcast();

        console.log("========================================");
        console.log("DeploySepoliaMocks");
        console.log("========================================");
        console.log("MockERC20 (demo)          ", address(mockERC20));
        console.log("MockERC721 (membership)   ", address(mockERC721));
        console.log("========================================");
        console.log("Record these in contracts/deployments/sepolia.txt");
        console.log("Faucet: MockERC20.mint(to, amount), MockERC721.mint(to)");
    }
}
