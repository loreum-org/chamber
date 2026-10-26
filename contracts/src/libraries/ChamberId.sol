// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Stable id a Chamber implementation returns from `CHAMBER_ID()`.
/// @dev Wallet upgrades through ProxyAdmin require the next implementation to return {ID}.
///      Keep this value across versions. It is not the ERC-1967 implementation slot, and a
///      contract that copies the getter can still pass: the check rejects non-Chamber targets,
///      it does not prove bytecode equality.
library ChamberId {
    bytes32 internal constant ID = keccak256("loreum.chamber.implementation");

    /// @dev Selector of `CHAMBER_ID()`.
    bytes4 internal constant SELECTOR = bytes4(keccak256("CHAMBER_ID()"));

    /// @dev `ProxyAdmin.upgradeAndCall(address,address,bytes)`.
    bytes4 internal constant UPGRADE_AND_CALL = bytes4(keccak256("upgradeAndCall(address,address,bytes)"));
}
