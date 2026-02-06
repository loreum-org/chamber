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

    /// @notice Mapping of authorized keepers who can trigger autoConfirm
    mapping(address => bool) public authorizedKeepers;

    /// @notice Emitted when a keeper is added or removed
    event KeeperUpdated(address indexed keeper, bool authorized);

    /// @notice Thrown when caller is not owner
    error NotOwner();

    /// @notice Thrown when caller is not authorized (not owner or keeper)
    error NotAuthorized();

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
     * @notice Adds or removes an authorized keeper
     * @dev Only owner can manage keepers
     * @param keeper The keeper address
     * @param authorized Whether to authorize or revoke
     */
    function setKeeper(address keeper, bool authorized) external onlyOwner {
        authorizedKeepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    /**
     * @notice Automatically confirms a transaction if it passes the policy check
     * @dev Fix for Findings 5 & 8: Removed broken two-parameter overload (getDirectorTokenId
     *      always returned 0). Added access control so only owner or authorized keepers can call.
     * @param chamber The Chamber address
     * @param transactionId The transaction ID to vote on
     * @param tokenId The NFT token ID this Agent uses for directorship
     */
    function autoConfirm(address chamber, uint256 transactionId, uint256 tokenId) external nonReentrant onlyAuthorized {
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

    /// @notice Modifier restricting access to owner or authorized keepers
    modifier onlyAuthorized() {
        _onlyAuthorized();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _onlyAuthorized() internal view {
        if (msg.sender != owner && !authorizedKeepers[msg.sender]) revert NotAuthorized();
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
