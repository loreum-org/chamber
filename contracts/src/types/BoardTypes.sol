// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title BoardTypes
 * @author xhad, Loreum DAO LLC
 * @notice Legacy reference structs for documentation and off-chain tooling.
 * @dev Canonical on-chain layout is `Board.Node` (packed `uint128` links) and `Board.SeatUpdate`; do not assume byte-for-byte equivalence.
 */
library BoardTypes {
    /**
     * @notice Node structure for the doubly linked list
     * @dev Each node represents a token delegation with links to maintain sorted order
     * @param tokenId Unique identifier for the token
     * @param amount Total amount of tokens delegated to this node
     * @param next TokenId of the next node in the sorted list (0 if none)
     * @param prev TokenId of the previous node in the sorted list (0 if none)
     */
    struct Node {
        uint256 tokenId;
        uint256 amount;
        uint256 next;
        uint256 prev;
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
