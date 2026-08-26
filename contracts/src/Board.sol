// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {
    ReentrancyGuardTransientUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardTransientUpgradeable.sol";
import {BoardTypes} from "src/types/BoardTypes.sol";
import {BoardLib} from "src/libraries/BoardLib.sol";

/**
 * @title Board
 * @author xhad, Loreum DAO LLC
 * @notice Manages a sorted linked list of nodes representing token delegations and board seats
 * @dev Core logic lives in {BoardLib} (linked library) to keep `Chamber` under EIP-170.
 */
abstract contract Board is ReentrancyGuardTransientUpgradeable {
    struct Node {
        uint256 tokenId;
        uint256 amount;
        uint128 next;
        uint128 prev;
    }

    struct SeatUpdate {
        uint256 proposedSeats;
        uint256 timestamp;
        uint256 requiredQuorum;
        uint256[] supporters;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.Board")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _BOARD_STORAGE_SLOT = 0xae916af301d5dc481b59b170e7db23e36b830da7017e456f99549768499c8800;

    function _getBoardStorage() internal pure returns (BoardTypes.BoardStorage storage $) {
        assembly {
            $.slot := _BOARD_STORAGE_SLOT
        }
    }

    function _getNode(uint256 tokenId) internal view returns (Node memory) {
        BoardTypes.Node memory node = BoardLib.getNode(_getBoardStorage(), tokenId);
        return Node({tokenId: node.tokenId, amount: node.amount, next: node.next, prev: node.prev});
    }

    function _delegate(uint256 tokenId, uint256 amount) internal {
        BoardLib.delegate(_getBoardStorage(), tokenId, amount, msg.sender);
    }

    function _undelegate(uint256 tokenId, uint256 amount) internal {
        BoardLib.undelegate(_getBoardStorage(), tokenId, amount, msg.sender);
    }

    function _reposition(uint256 tokenId) internal {
        BoardLib.reposition(_getBoardStorage(), tokenId);
    }

    function _insert(uint256 tokenId, uint256 amount) internal {
        BoardLib.insert(_getBoardStorage(), tokenId, amount);
    }

    function _remove(uint256 tokenId) internal returns (bool) {
        return BoardLib.remove(_getBoardStorage(), tokenId);
    }

    function _getTop(uint256 count) internal view returns (uint256[] memory, uint256[] memory) {
        return BoardLib.getTop(_getBoardStorage(), count);
    }

    function _getQuorum() internal view returns (uint256) {
        return BoardLib.getQuorum(_getBoardStorage());
    }

    function _getSeats() internal view returns (uint256) {
        return BoardLib.getSeats(_getBoardStorage());
    }

    function _setSeats(uint256 tokenId, uint256 numOfSeats) internal {
        BoardLib.setSeats(_getBoardStorage(), tokenId, numOfSeats);
    }

    function _executeSeatsUpdate(uint256 tokenId) internal {
        BoardLib.executeSeatsUpdate(_getBoardStorage(), tokenId);
    }

    function _cancelSeatUpdate(uint256 tokenId) internal {
        BoardLib.cancelSeatUpdate(_getBoardStorage(), tokenId);
    }

    function _topTokenIds() internal view returns (uint256[] memory) {
        return BoardLib.topTokenIds(_getBoardStorage());
    }

    function _getSeatedAt(uint256 tokenId) internal view returns (uint256) {
        return BoardLib.getSeatedAt(_getBoardStorage(), tokenId);
    }

    function _isSeatingMature(uint256 tokenId) internal view returns (bool) {
        return BoardLib.isSeatingMature(_getBoardStorage(), tokenId);
    }
}
