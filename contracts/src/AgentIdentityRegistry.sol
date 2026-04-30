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

    /**
     * @notice ERC-7201 namespaced storage layout for AgentIdentityRegistry
     * @dev `nextTokenId` is a uint256 (full slot). The two mappings each occupy a full slot.
     * @custom:storage-location erc7201:loreum.AgentIdentityRegistry
     */
    struct AgentIdentityRegistryStorage {
        uint256 nextTokenId;
        mapping(address => uint256) agentToIdentityId;
        mapping(uint256 => address) identityIdToAgent;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.AgentIdentityRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _AGENTIDENTITYREGISTRY_STORAGE_SLOT =
        0xcbbd7f406a7bce0cf07c65d3156625a5eb2bd8c4ff303cb9732533700afafd00;

    function _getAgentIdentityRegistryStorage()
        internal
        pure
        returns (AgentIdentityRegistryStorage storage $)
    {
        assembly {
            $.slot := _AGENTIDENTITYREGISTRY_STORAGE_SLOT
        }
    }

    /// EXPLICIT GETTERS for formerly-public state variables ///

    /// @notice Returns the identity token ID for a given agent address
    function agentToIdentityId(address agent) external view returns (uint256) {
        return _getAgentIdentityRegistryStorage().agentToIdentityId[agent];
    }

    /// @notice Returns the agent address for a given identity token ID
    function identityIdToAgent(uint256 tokenId) external view returns (address) {
        return _getAgentIdentityRegistryStorage().identityIdToAgent[tokenId];
    }

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
     * @param to The address that will own the NFT
     * @param agentAddress The address of the Agent contract being identified
     * @param uri The metadata URI (Registration File)
     * @return tokenId The ID of the newly minted token
     */
    function registerAgent(address to, address agentAddress, string memory uri)
        external
        onlyRole(REGISTRAR_ROLE)
        returns (uint256)
    {
        AgentIdentityRegistryStorage storage $ = _getAgentIdentityRegistryStorage();
        require($.agentToIdentityId[agentAddress] == 0, "Agent already registered");
        require(agentAddress != address(0), "Invalid agent address");

        uint256 tokenId = ++$.nextTokenId;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        $.agentToIdentityId[agentAddress] = tokenId;
        $.identityIdToAgent[tokenId] = agentAddress;

        emit AgentRegistered(tokenId, agentAddress, uri);

        return tokenId;
    }

    /**
     * @notice Updates the metadata URI for an Agent
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
