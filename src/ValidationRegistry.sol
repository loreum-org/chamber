// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    AccessControlUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import {Initializable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

/**
 * @title ValidationRegistry
 * @notice ERC-8004 Validation Registry for Agents
 * @dev Stores validation attestations for Agent Identities.
 */
contract ValidationRegistry is Initializable, AccessControlUpgradeable {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    /**
     * @notice Structure for a Validation Attestation
     * @dev Packing: `validator` (address, 20 bytes) + `isValid` (bool, 1 byte) = 21 bytes in slot 0,
     *      saving one storage slot versus placing `isValid` after the dynamic string fields.
     *      `validationType` and `data` (dynamic strings) each occupy their own slots.
     *      `timestamp` and `expiry` (uint256) each occupy their own slots.
     */
    struct Validation {
        address validator;
        bool isValid;
        string validationType;
        string data;
        uint256 timestamp;
        uint256 expiry;
    }

    /**
     * @notice ERC-7201 namespaced storage layout for ValidationRegistry
     * @custom:storage-location erc7201:loreum.ValidationRegistry
     */
    struct ValidationRegistryStorage {
        mapping(uint256 => Validation[]) validations;
        mapping(uint256 => mapping(bytes32 => uint256)) latestValidExpiry;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.ValidationRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _VALIDATIONREGISTRY_STORAGE_SLOT =
        0x1c072998540d8d53a3af13cf9ee8f92e95a7932529e99f51550d48280ce74e00;

    function _getValidationRegistryStorage() internal pure returns (ValidationRegistryStorage storage $) {
        assembly {
            $.slot := _VALIDATIONREGISTRY_STORAGE_SLOT
        }
    }

    /// @notice Event emitted when a new validation is posted
    event ValidationPosted(uint256 indexed agentId, address indexed validator, string validationType, bool isValid);

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
        _grantRole(VALIDATOR_ROLE, admin);
    }

    /**
     * @notice Posts a validation attestation for an agent
     * @param agentId The Identity Token ID of the agent
     * @param validationType The type of validation performed
     * @param isValid Whether the validation passed
     * @param data Supporting data or proofs
     * @param duration Duration in seconds until this validation expires
     */
    function postValidation(
        uint256 agentId,
        string memory validationType,
        bool isValid,
        string memory data,
        uint256 duration
    ) external onlyRole(VALIDATOR_ROLE) {
        uint256 expiry = block.timestamp + duration;

        ValidationRegistryStorage storage $ = _getValidationRegistryStorage();

        $.validations[agentId].push(
            Validation({
                validator: msg.sender,
                isValid: isValid,
                validationType: validationType,
                data: data,
                timestamp: block.timestamp,
                expiry: expiry
            })
        );

        if (isValid) {
            bytes32 typeHash = keccak256(bytes(validationType));
            if (expiry > $.latestValidExpiry[agentId][typeHash]) {
                $.latestValidExpiry[agentId][typeHash] = expiry;
            }
        }

        emit ValidationPosted(agentId, msg.sender, validationType, isValid);
    }

    /**
     * @notice Retrieves validations for an agent with pagination
     * @param agentId The Identity Token ID
     * @param offset The starting index
     * @param limit The maximum number of entries to return
     * @return An array of Validation structs
     */
    function getValidations(uint256 agentId, uint256 offset, uint256 limit)
        external
        view
        returns (Validation[] memory)
    {
        Validation[] storage all = _getValidationRegistryStorage().validations[agentId];
        uint256 total = all.length;
        if (offset >= total) {
            return new Validation[](0);
        }
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        Validation[] memory result = new Validation[](count);
        for (uint256 i = 0; i < count;) {
            result[i] = all[offset + i];
            unchecked {
                ++i;
            }
        }
        return result;
    }

    /**
     * @notice Retrieves all validations for an agent (legacy, use paginated version for large arrays)
     * @param agentId The Identity Token ID
     * @return An array of Validation structs
     */
    function getValidations(uint256 agentId) external view returns (Validation[] memory) {
        return _getValidationRegistryStorage().validations[agentId];
    }

    /**
     * @notice Returns the total number of validations for an agent
     * @param agentId The Identity Token ID
     * @return The count of validations
     */
    function getValidationCount(uint256 agentId) external view returns (uint256) {
        return _getValidationRegistryStorage().validations[agentId].length;
    }

    /**
     * @notice Checks if an agent has a valid (non-expired) validation of a specific type
     * @dev Fix for Finding 10: Uses O(1) lookup via latestValidExpiry mapping
     * @param agentId The Identity Token ID
     * @param validationType The type of validation to check
     * @return bool True if a valid attestation exists
     */
    function hasValidAttestation(uint256 agentId, string memory validationType) external view returns (bool) {
        bytes32 typeHash = keccak256(bytes(validationType));
        return _getValidationRegistryStorage().latestValidExpiry[agentId][typeHash] > block.timestamp;
    }
}
