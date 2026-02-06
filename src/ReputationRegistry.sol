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

    /// @notice Structure for a Reputation Signal
    struct Signal {
        address provider;
        uint8 score; // 0-100
        string comment; // Optional comment or IPFS hash
        uint256 timestamp;
    }

    /// @notice Mapping from Agent Identity Token ID to list of Signals
    mapping(uint256 => Signal[]) private _signals;

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
     * @dev Currently restricted to REPUTATION_MANAGER_ROLE for curated reputation.
     *      In the future, this could be open or stake-gated.
     * @param agentId The Identity Token ID of the agent
     * @param score The reputation score (0-100)
     * @param comment Optional comment or URI
     */
    function postSignal(uint256 agentId, uint8 score, string memory comment)
        external
        onlyRole(REPUTATION_MANAGER_ROLE)
    {
        require(score <= 100, "Score must be 0-100");

        _signals[agentId].push(
            Signal({provider: msg.sender, score: score, comment: comment, timestamp: block.timestamp})
        );

        emit SignalPosted(agentId, msg.sender, score, comment);
    }

    /**
     * @notice Retrieves all signals for an agent
     * @param agentId The Identity Token ID
     * @return An array of Signal structs
     */
    function getSignals(uint256 agentId) external view returns (Signal[] memory) {
        return _signals[agentId];
    }

    /**
     * @notice Calculates the average reputation score for an agent
     * @param agentId The Identity Token ID
     * @return The average score (0 if no signals)
     */
    function getAverageScore(uint256 agentId) external view returns (uint256) {
        Signal[] memory signals = _signals[agentId];
        if (signals.length == 0) return 0;

        uint256 totalScore = 0;
        for (uint256 i = 0; i < signals.length; i++) {
            totalScore += signals[i].score;
        }

        return totalScore / signals.length;
    }
}
