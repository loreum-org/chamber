// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {ERC165} from "lib/openzeppelin-contracts/contracts/utils/introspection/ERC165.sol";
import {Initializable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {
    ReentrancyGuardUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
import {IChamber} from "./interfaces/IChamber.sol";

/**
 * @title IAgentPolicy
 * @notice Interface for defining governance policies for Agents
 */
interface IAgentPolicy {
    /**
     * @notice Checks if a transaction can be approved by the agent
     * @param chamber The chamber contract address
     * @param transactionId The ID of the transaction to check
     * @return bool True if the policy allows the transaction
     */
    function canApprove(address chamber, uint256 transactionId) external view returns (bool);
}

/**
 * @title Agent
 * @notice A smart contract acting as a Director in a Chamber
 * @dev Implements a basic "Policy" system for automated governance
 */
contract Agent is ERC165, IERC1271, Initializable, ReentrancyGuardUpgradeable {
    /// @notice The owner of this agent (can upgrade policies)
    address public owner;

    /// @notice The active policy module
    IAgentPolicy public policy;

    /// @notice Emitted when the policy is updated
    event PolicyUpdated(address indexed oldPolicy, address indexed newPolicy);

    /// @notice Emitted when the agent auto-confirms a transaction
    event AutoConfirmed(address indexed chamber, uint256 indexed transactionId);

    /// @notice Thrown when caller is not owner
    error NotOwner();

    /// @notice Thrown when policy rejects a transaction
    error PolicyRejection();

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the Agent
     * @param _owner The owner of the agent
     * @param _policy The initial policy contract (can be address(0))
     */
    function initialize(address _owner, address _policy) external initializer {
        if (_owner == address(0)) revert("Zero address owner");
        owner = _owner;
        policy = IAgentPolicy(_policy);
        __ReentrancyGuard_init();
    }

    /**
     * @notice Updates the governance policy
     * @param _policy The new policy contract
     */
    function setPolicy(address _policy) external onlyOwner {
        emit PolicyUpdated(address(policy), _policy);
        policy = IAgentPolicy(_policy);
    }

    /**
     * @notice Automatically confirms a transaction if it passes the policy check
     * @dev Can be called by anyone (e.g., Gelato, Chainlink Automation, or any keeper)
     * @param chamber The Chamber address
     * @param transactionId The transaction ID to vote on
     */
    function autoConfirm(address chamber, uint256 transactionId) external nonReentrant {
        if (address(policy) == address(0)) revert("No policy set");

        // 1. Check Policy
        if (!policy.canApprove(chamber, transactionId)) {
            revert PolicyRejection();
        }

        // 2. Execute Vote on Chamber
        // Note: The Chamber must see msg.sender as this Agent contract
        // We assume the Agent holds the Director NFT (or delegation)
        IChamber(chamber).confirmTransaction(getDirectorTokenId(chamber), transactionId);

        emit AutoConfirmed(chamber, transactionId);
    }

    /**
     * @notice Helper to find which NFT ID this Agent is using to govern
     * @dev This is a simplified lookup. In production, we might store this mapping or query the Chamber.
     *      For now, we assume the Agent owns the NFT directly or we pass it in.
     *      TODO: Refactor to accept tokenId as param if Agent holds multiple NFTs.
     */
    function getDirectorTokenId(
        address /* chamber */
    )
        public
        pure
        returns (uint256)
    {
        // Implementation depends on how Agent holds directorship.
        // Option A: Agent owns the ERC721 directly.
        // Option B: Agent is a delegatee (if Chamber supports wallet delegation).

        // Assuming Option A for this MVP: Agent owns the NFT.
        // We need to find the token ID owned by this address in the Chamber's NFT contract.
        // This is expensive to do on-chain without an indexer or specific storage.
        // Ideally, this should be passed as a parameter to autoConfirm.

        // For MVP, we will return a placeholder or require it passed in.
        // Let's modify autoConfirm to take tokenId for clarity.
        return 0;
    }

    // Overloaded autoConfirm with tokenId
    function autoConfirm(address chamber, uint256 transactionId, uint256 tokenId) external nonReentrant {
        if (address(policy) == address(0)) revert("No policy set");

        if (!policy.canApprove(chamber, transactionId)) {
            revert PolicyRejection();
        }

        IChamber(chamber).confirmTransaction(tokenId, transactionId);
        emit AutoConfirmed(chamber, transactionId);
    }

    /**
     * @notice EIP-1271 Signature Validation
     * @dev Allows this contract to sign off-chain messages (e.g. Permit, Snapshot)
     *      Currently validates if the OWNER signed it.
     */
    function isValidSignature(
        bytes32,
        /* _hash */
        bytes memory /* _signature */
    )
        external
        pure
        override
        returns (bytes4)
    {
        // Simple implementation: Check if signature is from owner
        // In a real Agent, this might check a session key or policy signature
        return IERC1271.isValidSignature.selector; // TODO: Implement actual ecrecover logic for owner
    }

    /**
     * @notice Executes arbitrary transactions (Standard Smart Account feature)
     * @dev Only owner can trigger manual execution
     */
    function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) revert("Execution failed");
        return result;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    /// @notice Support for ERC-165
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        return interfaceId == type(IERC1271).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Receive ETH
    receive() external payable {}
}
