// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Board {
    event SetSeats(uint256 numOfSeats);
    event SetSeatsCall(address caller);

    // Custom Errors
    error AlreadySentUpdateRequest();

    struct Node {
        uint256 tokenId;
        uint256 amount;
        uint256 next;
        uint256 prev;
    }

    uint256 private seats;

    // Mapping from tokenId to Node
    mapping(uint256 => Node) internal nodes;

    // used to update the number of seats
    address[] private updateSeatList;

    // Head and tail of the list (0 represents null)
    uint256 internal head;
    uint256 internal tail;
    uint256 internal size;

    function _getNode(uint256 tokenId) internal view returns (Node memory) {
        return nodes[tokenId];
    }

    function _insert(uint256 tokenId, uint256 amount) internal {
        Node storage newNode = nodes[tokenId];
        newNode.tokenId = tokenId;
        newNode.amount = amount;

        if (head == 0) {
            // First node
            head = tokenId;
            tail = tokenId;
        } else {
            // Find position and insert
            uint256 current = head;

            while (current != 0 && amount <= nodes[current].amount) {
                current = nodes[current].next;
            }

            if (current == 0) {
                // Insert at tail
                nodes[tail].next = tokenId;
                newNode.prev = tail;
                tail = tokenId;
            } else {
                // Insert before current node
                newNode.next = current;
                newNode.prev = nodes[current].prev;

                if (newNode.prev != 0) {
                    nodes[newNode.prev].next = tokenId;
                } else {
                    head = tokenId;
                }

                nodes[current].prev = tokenId;
            }
        }
        size++;
    }

    function _remove(uint256 tokenId) internal {
        Node storage node = nodes[tokenId];

        if (node.prev != 0) {
            nodes[node.prev].next = node.next;
        } else {
            head = node.next;
        }

        if (node.next != 0) {
            nodes[node.next].prev = node.prev;
        } else {
            tail = node.prev;
        }

        delete nodes[tokenId];
        size--;
    }

    function _reposition(uint256 tokenId) internal {
        uint256 amount = nodes[tokenId].amount;
        _remove(tokenId);
        _insert(tokenId, amount);
    }

    // View functions for the leaderboard
    function _getTop(uint256 count) internal view returns (uint256[] memory, uint256[] memory) {
        uint256 resultCount = count > size ? size : count;
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
        if (seats == 0) {
            seats = numOfSeats;
            emit SetSeats(numOfSeats);
            return;
        }

        uint256 _quorum = _getQuorum();

        if (updateSeatList.length == 0) {
            updateSeatList.push(msg.sender);
            emit SetSeatsCall(msg.sender);
            return;
        }

        for (uint256 i = 0; i < updateSeatList.length; i++) {
            if (updateSeatList[i] == msg.sender) {
                revert AlreadySentUpdateRequest();
            }
        }

        updateSeatList.push(msg.sender);
        emit SetSeatsCall(msg.sender);

        if (updateSeatList.length >= _quorum) {
            seats = numOfSeats;
            emit SetSeats(numOfSeats);
            delete updateSeatList;
        }
    }

    function _getSeatUpdateList() internal view returns (address[] memory) {
        return updateSeatList;
    }
}
