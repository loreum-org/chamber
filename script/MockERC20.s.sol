// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "test/mock/MockERC20.sol";

contract DeployMockERC20 is Script {
    function run() external {
        // Default values, can be overridden with env vars
        string memory name = vm.envOr("TOKEN_NAME", string("Mock Token"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("MOCK"));
        uint256 initialSupply = vm.envOr("TOKEN_SUPPLY", uint256(1_000_000 ether));

        vm.startBroadcast();

        MockERC20 token = new MockERC20(name, symbol, initialSupply);
        
        console.log("MockERC20 deployed at:", address(token));
        console.log("  Name:", name);
        console.log("  Symbol:", symbol);
        console.log("  Initial Supply:", initialSupply / 1 ether, "tokens");

        vm.stopBroadcast();
    }
}
