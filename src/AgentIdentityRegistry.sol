// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import {
    ERC721URIStorageUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {
    AccessControlUpgradeable
} from "lib/openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import {Initializable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

/**
 * @title AgentIdentityRegistry
 * @notice ERC-8004 Identity Registry for Agents
 * @dev Mints ERC-721 tokens representing Agent Identities.
 *      Stores the "Registration File" as the token URI.
 */
contract AgentIdentityRegistry is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice Counter for token IDs
    uint256 private _nextTokenId;

    /// @notice Mapping from Agent Contract Address to Identity Token ID
    mapping(address => uint256) public agentToIdentityId;

    /// @notice Mapping from Identity Token ID to Agent Contract Address
    mapping(uint256 => address) public identityIdToAgent;

    /// @notice Event emitted when a new Agent Identity is registered
    event AgentRegistered(uint256 indexed tokenId, address indexed agentAddress, string uri);

    /// @notice Event emitted when an Agent's metadata URI is updated
    event AgentUpdated(uint256 indexed tokenId, string newUri);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the registry
     * @param admin The address with admin rights
     */
    function initialize(address admin) external initializer {
        __ERC721_init("Agent Identity", "AGENT");
        __ERC721URIStorage_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /**
     * @notice Mints a new Agent Identity NFT
     * @dev Only callable by addresses with REGISTRAR_ROLE (e.g., the main Registry contract)
     * @param to The address that will own the NFT (usually the Agent's owner or the Agent itself)
     * @param agentAddress The address of the Agent contract being identified
     * @param uri The metadata URI (Registration File)
     * @return tokenId The ID of the newly minted token
     */
    function registerAgent(address to, address agentAddress, string memory uri)
        external
        onlyRole(REGISTRAR_ROLE)
        returns (uint256)
    {
        require(agentToIdentityId[agentAddress] == 0, "Agent already registered");
        require(agentAddress != address(0), "Invalid agent address");

        uint256 tokenId = ++_nextTokenId;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        agentToIdentityId[agentAddress] = tokenId;
        identityIdToAgent[tokenId] = agentAddress;

        emit AgentRegistered(tokenId, agentAddress, uri);

        return tokenId;
    }

    /**
     * @notice Updates the metadata URI for an Agent
     * @dev Only callable by the NFT owner
     * @param tokenId The token ID to update
     * @param newUri The new metadata URI
     */
    function updateAgentURI(uint256 tokenId, string memory newUri) external {
        require(ownerOf(tokenId) == msg.sender, "Caller is not owner");
        _setTokenURI(tokenId, newUri);
        emit AgentUpdated(tokenId, newUri);
    }

    // Overrides required by Solidity
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
