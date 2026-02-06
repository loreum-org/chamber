// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC1271} from "lib/openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
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

import {AgentIdentityRegistry} from "./AgentIdentityRegistry.sol";
import {IChamberRegistry} from "./interfaces/IChamberRegistry.sol";

import {StorageSlot} from "lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol";

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

    /// @notice The Registry address
    address public registry;

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
     * @param _registry The address of the Registry contract
     */
    function initialize(address _owner, address _policy, address _registry) external initializer {
        if (_owner == address(0)) revert("Zero address owner");
        owner = _owner;
        policy = IAgentPolicy(_policy);
        registry = _registry;
        __ReentrancyGuard_init();
    }

    /**
     * @notice Returns the Agent Identity Token ID from the Registry
     * @return uint256 The Identity Token ID (0 if not registered)
     */
    function getIdentityId() external view returns (uint256) {
        if (registry == address(0)) return 0;
        address identityRegistry = IChamberRegistry(registry).agentIdentityRegistry();
        if (identityRegistry == address(0)) return 0;
        return AgentIdentityRegistry(identityRegistry).agentToIdentityId(address(this));
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
     *      Also supports Chamber's custom authorization pattern (signature = encoded sender address)
     * @param hash The hash of the data to be signed
     * @param signature The signature byte array
     * @return magicValue IERC1271.isValidSignature.selector if valid, else 0xffffffff
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
        // 1. Chamber Mode: Authorization Check (signature is 32 bytes encoded address)
        // This allows the Owner to act on behalf of the Agent in the Chamber
        if (signature.length == 32) {
            address authorizedSender = abi.decode(signature, (address));
            if (authorizedSender == owner) {
                return IERC1271.isValidSignature.selector;
            }
        }

        // 2. Standard Mode: Cryptographic Signature Check
        // Validates if the signature was signed by the Owner
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && signer == owner) {
            return IERC1271.isValidSignature.selector;
        }

        return 0xffffffff;
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

    /**
     * @notice Returns the ProxyAdmin address for this Agent proxy
     * @return The ProxyAdmin address stored in ERC1967 admin slot
     */
    function getProxyAdmin() external view returns (address) {
        // ERC1967 admin slot: keccak256("eip1967.proxy.admin") - 1
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        return StorageSlot.getAddressSlot(adminSlot).value;
    }
}
