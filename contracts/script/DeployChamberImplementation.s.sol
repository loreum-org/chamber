// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Chamber} from "src/Chamber.sol";
import {MainnetDeployGuard} from "script/MainnetDeployGuard.sol";

/**
 * @title DeployChamberImplementation
 * @notice Step 1 of a chamber upgrade: deploy a new Chamber implementation (no proxy, no init).
 *         Step 2 is `script/ProposeChamberUpgrade.s.sol`, which queues the board's quorum tx.
 * @dev Foundry auto-deploys and links BoardLib / WalletLib. The implementation's constructor
 *      disables initializers, so the bare implementation cannot be initialized or used.
 *
 * Simulate (no broadcast):
 *   forge script script/DeployChamberImplementation.s.sol:DeployChamberImplementation --rpc-url $RPC -vvv
 *
 * Chain id 1 broadcast is gated by `MAINNET_DEPLOY_UNBLOCKED=1` (Chad-only).
 */
contract DeployChamberImplementation is Script {
    function run() external returns (address implementation) {
        if (block.chainid == 1) MainnetDeployGuard.revertIfBroadcastBlocked();

        vm.startBroadcast();
        implementation = address(new Chamber());
        vm.stopBroadcast();

        console.log("========================================");
        console.log("DeployChamberImplementation");
        console.log("========================================");
        console.log("Chamber implementation ", implementation);
        console.log("VERSION                ", string(abi.encodePacked(Chamber(payable(implementation)).VERSION())));
        console.log("Runtime size (bytes)   ", implementation.code.length);
        console.log("Next: CHAMBER=<proxy> NEW_IMPLEMENTATION=<this> TOKEN_ID=<seat>");
        console.log("      forge script script/ProposeChamberUpgrade.s.sol:ProposeChamberUpgrade");
    }
}
