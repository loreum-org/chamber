// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployChamber} from "test/utils/DeployChamber.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {
    ITransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract UnauthorizedUpgradeTest is Test {
    Registry public registry;
    Chamber public implementation;
    MockERC20 public token;
    MockERC721 public nft;
    address public admin = makeAddr("admin");
    address public attacker = makeAddr("attacker");
    address public chamberAddress;
    IChamber public chamber;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1000000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        implementation = new Chamber();
        chamberAddress =
            address(DeployChamber.deployViaFactory(address(token), address(nft), 5, "Chamber Token", "CHMB", admin));
        chamber = IChamber(chamberAddress);
    }

    function test_Exploit_UnauthorizedUpgrade() public {
        Chamber maliciousImpl = new Chamber();

        // Get initial implementation
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address initialImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));

        // Since 1.3.0 the only upgrade path is the chamber-owned ProxyAdmin. An outsider calling it
        // directly is rejected by Ownable.
        ProxyAdmin proxyAdmin = ProxyAdmin(chamber.getProxyAdmin());
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        proxyAdmin.upgradeAndCall(ITransparentUpgradeableProxy(chamberAddress), address(maliciousImpl), "");

        // The removed `upgradeImplementation(address,bytes)` selector now reverts in the fallback.
        vm.prank(attacker);
        (bool ok,) = chamberAddress.call(abi.encodeWithSelector(bytes4(0xc89311b6), address(maliciousImpl), ""));
        assertFalse(ok);

        // Verify upgrade did NOT happen
        address currentImpl = address(uint160(uint256(vm.load(chamberAddress, implSlot))));

        assertEq(currentImpl, initialImpl, "Implementation should not change");
        assertNotEq(currentImpl, address(maliciousImpl), "Should not be malicious impl");
    }
}
