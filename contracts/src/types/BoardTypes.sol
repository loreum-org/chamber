// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EnumerableSet} from "lib/openzeppelin-contracts/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title BoardTypes
 * @author xhad, Loreum DAO LLC
 * @notice Shared structs matching on-chain `Board` storage layouts.
 * @dev `Node.next` / `Node.prev` are `uint128` and pack into one slot, matching `Board.Node`.
 *      `IBoard.getMember` ABI-widens those links to `uint256`; this library describes storage,
 *      not that getter ABI.
 */
library BoardTypes {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @notice Node structure for the doubly linked list
     * @dev Each node represents a token delegation with links to maintain sorted order.
     *      next and prev are uint128, packed into one storage slot.
     *      tokenIds > type(uint128).max are rejected at insertion time.
     */
    struct Node {
        uint256 tokenId; // slot 0
        uint256 amount; // slot 1
        uint128 next; // slot 2 lower 128 bits
        uint128 prev; // slot 2 upper 128 bits
    }

    /**
     * @notice Structure representing a proposal to update the number of board seats
     */
    struct SeatUpdate {
        uint256 proposedSeats;
        uint256 timestamp;
        uint256 requiredQuorum;
        uint256[] supporters;
    }

    /**
     * @notice ERC-7201 namespaced storage layout for Board
     * @custom:storage-location erc7201:loreum.Board
     */
    struct BoardStorage {
        mapping(uint256 => Node) nodes;
        SeatUpdate seatUpdate;
        uint256 head;
        uint256 tail;
        uint32 size;
        uint32 seats;
        /// @dev Unix time from which the seat may act (1.4.0+; earlier versions stored a block number).
        mapping(uint256 tokenId => uint256 activatesAt) seatedAt;
        /// @dev Unused since 1.3.0 (pre-upgrade delegation backfill removed). Kept for layout stability.
        EnumerableSet.UintSet evictedTokenIds;
        /// @dev `ownerOf` snapshotted when seating last bound. Appended so existing ERC-7201 slots stay stable.
        mapping(uint256 tokenId => address) seatedOwner;
        /// @dev Bumped each time a node is removed (eviction, drain, inert cleanup). Holder weight
        ///      recorded under an older epoch is not in the current node. Appended for layout safety.
        mapping(uint256 tokenId => uint256) nodeEpoch;
        /// @dev Token that opened the live seat proposal. Appended. Zero falls back to `supporters[0]`
        ///      so a proposal created before this field still cancels the same way.
        uint256 seatProposalProposer;
        /// @dev `ownerOf` when `tokenId` endorsed the live seat proposal. A mismatch does not count
        ///      (R-1012-M5). Appended so existing ERC-7201 slots stay put. Zero means "not recorded"
        ///      and still counts, for a proposal written before this field existed.
        mapping(uint256 tokenId => address) seatSupporter;
        /// @dev Block in which a seated id fell out of the top seats (R-1110-C1). Its clock restarts
        ///      only if it is still out at a later block, so a flash bump out and back in does not
        ///      reset an honest director. Appended so existing ERC-7201 slots stay put.
        mapping(uint256 tokenId => uint256 blockNumber) droppedAt;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Board")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant STORAGE_SLOT = 0xae916af301d5dc481b59b170e7db23e36b830da7017e456f99549768499c8800;

    /// @notice Maximum number of nodes allowed in the linked list
    uint256 internal constant MAX_NODES = 50;

    /// @notice Time a newly seated tokenId must wait before exercising director rights (R-1110-C1).
    ///         Long enough that a takeover must hold its capital in public, and holders can
    ///         out-delegate it or withdraw before it can act.
    uint256 internal constant SEATING_DELAY = 2 days;

    /// @notice Delay after a seat-update proposal is created before it may be executed
    uint256 internal constant SEAT_UPDATE_TIMELOCK = 7 days;

    /// @notice Age after which any current director may delete a seat-update proposal
    uint256 internal constant SEAT_UPDATE_EXPIRY = 14 days;

    /// @dev Written when `ownerOf` fails after a seat was bound, so a later mint is a new controller
    ///      (R-1012-L4). Not `address(0)`, which is the "never bound" snap.
    address internal constant UNBOUND_SEAT_OWNER = address(uint160(uint256(keccak256("loreum.board.unbound-seat"))));
}
