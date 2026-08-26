// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title BoardTypes
 * @author xhad, Loreum DAO LLC
 * @notice Shared structs matching on-chain `Board` storage layouts.
 * @dev `Node.next` / `Node.prev` are `uint128` and pack into one slot, matching `Board.Node`.
 *      `IBoard.getMember` ABI-widens those links to `uint256`; this library describes storage,
 *      not that getter ABI.
 */
library BoardTypes {
    /**
     * @notice Node structure for the doubly linked list
     * @dev Each node represents a token delegation with links to maintain sorted order.
     *      next and prev are uint128, packed into one storage slot.
     *      tokenIds > type(uint128).max are rejected at insertion time.
     * @param tokenId Unique identifier for the token
     * @param amount Total amount of tokens delegated to this node
     * @param next TokenId of the next node in the sorted list (0 if none)
     * @param prev TokenId of the previous node in the sorted list (0 if none)
     */
    struct Node {
        uint256 tokenId; // slot 0
        uint256 amount; // slot 1
        uint128 next; // slot 2 lower 128 bits
        uint128 prev; // slot 2 upper 128 bits
    }

    /**
     * @notice Structure representing a proposal to update the number of board seats
     * @param proposedSeats The proposed new number of seats
     * @param timestamp When the proposal was created
     * @param requiredQuorum The quorum required at proposal time
     * @param supporters Array of tokenIds that have supported this proposal
     */
    struct SeatUpdate {
        uint256 proposedSeats;
        uint256 timestamp;
        uint256 requiredQuorum;
        uint256[] supporters;
    }
}
