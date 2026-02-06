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

    /// @notice Structure for a Validation Attestation
    struct Validation {
        address validator;
        string validationType; // e.g., "TEE_VERIFICATION", "CODE_AUDIT", "KYC"
        bool isValid;
        string data; // Additional data, IPFS hash, or proof
        uint256 timestamp;
        uint256 expiry;
    }

    /// @notice Mapping from Agent Identity Token ID to list of Validations
    mapping(uint256 => Validation[]) private _validations;

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
        _validations[agentId].push(
            Validation({
                validator: msg.sender,
                validationType: validationType,
                isValid: isValid,
                data: data,
                timestamp: block.timestamp,
                expiry: block.timestamp + duration
            })
        );

        emit ValidationPosted(agentId, msg.sender, validationType, isValid);
    }

    /**
     * @notice Retrieves all validations for an agent
     * @param agentId The Identity Token ID
     * @return An array of Validation structs
     */
    function getValidations(uint256 agentId) external view returns (Validation[] memory) {
        return _validations[agentId];
    }

    /**
     * @notice Checks if an agent has a valid (non-expired) validation of a specific type
     * @param agentId The Identity Token ID
     * @param validationType The type of validation to check
     * @return bool True if a valid attestation exists
     */
    function hasValidAttestation(uint256 agentId, string memory validationType) external view returns (bool) {
        Validation[] memory validations = _validations[agentId];
        for (uint256 i = 0; i < validations.length; i++) {
            if (
                keccak256(bytes(validations[i].validationType)) == keccak256(bytes(validationType))
                    && validations[i].isValid && validations[i].expiry > block.timestamp
            ) {
                return true;
            }
        }
        return false;
    }
}
