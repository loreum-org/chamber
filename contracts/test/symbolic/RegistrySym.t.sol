// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";
import {Registry} from "src/Registry.sol";
import {Chamber} from "src/Chamber.sol";
import {MockERC20} from "test/mock/MockERC20.sol";
import {MockERC721} from "test/mock/MockERC721.sol";
import {DeployRegistry} from "test/utils/DeployRegistry.sol";

/// @notice Symbolic verification of Registry access control. Create is disabled (PMN-M03 A).
contract RegistrySymTest is Test, SymTest {
    Registry internal registry;
    Chamber internal alternateImpl;
    MockERC20 internal token;
    MockERC721 internal nft;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);

    address public implementation;
    address public proxyAdmin;
    uint256 public chamberCount;
    address private _admin;
    bool private _initialized;

    function initialize(address impl, address admin) external {
        if (_initialized) revert("already initialized");
        if (admin == address(0) || impl == address(0)) revert ZeroAddress();
        _initialized = true;
        implementation = impl;
        proxyAdmin = admin;
        _admin = admin;
    }

    /// @dev Valid seats still cannot create; Factory is the Ethereum create path
    function symbolicCreateChamberValidSeats() public {
        uint256 seats = svm.createUint(5, "seats");
        vm.assume(seats >= 1 && seats <= 20);

    function setChamberImplementation(address newImplementation) external {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert NotAdmin();
        if (newImplementation == address(0)) revert ZeroAddress();
        if (implementation == newImplementation) return;
        implementation = newImplementation;
    }

        (bool success,) = address(registry).call(
            abi.encodeCall(Registry.createChamber, (address(token), address(nft), seats, "Chamber", "CHMB"))
        );

        assertFalse(success);
        assertEq(registry.getChamberCount(), countBefore);
    }

    /// @dev Invalid seats also revert (create is unconditionally disabled)
    function symbolicCreateChamberInvalidSeatsReverts() public {
        uint256 seats = svm.createUint256("seats");
        vm.assume(seats == 0 || seats > 20);

        uint256 countBefore = registry.getChamberCount();

        (bool success,) = address(registry).call(
            abi.encodeCall(RegistryPointerHarness.createChamber, (address(0x1), address(0x2), seats, "C", "C"))
        );

        assertFalse(success);
        assertEq(registry.getChamberCount(), countBefore);
        assertEq(registry.implementation(), IMPL);
    }

    /// @dev Zero token addresses cannot create a chamber
    function symbolicCreateChamberZeroTokenReverts() public {
        address erc20 = svm.createAddress("erc20");
        address erc721 = svm.createAddress("erc721");
        vm.assume(erc20 == address(0) || erc721 == address(0));

        uint256 countBefore = registry.getChamberCount();
        (bool success,) =
            address(registry).call(abi.encodeCall(RegistryPointerHarness.createChamber, (erc20, erc721, 3, "C", "C")));
        assertFalse(success);
        assertEq(registry.getChamberCount(), countBefore);
    }

    /// @dev Non-admin callers cannot update the chamber implementation pointer
    function symbolicSetImplementationNonAdminReverts() public {
        address caller = svm.createAddress("caller");
        address next = svm.createAddress("nextImpl");
        vm.assume(caller != ADMIN);
        vm.assume(next != address(0));
        vm.assume(!registry.hasRole(registry.ADMIN_ROLE(), caller));

        vm.prank(caller);
        (bool success,) = address(registry).call(abi.encodeCall(RegistryPointerHarness.setChamberImplementation, (next)));

        assertFalse(success);
        assertEq(registry.implementation(), IMPL);
    }

    /// @dev Admin can update the leftover implementation pointer (unused after create disable)
    function symbolicSetImplementationAdminUpdates() public {
        address next = svm.createAddress("nextImpl");
        vm.assume(next != address(0) && next != IMPL);

        vm.prank(ADMIN);
        registry.setChamberImplementation(next);

        assertEq(registry.implementation(), next);
    }

    /// @dev Create cannot register an asset in the leftover index
    function symbolicCreateChamberRegistersAsset() public {
        uint256 seats = svm.createUint(5, "seats");
        vm.assume(seats >= 1 && seats <= 20);

        assertEq(registry.getAssets().length, 0);

        (bool success,) = address(registry).call(
            abi.encodeCall(Registry.createChamber, (address(token), address(nft), seats, "Chamber", "CHMB"))
        );

        assertFalse(success);
        assertEq(registry.getAssets().length, 0);
        assertEq(registry.getChambersByAsset(address(token)).length, 0);
    }
}