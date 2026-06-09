// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {IChamber} from "src/interfaces/IChamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

/// @notice Symbolic verification of Registry access control and chamber lifecycle via Halmos
contract RegistrySymTest is Test, SymTest {
    Registry internal registry;
    Chamber internal alternateImpl;
    MockERC20 internal token;
    MockERC721 internal nft;

    address internal admin = makeAddr("admin");

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 1_000_000e18);
        nft = new MockERC721("Mock NFT", "MNFT");
        registry = DeployRegistry.deploy(admin);
        alternateImpl = new Chamber();
    }

    /// @dev Valid seat counts register a new chamber and increment the chamber count
    function symbolicCreateChamberValidSeats() public {
        uint256 seats = svm.createUint(5, "seats");
        vm.assume(seats >= 1 && seats <= 20);

        uint256 countBefore = registry.getChamberCount();

        address payable chamber = registry.createChamber(address(token), address(nft), seats, "Chamber", "CHMB");

        assertTrue(registry.isChamber(chamber));
        assertEq(registry.getChamberCount(), countBefore + 1);
        assertEq(IChamber(chamber).getSeats(), seats);
        assertEq(IChamber(chamber).asset(), address(token));
    }

    /// @dev Zero or excessive seat counts cannot create a chamber
    function symbolicCreateChamberInvalidSeatsReverts() public {
        uint256 seats = svm.createUint256("seats");
        vm.assume(seats == 0 || seats > 20);

        uint256 countBefore = registry.getChamberCount();

        (bool success,) = address(registry).call(
            abi.encodeCall(Registry.createChamber, (address(token), address(nft), seats, "Chamber", "CHMB"))
        );

        assertFalse(success);
        assertEq(registry.getChamberCount(), countBefore);
    }

    /// @dev Non-admin callers cannot update the chamber implementation pointer
    function symbolicSetImplementationNonAdminReverts() public {
        address caller = svm.createAddress("caller");
        vm.assume(caller != admin);
        vm.assume(!registry.hasRole(registry.ADMIN_ROLE(), caller));

        address implBefore = registry.implementation();

        vm.prank(caller);
        (bool success,) =
            address(registry).call(abi.encodeCall(Registry.setChamberImplementation, (address(alternateImpl))));

        assertFalse(success);
        assertEq(registry.implementation(), implBefore);
    }

    /// @dev Admin can update the implementation pointer used for future chamber deploys
    function symbolicSetImplementationAdminUpdates() public {
        address implBefore = registry.implementation();
        vm.assume(address(alternateImpl) != implBefore);

        vm.prank(admin);
        registry.setChamberImplementation(address(alternateImpl));

        assertEq(registry.implementation(), address(alternateImpl));
    }

    /// @dev First chamber for an asset registers it in the asset index without duplicates
    function symbolicCreateChamberRegistersAsset() public {
        uint256 seats = svm.createUint(5, "seats");
        vm.assume(seats >= 1 && seats <= 20);

        assertEq(registry.getAssets().length, 0);

        registry.createChamber(address(token), address(nft), seats, "Chamber", "CHMB");

        address[] memory assets = registry.getAssets();
        assertEq(assets.length, 1);
        assertEq(assets[0], address(token));

        address[] memory byAsset = registry.getChambersByAsset(address(token));
        assertEq(byAsset.length, 1);
        assertTrue(registry.isChamber(byAsset[0]));
    }
}
