// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "lib/forge-std/src/Script.sol";
import { LoreumToken } from "lib/loreum-token/src/LoreumToken.sol";

contract DeployERC20 is Script {

    function run() external {

        address receiver = msg.sender;
        uint256 premintAmount = 3 ether;
        uint256 maxSupply = 100_000_000 ether;

        vm.startBroadcast();
        new LoreumToken(receiver, premintAmount, maxSupply);
        vm.stopBroadcast();
    }
}