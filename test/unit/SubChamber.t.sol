// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChamberRegistry} from "src/ChamberRegistry.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

contract SubChamberTest is Test {
    ChamberRegistry public registry;
    MockERC20 public rootAsset;
    MockERC721 public nft;
    address public admin = makeAddr("admin");

    function setUp() public {
        rootAsset = new MockERC20("Root Asset", "ROOT", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        registry = DeployRegistry.deploy(admin);
    }

    function test_SubChamber_Hierarchy() public {
        // 1. Create Root Chamber
        address rootChamber = registry.createChamber(
            address(rootAsset),
            address(nft),
            5,
            "Root Vault Token",
            "govROOT"
        );

        // 2. Create Sub Chamber using Root Chamber as asset
        address subChamber = registry.createChamber(
            rootChamber,
            address(nft),
            5,
            "Sub Vault Token",
            "yieldROOT"
        );

        // 3. Verify Hierarchy
        assertEq(registry.getParentChamber(subChamber), rootChamber);
        assertEq(registry.getParentChamber(rootChamber), address(0));

        address[] memory children = registry.getChildChambers(rootChamber);
        assertEq(children.length, 1);
        assertEq(children[0], subChamber);

        address[] memory subChildren = registry.getChildChambers(subChamber);
        assertEq(subChildren.length, 0);
    }

    function test_DeepHierarchy() public {
        // Level 0
        address root = registry.createChamber(address(rootAsset), address(nft), 5, "L0", "L0");
        
        // Level 1
        address level1 = registry.createChamber(root, address(nft), 5, "L1", "L1");
        
        // Level 2
        address level2 = registry.createChamber(level1, address(nft), 5, "L2", "L2");

        assertEq(registry.getParentChamber(level2), level1);
        assertEq(registry.getParentChamber(level1), root);
        assertEq(registry.getParentChamber(root), address(0));

        assertEq(registry.getChildChambers(root)[0], level1);
        assertEq(registry.getChildChambers(level1)[0], level2);
    }
}
