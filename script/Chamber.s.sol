// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {Chamber} from "src/Chamber.sol";

contract DeployChamber is Script {
    address nft;
    address asset;

    function run() external {
        vm.startBroadcast();

        if (block.chainid == 1) {
            // Sepolia
            asset = 0x7756D245527F5f8925A537be509BF54feb2FdC99;
            nft = 0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15;
        } else if (block.chainid == 11155111) {
            // Sepolia
            asset = 0xedf2e61ADD8976AC08Df4AFB69faDCD1428555f7;
            nft = 0xe02A8f23c19280dd828Eb5CA5EC89d64345f06d8;
        } else if (block.chainid == 8453) {
            // BASE LORE
            asset = 0xF4ac405E0Dca671E8F733D497caD89c776FbF118;
            // base.eth
            nft = 0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a;
        }

        new Chamber(asset, nft, 5, "cLORE", "Chamber LORE");

        vm.stopBroadcast();
    }
}
