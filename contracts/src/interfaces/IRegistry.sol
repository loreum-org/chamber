// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title IRegistry
 * @author xhad, Loreum DAO LLC
 * @notice Minimal read API for chamber hierarchy links (parent / child chambers).
 * @dev `Registry` implements this interface plus deployment and indexing functions.
 *      Parent/child relationships are set in `createChamber` when `erc20Token` is itself a
 *      registered chamber, modelling sub-chambers that use another chamber's token as asset.
 */
interface IRegistry {
    /**
     * @notice Returns the parent chamber for a sub-chamber, if any.
     * @param chamber The chamber proxy address to query
     * @return parent The parent chamber address, or `address(0)` if `chamber` is a root chamber
     */
    function getParentChamber(address chamber) external view returns (address parent);

    /**
     * @notice Returns all child chambers registered under a parent chamber.
     * @param chamber The parent chamber proxy address
     * @return children Array of child chamber addresses (may be empty)
     */
    function getChildChambers(address chamber) external view returns (address[] memory children);
}
