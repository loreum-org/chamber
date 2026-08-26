// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

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
     * @notice Returns a capped first page of child chambers registered under a parent.
     * @dev Convenience wrapper. Prefer `getChildChambers(chamber, limit, skip)` plus
     *      `getChildChamberCount` when the index may exceed the page cap.
     * @param chamber The parent chamber proxy address
     * @return children First page of child chamber addresses (may be empty)
     */
    function getChildChambers(address chamber) external view returns (address[] memory children);

    /**
     * @notice Returns a paginated slice of child chambers registered under a parent.
     * @param chamber The parent chamber proxy address
     * @param limit Maximum addresses to return (clamped to the registry page cap)
     * @param skip Number of child entries to skip
     * @return children Page of child chamber addresses (may be empty)
     */
    function getChildChambers(address chamber, uint256 limit, uint256 skip)
        external
        view
        returns (address[] memory children);

    /**
     * @notice Returns the number of child chambers indexed under a parent.
     * @param chamber The parent chamber proxy address
     * @return count Length of the child index (permissionless registrations included)
     */
    function getChildChamberCount(address chamber) external view returns (uint256 count);
}
