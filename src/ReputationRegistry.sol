// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    AccessControlUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import {Initializable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

/**
 * @title ReputationRegistry
 * @notice ERC-8004 Reputation Registry for Agents
 * @dev Stores reputation signals and feedback for Agent Identities.
 */
contract ReputationRegistry is Initializable, AccessControlUpgradeable {
    bytes32 public constant REPUTATION_MANAGER_ROLE = keccak256("REPUTATION_MANAGER_ROLE");

    /**
     * @notice Structure for a Reputation Signal
     * @dev Packing: `provider` (address, 20 bytes) + `score` (uint8, 1 byte) = 21 bytes in slot 0.
     *      `comment` (string, dynamic) and `timestamp` (uint256) each occupy their own slots.
     */
    struct Signal {
        address provider;
        uint8 score;
        string comment;
        uint256 timestamp;
    }

    /**
     * @notice ERC-7201 namespaced storage layout for ReputationRegistry
     * @custom:storage-location erc7201:loreum.ReputationRegistry
     */
    struct ReputationRegistryStorage {
        mapping(uint256 => Signal[]) signals;
        mapping(uint256 => uint256) totalScore;
        mapping(uint256 => uint256) signalCount;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.ReputationRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _REPUTATIONREGISTRY_STORAGE_SLOT =
        0x3231d253bf82f17e7e1cb03127bee3f2f842f7b78a15e3ac5797c02a37223300;

    function _getReputationRegistryStorage() internal pure returns (ReputationRegistryStorage storage $) {
        assembly {
            $.slot := _REPUTATIONREGISTRY_STORAGE_SLOT
        }
    }

    /// @notice Event emitted when a new signal is posted
    event SignalPosted(uint256 indexed agentId, address indexed provider, uint8 score, string comment);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the registry
     * @param admin The address with admin rights
     */
    function initialize(address admin) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REPUTATION_MANAGER_ROLE, admin);
    }

    /**
     * @notice Posts a reputation signal for an agent
     * @param agentId The Identity Token ID of the agent
     * @param score The reputation score (0-100)
     * @param comment Optional comment or URI
     */
    function postSignal(uint256 agentId, uint8 score, string memory comment)
        external
        onlyRole(REPUTATION_MANAGER_ROLE)
    {
        require(score <= 100, "Score must be 0-100");

        ReputationRegistryStorage storage $ = _getReputationRegistryStorage();

        $.signals[agentId].push(
            Signal({provider: msg.sender, score: score, comment: comment, timestamp: block.timestamp})
        );

        $.totalScore[agentId] += score;
        $.signalCount[agentId] += 1;

        emit SignalPosted(agentId, msg.sender, score, comment);
    }

    /**
     * @notice Retrieves signals for an agent with pagination
     * @param agentId The Identity Token ID
     * @param offset The starting index
     * @param limit The maximum number of entries to return
     * @return An array of Signal structs
     */
    function getSignals(uint256 agentId, uint256 offset, uint256 limit) external view returns (Signal[] memory) {
        Signal[] storage all = _getReputationRegistryStorage().signals[agentId];
        uint256 total = all.length;
        if (offset >= total) {
            return new Signal[](0);
        }
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        Signal[] memory result = new Signal[](count);
        for (uint256 i = 0; i < count;) {
            result[i] = all[offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    /**
     * @notice Retrieves all signals for an agent (legacy, use paginated version for large arrays)
     * @param agentId The Identity Token ID
     * @return An array of Signal structs
     */
    function getSignals(uint256 agentId) external view returns (Signal[] memory) {
        return _getReputationRegistryStorage().signals[agentId];
    }

    /**
     * @notice Returns the total number of signals for an agent
     * @param agentId The Identity Token ID
     * @return The count of signals
     */
    function getSignalCount(uint256 agentId) external view returns (uint256) {
        return _getReputationRegistryStorage().signalCount[agentId];
    }

    /**
     * @notice Calculates the average reputation score for an agent
     * @dev Fix for Finding 10: Uses running totals for O(1) calculation
     * @param agentId The Identity Token ID
     * @return The average score (0 if no signals)
     */
    function getAverageScore(uint256 agentId) external view returns (uint256) {
        ReputationRegistryStorage storage $ = _getReputationRegistryStorage();
        uint256 count = $.signalCount[agentId];
        if (count == 0) return 0;
        return $.totalScore[agentId] / count;
    }
}
