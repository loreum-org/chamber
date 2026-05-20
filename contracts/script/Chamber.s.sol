// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Chamber} from "src/Chamber.sol";
import {DeployChamber as DeployChamberLib} from "test/utils/DeployChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";

contract DeployChamber is Script {
    using stdJson for string;

    address nft;
    address asset;
    address admin;

    function run() external {
        vm.startBroadcast();

        if (block.chainid == 1) {
            // Mainnet
            asset = 0x7756D245527F5f8925A537be509BF54feb2FdC99;
            nft = 0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15;
            admin = 0x345F273fAE2CeC49e944BFBEf4899fA1625803C5;
        } else if (block.chainid == 11155111) {
            // Sepolia
            asset = 0xedf2e61ADD8976AC08Df4AFB69faDCD1428555f7;
            nft = 0xe02A8f23c19280dd828Eb5CA5EC89d64345f06d8;
            admin = 0x345F273fAE2CeC49e944BFBEf4899fA1625803C5;
        } else if (block.chainid == 8453) {
            // Base
            asset = 0xF4ac405E0Dca671E8F733D497caD89c776FbF118;
            nft = 0x03c4738Ee98aE44591e1A4A4F3CaB6641d95DD9a;
            admin = 0x345F273fAE2CeC49e944BFBEf4899fA1625803C5;
        } else if (block.chainid == 31337) {
            // Local anvil: prefer tokens from deployments.json (`make deploy-all-anvil`)
            // so the app header "Mint Test Member Token" targets the same ERC721 as the chamber.
            admin = msg.sender;

            bool reused = false;
            if (vm.exists("deployments.json")) {
                string memory dj = vm.readFile("deployments.json");
                uint256 djChainId = dj.readUint(".chainId");
                address cachedAsset = dj.readAddress(".mockERC20");
                address cachedNft = dj.readAddress(".mockERC721");
                if (djChainId == block.chainid && cachedAsset != address(0) && cachedNft != address(0)) {
                    asset = cachedAsset;
                    nft = cachedNft;
                    reused = true;
                    console.log("Reusing mocks from deployments.json (same addresses as Chamber app localhost):");
                    console.log("  mockERC20 :", asset);
                    console.log("  mockERC721:", nft);
                }
            }

            if (!reused) {
                MockERC20 mockAsset = new MockERC20("Mock Token", "MOCK", 1_000_000 ether);
                MockERC721 mockNft = new MockERC721("Mock NFT", "MNFT");

                asset = address(mockAsset);
                nft = address(mockNft);

                console.log("deployments.json missing or invalid - deployed NEW mocks:");
                console.log("  MockERC20 at:", asset);
                console.log("  MockERC721 at:", nft);
                console.log("Update contracts/deployments.json or deploy via Deploy Chamber UI to stay in sync.");
            }
        } else {
            revert("Unsupported chain");
        }

        Chamber chamber = DeployChamberLib.deploy(asset, nft, 5, "Chamber LORE", "cLORE", admin);
        console.log("Chamber deployed at:", address(chamber));

        vm.stopBroadcast();
    }
}
