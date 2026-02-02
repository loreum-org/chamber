// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IBoard} from "./interfaces/IBoard.sol";

/**
 * @title Board
 * @notice Manages a sorted linked list of nodes representing token delegations and board seats
 * @dev Abstract contract that implements core board functionality including delegation tracking
 *      and seat management. Uses a doubly linked list to maintain sorted order of delegations.
 */
abstract contract Board {
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

    /// @notice Maximum number of nodes allowed in the linked list
    uint256 internal constant MAX_NODES = 100;

    /// @notice Number of board seats
    uint256 private seats;

    /// @notice Mapping from tokenId to Node data
    mapping(uint256 => Node) internal nodes;

    /// @notice TokenId of the first node (highest amount)
    uint256 internal head;

    /// @notice TokenId of the last node (lowest amount)
    uint256 internal tail;

    /// @notice Total number of nodes in the list
    uint256 internal size;

    /// circuit breaker
    bool private locked;

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

    /// @notice Seat update proposal
    SeatUpdate internal seatUpdate;

    /// @dev Events and errors are defined in IBoard interface

    /// MODIFIERS ///

    /**
     * @notice Modifier that implements a circuit breaker pattern to pause functionality
     * @dev Sets a locked state during execution and releases after completion
     * @custom:throws "Circuit breaker active" if the contract is already locked
     */
    modifier circuitBreaker() {
        if (locked) revert IBoard.CircuitBreakerActive();
        locked = true;
        _;
        locked = false;
    }

    /**
     * @notice Modifier that prevents reentrancy and contract calls
     * @dev Prevents all calls when circuit breaker is active
     * @custom:throws "Circuit breaker active" if the contract is locked
     */
    modifier preventReentry() {
        if (locked) revert IBoard.CircuitBreakerActive();
        _;
    }

    /// @dev CircuitBreakerActive error is defined in IBoard interface

    /// FUNCTIONS ///

    /**
     * @notice Retrieves node information for a given tokenId
     * @param tokenId The token ID to query
     * @return Node struct containing the node's data
     */
    function _getNode(uint256 tokenId) internal view returns (Node memory) {
        return nodes[tokenId];
    }

    /**
     * @notice Handles token delegation to a specific tokenId
     * @dev Updates or creates a node and maintains sorted order
     * @param tokenId The token ID to delegate to
     * @param amount The amount of tokens to delegate
     */
    function _delegate(uint256 tokenId, uint256 amount) internal preventReentry {
        Node storage node = nodes[tokenId];
        if (node.tokenId == tokenId) {
            // Update existing node
            node.amount += amount;
            _reposition(tokenId);
        } else {
            // Create new node
            _insert(tokenId, amount);
        }
        emit IBoard.Delegate(msg.sender, tokenId, amount);
    }

    /**
     * @notice Handles token undelegation from a specific tokenId
     * @dev Reduces delegation amount or removes node if amount becomes zero
     * @param tokenId The token ID to undelegate from
     * @param amount The amount of tokens to undelegate
     */
    function _undelegate(uint256 tokenId, uint256 amount) internal preventReentry {
        Node storage node = nodes[tokenId];
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
     * @dev Removes and re-inserts the node to maintain sorted order
     * @param tokenId The token ID to reposition
     */
    function _reposition(uint256 tokenId) internal circuitBreaker {
        Node memory node = nodes[tokenId];
        if (node.tokenId != tokenId) revert IBoard.NodeDoesNotExist();
        
        bool success = _remove(tokenId);
        if (!success) revert IBoard.NodeDoesNotExist();
        
        _insert(tokenId, node.amount);
    }

    /**
     * @notice Inserts a new node into the sorted linked list
     * @dev Maintains descending order by amount
     * @param tokenId The token ID to insert
     * @param amount The delegation amount for the node
     */
    function _insert(uint256 tokenId, uint256 amount) internal {
        if (size >= MAX_NODES) revert IBoard.MaxNodesReached();
        
        if (head == 0) {
            _initializeFirstNode(tokenId, amount);
        } else {
            _insertNodeInOrder(tokenId, amount);
        }
        unchecked {
            size++;
        }
    }

    /**
     * @notice Initializes the first node in an empty list
     * @param tokenId The token ID for the first node
     * @param amount The delegation amount
     */
    function _initializeFirstNode(uint256 tokenId, uint256 amount) private {
        nodes[tokenId] = Node({tokenId: tokenId, amount: amount, next: 0, prev: 0});
        head = tokenId;
        tail = tokenId;
    }

    /**
     * @notice Inserts a node in sorted order within an existing list
     * @dev Traverses from head to find correct position based on amount
     * @param tokenId The token ID to insert
     * @param amount The delegation amount
     */
    function _insertNodeInOrder(uint256 tokenId, uint256 amount) private {
        // Cache head value
        uint256 current = head;
        uint256 previous;
        
        // Use unchecked for gas savings since we control node linking
        unchecked {
            // Find insertion point
            while (current != 0 && amount <= nodes[current].amount) {
                previous = current;
                current = nodes[current].next;
            }

            // Create new node
            Node storage newNode = nodes[tokenId];
            newNode.tokenId = tokenId;
            newNode.amount = amount;
            newNode.next = current;
            newNode.prev = previous;

            // Update links
            if (current == 0) {
                // Insert at tail
                nodes[previous].next = tokenId;
                tail = tokenId;
            } else if (previous == 0) {
                // Insert at head
                nodes[current].prev = tokenId;
                head = tokenId;
            } else {
                // Insert in middle
                nodes[previous].next = tokenId;
                nodes[current].prev = tokenId;
            }
        }
    }

    /**
     * @notice Removes a node from the linked list
     * @param tokenId The token ID to remove
     * @return True if removal was successful
     */
    function _remove(uint256 tokenId) internal returns (bool) {
        Node storage node = nodes[tokenId];
        
        // Check if node exists
        if (node.tokenId != tokenId) {
            return false;
        }
        
        uint256 prev = node.prev;
        uint256 next = node.next;

        if (prev != 0) {
            nodes[prev].next = next;
        } else {
            head = next;
        }

        if (next != 0) {
            nodes[next].prev = prev;
        } else {
            tail = prev;
        }

        delete nodes[tokenId];
        
        // Ensure size doesn't underflow
        if (size > 0) {
            unchecked {
                size--;
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
        uint256 _size = size;

        // Handle empty board
        if (_size == 0) {
            return (new uint256[](0), new uint256[](0));
        }

        uint256 resultCount = count > _size ? _size : count;
        uint256[] memory tokenIds = new uint256[](resultCount);
        uint256[] memory amounts = new uint256[](resultCount);

        uint256 current = head;
        for (uint256 i = 0; i < resultCount && current != 0; i++) {
            tokenIds[i] = current;
            amounts[i] = nodes[current].amount;
            current = nodes[current].next;
        }

        return (tokenIds, amounts);
    }

    /**
     * @notice Calculates the current quorum requirement
     * @dev Quorum is 51% of seats + 1
     * @return The number of confirmations required for quorum
     */
    function _getQuorum() internal view returns (uint256) {
        return 1 + (seats * 51) / 100;
    }

    /**
     * @notice Returns the current number of board seats
     * @return The number of seats
     */
    function _getSeats() internal view returns (uint256) {
        return seats;
    }

    /**
     * @notice Sets or proposes a new number of board seats
     * @dev Initial call sets seats directly; subsequent calls create/update proposals
     * @param tokenId The token ID proposing the change (0 for initial setup)
     * @param numOfSeats The proposed number of seats
     */
    function _setSeats(uint256 tokenId, uint256 numOfSeats) internal {
        if (numOfSeats <= 0) revert IBoard.InvalidNumSeats();

        // Initial setup case
        if (seats == 0) {
            seats = numOfSeats;
            emit IBoard.ExecuteSetSeats(tokenId, numOfSeats);
            return;
        }

        SeatUpdate storage proposal = seatUpdate;

        // New proposal
        if (proposal.timestamp == 0) {
            proposal.proposedSeats = numOfSeats;
            proposal.timestamp = block.timestamp;
            proposal.requiredQuorum = _getQuorum(); // Store quorum at proposal time
        } else {
            // Delete the proposal if numOfSeats doesn't match
            if (proposal.proposedSeats != numOfSeats) {
                delete seatUpdate;
                emit IBoard.SeatUpdateCancelled(tokenId);
                return;
            }

            // Check if caller already voted on seat update
            for (uint256 i; i < proposal.supporters.length;) {
                if (proposal.supporters[i] == tokenId) {
                    revert IBoard.AlreadySentUpdateRequest();
                }
                unchecked {
                    ++i;
                }
            }
        }

        // Add support
        proposal.supporters.push(tokenId);
        emit IBoard.SetSeats(tokenId, numOfSeats);
    }

    /**
     * @notice Executes a pending seat update proposal
     * @dev Requires proposal to exist, timelock expired, and quorum maintained
     * @param tokenId The token ID executing the update
     */
    function _executeSeatsUpdate(uint256 tokenId) internal {
        SeatUpdate storage proposal = seatUpdate;

        // Require proposal exists and delay has passed
        if (proposal.timestamp == 0) revert IBoard.InvalidProposal();
        if (block.timestamp < proposal.timestamp + 7 days) revert IBoard.TimelockNotExpired();

        // Verify quorum is maintained using proposal-time quorum, not current quorum
        if (proposal.supporters.length < proposal.requiredQuorum) {
            revert IBoard.InsufficientVotes();
        }

        seats = proposal.proposedSeats;
        delete seatUpdate;
        emit IBoard.ExecuteSetSeats(tokenId, proposal.proposedSeats);
    }

    /// @dev Storage gap for future upgrades
    uint256[50] private __gap;
}
