// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IBoard} from "./interfaces/IBoard.sol";

/**
 * @title Board
 * @author xhad, Loreum DAO LLC
 * @notice Manages a sorted linked list of nodes representing token delegations and board seats
 * @dev Abstract contract that implements core board functionality including delegation tracking
 *      and seat management. Uses a doubly linked list to maintain sorted order of delegations.
 *
 */
abstract contract Board {
    /**
     * @notice Node structure for the doubly linked list
     * @dev next and prev are uint128, packed into one storage slot.
     *      tokenIds > type(uint128).max are rejected at insertion time.
     * @param tokenId Unique identifier for the token
     * @param amount Total amount of tokens delegated to this node
     * @param next TokenId of the next node in the sorted list (0 if none)
     * @param prev TokenId of the previous node in the sorted list (0 if none)
     */
    struct Node {
        uint256 tokenId; // slot 0
        uint256 amount;  // slot 1
        uint128 next;    // slot 2 lower 128 bits
        uint128 prev;    // slot 2 upper 128 bits
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

    /**
     * @notice ERC-7201 namespaced storage layout for Board
     * @dev size and seats are uint32, sharing one 32-byte slot (max values 50 and 20 fit
     *      comfortably). locked has been removed; reentrancy is handled via transient storage.
     * @custom:storage-location erc7201:loreum.Board
     */
    struct BoardStorage {
        mapping(uint256 => Node) nodes;
        SeatUpdate seatUpdate;
        uint256 head;
        uint256 tail;
        uint32 size;  // packed with seats (shares one slot)
        uint32 seats; // packed with size (shares one slot)
    }

    /// @notice Maximum number of nodes allowed in the linked list
    uint256 internal constant MAX_NODES = 50;

    /**
     * @dev Transient storage slot used for the circuit-breaker reentrancy lock.
     *      Uses a domain-separated value to avoid collisions with other contracts that
     *      might also use transient storage in the same call chain.
     *      Value: uint256(keccak256("loreum.Board.circuitBreaker"))
     */
    uint256 private constant _TRANSIENT_LOCK_SLOT =
        0x63a9d87af1ca3d71f80fefdfe0f7c45cfede4a17e7c60e4bd0c022a28e82e0c;

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Board")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _BOARD_STORAGE_SLOT = 0xae916af301d5dc481b59b170e7db23e36b830da7017e456f99549768499c8800;

    function _getBoardStorage() internal pure returns (BoardStorage storage $) {
        assembly {
            $.slot := _BOARD_STORAGE_SLOT
        }
    }

    /// @dev Events and errors are defined in IBoard interface

    /// MODIFIERS ///

    /**
     * @notice Circuit-breaker modifier using EIP-1153 transient storage.
     * @dev Sets a transient lock on entry; clears it after body executes.
     *      TSTORE/TLOAD cost ~100 gas each vs. ~20k/2.1k for SSTORE/SLOAD on a cold slot.
     */
    modifier circuitBreaker() {
        _circuitBreakerBefore();
        _;
        _circuitBreakerAfter();
    }

    function _circuitBreakerBefore() internal {
        bool locked;
        uint256 slot = _TRANSIENT_LOCK_SLOT;
        assembly {
            locked := tload(slot)
        }
        if (locked) revert IBoard.CircuitBreakerActive();
        assembly {
            tstore(slot, 1)
        }
    }

    function _circuitBreakerAfter() internal {
        uint256 slot = _TRANSIENT_LOCK_SLOT;
        assembly {
            tstore(slot, 0)
        }
    }

    /// FUNCTIONS ///

    /**
     * @notice Retrieves node information for a given tokenId
     * @param tokenId The token ID to query
     * @return Node struct containing the node's data
     */
    function _getNode(uint256 tokenId) internal view returns (Node memory) {
        return _getBoardStorage().nodes[tokenId];
    }

    /**
     * @notice Handles token delegation to a specific tokenId
     * @dev Updates or creates a node and maintains sorted order.
     *      The circuitBreaker modifier locks transient storage for the full operation.
     * @param tokenId The token ID to delegate to
     * @param amount The amount of tokens to delegate
     */
    function _delegate(uint256 tokenId, uint256 amount) internal circuitBreaker {
        BoardStorage storage $ = _getBoardStorage();
        Node storage node = $.nodes[tokenId];
        if (node.tokenId == tokenId) {
            node.amount += amount;
            _reposition(tokenId);
        } else {
            _insert(tokenId, amount);
        }
        emit IBoard.Delegate(msg.sender, tokenId, amount);
    }

    /**
     * @notice Handles token undelegation from a specific tokenId
     * @dev Reduces delegation amount or removes node if amount becomes zero.
     *      The circuitBreaker modifier locks transient storage for the full operation.
     * @param tokenId The token ID to undelegate from
     * @param amount The amount of tokens to undelegate
     */
    function _undelegate(uint256 tokenId, uint256 amount) internal circuitBreaker {
        BoardStorage storage $ = _getBoardStorage();
        Node storage node = $.nodes[tokenId];
        if (node.tokenId != tokenId) revert IBoard.NodeDoesNotExist();
        if (amount > node.amount) revert IBoard.AmountExceedsDelegation();

        node.amount -= amount;

        if (node.amount == 0) {
            _remove(tokenId);
        } else {
            _reposition(tokenId);
        }
        emit IBoard.Undelegate(msg.sender, tokenId, amount);
    }

    /**
     * @notice Repositions a node in the sorted list after its amount changes
     * @dev Uses an in-place directional nudge: bubbles the node UP if its amount increased
     *      (swap with predecessor until sorted), or sinks it DOWN if amount decreased.
     *      Compared to the previous remove+re-insert approach, this avoids a full `delete`
     *      (4-slot zero write + SSTORE refund complexity) and a fresh cold-slot insert scan.
     *      Worst case is still O(N), but the common single-step move costs ~6 SSTOREs vs ~14+.
     *      Called only from within a circuitBreaker-locked context (_delegate / _undelegate).
     * @param tokenId The token ID to reposition
     */
    function _reposition(uint256 tokenId) internal {
        BoardStorage storage $ = _getBoardStorage();
        if ($.nodes[tokenId].tokenId != tokenId) revert IBoard.NodeDoesNotExist();
        uint256 amount = $.nodes[tokenId].amount;

        // Bubble UP: node's amount increased, move toward head
        while ($.nodes[tokenId].prev != 0 && amount > $.nodes[$.nodes[tokenId].prev].amount) {
            _swapUp(tokenId, $);
        }

        // If we didn't move up, try sinking DOWN: amount decreased, move toward tail
        // (Equal amounts keep current position — descending order, ties stay in place)
        if ($.nodes[tokenId].prev == 0 || amount <= $.nodes[$.nodes[tokenId].prev].amount) {
            while ($.nodes[tokenId].next != 0 && amount < $.nodes[$.nodes[tokenId].next].amount) {
                _swapDown(tokenId, $);
            }
        }
    }

    /**
     * @notice Swaps tokenId one position toward the head (with its predecessor).
     * @dev Before: A ↔ prevId ↔ tokenId ↔ B
     *      After:  A ↔ tokenId ↔ prevId ↔ B
     *      Modifies at most 6 pointer fields + possibly head/tail.
     */
    function _swapUp(uint256 tokenId, BoardStorage storage $) private {
        uint256 prevId = uint256($.nodes[tokenId].prev);
        uint256 aId = uint256($.nodes[prevId].prev);
        uint256 bId = uint256($.nodes[tokenId].next);

        // tokenId takes prevId's position
        if (aId != 0) {
            $.nodes[aId].next = uint128(tokenId);
        } else {
            $.head = tokenId;
        }
        $.nodes[tokenId].prev = uint128(aId);
        $.nodes[tokenId].next = uint128(prevId);

        // prevId takes tokenId's old position
        $.nodes[prevId].prev = uint128(tokenId);
        $.nodes[prevId].next = uint128(bId);
        if (bId != 0) {
            $.nodes[bId].prev = uint128(prevId);
        } else {
            $.tail = prevId;
        }
    }

    /**
     * @notice Swaps tokenId one position toward the tail (with its successor).
     * @dev Before: A ↔ tokenId ↔ nextId ↔ B
     *      After:  A ↔ nextId ↔ tokenId ↔ B
     *      Modifies at most 6 pointer fields + possibly head/tail.
     */
    function _swapDown(uint256 tokenId, BoardStorage storage $) private {
        uint256 nextId = uint256($.nodes[tokenId].next);
        uint256 aId = uint256($.nodes[tokenId].prev);
        uint256 bId = uint256($.nodes[nextId].next);

        // nextId takes tokenId's position
        if (aId != 0) {
            $.nodes[aId].next = uint128(nextId);
        } else {
            $.head = nextId;
        }
        $.nodes[nextId].prev = uint128(aId);
        $.nodes[nextId].next = uint128(tokenId);

        // tokenId goes after nextId
        $.nodes[tokenId].prev = uint128(nextId);
        $.nodes[tokenId].next = uint128(bId);
        if (bId != 0) {
            $.nodes[bId].prev = uint128(tokenId);
        } else {
            $.tail = tokenId;
        }
    }

    /**
     * @notice Inserts a new node into the sorted linked list
     * @dev Maintains descending order by amount.
     *      Rejects tokenIds > type(uint128).max since next/prev are stored as uint128.
     * @param tokenId The token ID to insert
     * @param amount The delegation amount for the node
     */
    function _insert(uint256 tokenId, uint256 amount) internal {
        if (tokenId > type(uint128).max) revert IBoard.TokenIdTooLarge();

        BoardStorage storage $ = _getBoardStorage();
        if ($.size >= MAX_NODES) {
            if (amount <= $.nodes[$.tail].amount) revert IBoard.MaxNodesReached();
            _remove($.tail);
        }

        if ($.head == 0) {
            _initializeFirstNode(tokenId, amount);
        } else {
            _insertNodeInOrder(tokenId, amount);
        }
        unchecked {
            $.size++;
        }
    }

    /**
     * @notice Initializes the first node in an empty list
     * @param tokenId The token ID for the first node
     * @param amount The delegation amount
     */
    function _initializeFirstNode(uint256 tokenId, uint256 amount) private {
        BoardStorage storage $ = _getBoardStorage();
        $.nodes[tokenId] = Node({tokenId: tokenId, amount: amount, next: 0, prev: 0});
        $.head = tokenId;
        $.tail = tokenId;
    }

    /**
     * @notice Inserts a node in sorted order within an existing list
     * @dev Traverses from head to find correct position based on amount
     * @param tokenId The token ID to insert
     * @param amount The delegation amount
     */
    function _insertNodeInOrder(uint256 tokenId, uint256 amount) private {
        BoardStorage storage $ = _getBoardStorage();
        uint256 current = $.head;
        uint256 previous;

        unchecked {
            while (current != 0 && amount <= $.nodes[current].amount) {
                previous = current;
                current = uint256($.nodes[current].next);
            }

            Node storage newNode = $.nodes[tokenId];
            newNode.tokenId = tokenId;
            newNode.amount = amount;
            newNode.next = uint128(current);
            newNode.prev = uint128(previous);

            if (current == 0) {
                $.nodes[previous].next = uint128(tokenId);
                $.tail = tokenId;
            } else if (previous == 0) {
                $.nodes[current].prev = uint128(tokenId);
                $.head = tokenId;
            } else {
                $.nodes[previous].next = uint128(tokenId);
                $.nodes[current].prev = uint128(tokenId);
            }
        }
    }

    /**
     * @notice Removes a node from the linked list
     * @param tokenId The token ID to remove
     * @return True if removal was successful
     */
    function _remove(uint256 tokenId) internal returns (bool) {
        BoardStorage storage $ = _getBoardStorage();
        Node storage node = $.nodes[tokenId];

        if (node.tokenId != tokenId) {
            return false;
        }

        uint256 prev = uint256(node.prev);
        uint256 next = uint256(node.next);

        if (prev != 0) {
            $.nodes[prev].next = uint128(next);
        } else {
            $.head = next;
        }

        if (next != 0) {
            $.nodes[next].prev = uint128(prev);
        } else {
            $.tail = prev;
        }

        delete $.nodes[tokenId];

        if ($.size > 0) {
            unchecked {
                $.size--;
            }
        }
        return true;
    }

    /**
     * @notice Retrieves the top N nodes from the sorted list
     * @param count The number of top nodes to retrieve
     * @return tokenIds Array of token IDs in descending order by amount
     * @return amounts Array of corresponding delegation amounts
     */
    function _getTop(uint256 count) internal view returns (uint256[] memory, uint256[] memory) {
        BoardStorage storage $ = _getBoardStorage();
        uint256 _size = $.size;

        if (_size == 0) {
            return (new uint256[](0), new uint256[](0));
        }

        uint256 resultCount = count > _size ? _size : count;
        uint256[] memory tokenIds = new uint256[](resultCount);
        uint256[] memory amounts = new uint256[](resultCount);

        uint256 current = $.head;
        for (uint256 i = 0; i < resultCount && current != 0; i++) {
            tokenIds[i] = current;
            amounts[i] = $.nodes[current].amount;
            current = uint256($.nodes[current].next);
        }

        return (tokenIds, amounts);
    }

    /**
     * @notice Calculates the current quorum requirement
     * @dev Quorum is 51% of seats + 1
     * @return The number of confirmations required for quorum
     */
    function _getQuorum() internal view returns (uint256) {
        return 1 + (_getBoardStorage().seats * 51) / 100;
    }

    /**
     * @notice Returns the current number of board seats
     * @return The current number of seats
     */
    function _getSeats() internal view returns (uint256) {
        return _getBoardStorage().seats;
    }

    /**
     * @notice Sets or proposes a new number of board seats
     * @dev Initial call sets seats directly; subsequent calls create/update proposals
     * @param tokenId The token ID proposing the change (0 for initial setup)
     * @param numOfSeats The proposed number of seats
     */
    function _setSeats(uint256 tokenId, uint256 numOfSeats) internal {
        if (numOfSeats <= 0) revert IBoard.InvalidNumSeats();

        BoardStorage storage $ = _getBoardStorage();

        if ($.seats == 0) {
            $.seats = uint32(numOfSeats);
            emit IBoard.ExecuteSetSeats(tokenId, numOfSeats);
            return;
        }

        SeatUpdate storage proposal = $.seatUpdate;

        if (proposal.timestamp == 0) {
            proposal.proposedSeats = numOfSeats;
            proposal.timestamp = block.timestamp;
            proposal.requiredQuorum = _getQuorum();
        } else {
            if (proposal.proposedSeats != numOfSeats) {
                // Only proposer can cancel (Fix Finding 14 — prevents minority griefing)
                if (proposal.supporters.length == 0 || proposal.supporters[0] != tokenId) {
                    revert IBoard.OnlyProposerCanCancel();
                }
                delete $.seatUpdate;
                emit IBoard.SeatUpdateCancelled(tokenId);
                return;
            }

            for (uint256 i; i < proposal.supporters.length;) {
                if (proposal.supporters[i] == tokenId) {
                    revert IBoard.AlreadySentUpdateRequest();
                }
                unchecked {
                    ++i;
                }
            }
        }

        proposal.supporters.push(tokenId);
        emit IBoard.SetSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal
     * @dev Requires proposal to exist, timelock expired, and quorum maintained.
     *      Builds the top-seat set in a single O(seats) list walk, then checks each supporter
     *      against that in-memory set — O(supporters × seats) in the worst case but with only
     *      memory reads after the initial walk (vs. the old approach of one full SLOAD walk per
     *      supporter). Eliminates up to 380 redundant SLOADs when seats = supporters = 20.
     * @param tokenId The token ID executing the update
     */
    function _executeSeatsUpdate(uint256 tokenId) internal {
        BoardStorage storage $ = _getBoardStorage();
        SeatUpdate storage proposal = $.seatUpdate;

        if (proposal.timestamp == 0) revert IBoard.InvalidProposal();
        if (block.timestamp < proposal.timestamp + 7 days) revert IBoard.TimelockNotExpired();

        // Build the top-seat set with a single O(seats) list walk
        uint256 s = $.seats;
        uint256[] memory topIds = new uint256[](s);
        uint256 current = $.head;
        uint256 filled;
        unchecked {
            while (current != 0 && filled < s) {
                topIds[filled] = current;
                current = uint256($.nodes[current].next);
                ++filled;
            }
        }

        // Count valid supporters using in-memory set (O(1) per member after the walk above)
        uint256 validSupport;
        uint256 supportersLen = proposal.supporters.length;
        unchecked {
            for (uint256 i; i < supportersLen; ++i) {
                uint256 sup = proposal.supporters[i];
                for (uint256 j; j < filled; ++j) {
                    if (topIds[j] == sup) {
                        ++validSupport;
                        break;
                    }
                }
            }
        }

        if (validSupport < proposal.requiredQuorum) {
            revert IBoard.InsufficientVotes();
        }

        uint256 newSeats = proposal.proposedSeats;
        $.seats = uint32(newSeats);
        delete $.seatUpdate;
        emit IBoard.ExecuteSetSeats(tokenId, newSeats);
    }
}
