// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Board
/// @notice Manages a sorted linked list of nodes representing token delegations and board seats
/// @dev Abstract contract that implements core board functionality including delegation tracking
///      and seat management. Uses a doubly linked list to maintain sorted order of delegations.
abstract contract Board {
    /// @notice Emitted when the number of seats is set
    /// @param numOfSeats The new number of seats
    event SetSeats(uint256 numOfSeats);

    /// @notice Emitted when a call to set the number of seats is made
    /// @param caller The address of the caller
    event SetSeatsCall(address caller);

    /// @notice Emitted when a user delegates tokens to a tokenId
    /// @param sender The address of the user delegating tokens
    /// @param tokenId The tokenId to which tokens are delegated
    /// @param amount The amount of tokens delegated
    event Delegate(address indexed sender, uint256 tokenId, uint256 amount);

    /// @notice Emitted when a user undelegates tokens from a tokenId
    /// @param sender The address of the user undelegating tokens
    /// @param tokenId The tokenId from which tokens are undelegated
    /// @param amount The amount of tokens undelegated
    event Undelegate(address indexed sender, uint256 tokenId, uint256 amount);

    /// @notice Thrown when an update request has already been sent by the caller
    error AlreadySentUpdateRequest();

    /// @notice Thrown when the number of seats provided is invalid
    error InvalidNumSeats();

    /// @notice Thrown when the node does not exist
    error NodeDoesNotExist();

    /// @notice Thrown when the amount exceeds the delegation
    error AmountExceedsDelegation();

    /// @notice Node structure for the doubly linked list
    /// @dev Each node represents a token delegation with links to maintain sorted order
    /// @param tokenId Unique identifier for the token
    /// @param amount Total amount of tokens delegated to this node
    /// @param next TokenId of the next node in the sorted list (0 if none)
    /// @param prev TokenId of the previous node in the sorted list (0 if none)
    struct Node {
        uint256 tokenId;
        uint256 amount;
        uint256 next;
        uint256 prev;
    }

    /// @notice Number of board seats
    uint256 private seats;

    /// @notice Mapping from tokenId to Node data
    mapping(uint256 => Node) internal nodes;

    /// @notice List of addresses that have requested a seat update
    address[] private updateSeatList;

    /// @notice TokenId of the first node (highest amount)
    uint256 internal head;
    /// @notice TokenId of the last node (lowest amount)
    uint256 internal tail;
    /// @notice Total number of nodes in the list
    uint256 internal size;

    /// @notice Retrieves node information for a given tokenId
    /// @param tokenId The token ID to query
    /// @return Node struct containing the node's data
    function _getNode(uint256 tokenId) internal view returns (Node memory) {
        return nodes[tokenId];
    }

    /// @notice Handles token delegation to a specific tokenId
    /// @dev Updates or creates a node and maintains sorted order
    /// @param tokenId The token ID to delegate to
    /// @param amount The amount of tokens to delegate
    function _delegate(uint256 tokenId, uint256 amount) internal {
        Node storage node = nodes[tokenId];
        if (node.tokenId == tokenId) {
            // Update existing node
            node.amount += amount;
            _reposition(tokenId);
        } else {
            // Create new node
            _insert(tokenId, amount);
        }
        emit Delegate(msg.sender, tokenId, amount);
    }

    /// @notice Handles token undelegation from a specific tokenId
    /// @dev Reduces delegation amount or removes node if amount becomes zero
    /// @param tokenId The token ID to undelegate from
    /// @param amount The amount of tokens to undelegate
    function _undelegate(uint256 tokenId, uint256 amount) internal {
        Node storage node = nodes[tokenId];
        if (node.tokenId != tokenId) revert NodeDoesNotExist();
        if (amount > node.amount) revert AmountExceedsDelegation();

        node.amount -= amount;

        if (node.amount == 0) {
            _remove(tokenId);
        } else {
            _reposition(tokenId);
        }
        emit Undelegate(msg.sender, tokenId, amount);
    }

    function _insert(uint256 tokenId, uint256 amount) internal {
        if (head == 0) {
            _initializeFirstNode(tokenId, amount);
        } else {
            _insertNodeInOrder(tokenId, amount);
        }
        _incrementSize();
    }

    function _initializeFirstNode(uint256 tokenId, uint256 amount) private {
        nodes[tokenId] = Node({tokenId: tokenId, amount: amount, next: 0, prev: 0});
        head = tokenId;
        tail = tokenId;
    }

    function _insertNodeInOrder(uint256 tokenId, uint256 amount) private {
        uint256 current = head;
        uint256 previous = 0;

        while (current != 0 && amount <= nodes[current].amount) {
            previous = current;
            current = nodes[current].next;
        }

        nodes[tokenId] = Node({tokenId: tokenId, amount: amount, next: current, prev: previous});

        if (current == 0) {
            nodes[tail].next = tokenId;
            tail = tokenId;
        } else {
            nodes[current].prev = tokenId;
            if (previous != 0) {
                nodes[previous].next = tokenId;
            } else {
                head = tokenId;
            }
        }
    }

    function _incrementSize() private {
        unchecked {
            size++;
        }
    }

    function _remove(uint256 tokenId) internal {
        Node storage node = nodes[tokenId];
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
        unchecked {
            size--;
        }
    }

    function _reposition(uint256 tokenId) internal {
        uint256 amount = nodes[tokenId].amount;
        _remove(tokenId);
        _insert(tokenId, amount);
    }

    // View functions for the leaderboard
    function _getTop(uint256 count) internal view returns (uint256[] memory, uint256[] memory) {
        
        uint256 _size = size;
        
        uint256 resultCount = count > _size ? _size : count;
        uint256[] memory tokenIds = new uint256[](resultCount);
        uint256[] memory amounts = new uint256[](resultCount);

        uint256 current = head;
        for (uint256 i = 0; i < resultCount; i++) {
            tokenIds[i] = current;
            amounts[i] = nodes[current].amount;
            current = nodes[current].next;
        }

        return (tokenIds, amounts);
    }

    function _getQuorum() internal view returns (uint256) {
        return 1 + (seats * 51) / 100;
    }

    function _getSeats() internal view returns (uint256) {
        return seats;
    }

    function _setSeats(uint256 numOfSeats) internal {
        if (numOfSeats <= 0) revert InvalidNumSeats();

        if (seats == 0) {
            seats = numOfSeats;
            emit SetSeats(numOfSeats);
            return;
        }

        uint256 _quorum = _getQuorum();

        if (updateSeatList.length == 0 || !_hasRequestedUpdate(msg.sender)) {
            updateSeatList.push(msg.sender);
            emit SetSeatsCall(msg.sender);
        } else {
            revert AlreadySentUpdateRequest();
        }

        if (updateSeatList.length >= _quorum) {
            seats = numOfSeats;
            emit SetSeats(numOfSeats);
            delete updateSeatList;
        }
    }

    function _hasRequestedUpdate(address sender) internal view returns (bool) {
        for (uint256 i = 0; i < updateSeatList.length; i++) {
            if (updateSeatList[i] == sender) {
                return true;
            }
        }
        return false;
    }

    function _getSeatUpdateList() internal view returns (address[] memory) {
        return updateSeatList;
    }
}
