// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Initializable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {
    TransparentUpgradeableProxy
} from "lib/openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "lib/openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {IChamber} from "./interfaces/IChamber.sol";
import {Agent} from "./Agent.sol";

import {AgentIdentityRegistry} from "./AgentIdentityRegistry.sol";

/**
 * @title ChamberRegistry
 * @notice Central registry for deploying and managing Chamber instances and Agents
 * @dev Uses TransparentUpgradeableProxy for upgradeable Chamber deployments
 */
contract ChamberRegistry is AccessControl, Initializable {
    /// @notice Role for managing the registry configuration
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice The implementation contract for Chamber proxies
    address public implementation;

    /// @notice The implementation contract for Agent proxies
    address public agentImplementation;

    /// @notice The Agent Identity Registry contract
    address public agentIdentityRegistry;

    /// @notice Admin address for Chamber proxies (Registry admin)
    address public proxyAdmin;

    /// @notice Array to track all deployed chambers
    address[] private _chambers;

    /// @notice Array to track all deployed agents
    address[] private _agents;

    /// @notice Mapping to check if an address is a deployed chamber
    mapping(address => bool) private _isChamber;

    /// @notice Mapping to check if an address is a deployed agent
    mapping(address => bool) private _isAgent;

    /// @notice Mapping from asset address to array of chamber addresses
    mapping(address => address[]) private _chambersByAsset;

    /// @notice Array of all unique asset addresses (Organizations)
    address[] private _assets;

    /// @notice Mapping to check if an address is tracked as an asset
    mapping(address => bool) private _isAsset;

    /**
     * @notice Emitted when a new chamber is deployed
     * @param chamber The address of the newly deployed chamber
     * @param seats The initial number of board seats
     * @param name The name of the chamber's ERC20 token
     * @param symbol The symbol of the chamber's ERC20 token
     * @param erc20Token The ERC20 token used for governance
     * @param erc721Token The ERC721 token used for membership
     */
    event ChamberCreated(
        address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token
    );

    /**
     * @notice Emitted when a new agent is deployed
     * @param agent The address of the newly deployed agent
     * @param owner The owner of the agent
     * @param policy The initial policy of the agent
     */
    event AgentCreated(address indexed agent, address indexed owner, address indexed policy);

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when seats value is invalid (0 or > 20)
    error InvalidSeats();

    /// @notice Disables initializers in the implementation contract
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the Registry contract
     * @param _implementation The address of the Chamber implementation contract for proxies
     * @param _agentImplementation The address of the Agent implementation contract for proxies
     * @param _agentIdentityRegistry The address of the AgentIdentityRegistry contract
     * @param admin The address that will have admin role and proxy admin
     */
    function initialize(
        address _implementation,
        address _agentImplementation,
        address _agentIdentityRegistry,
        address admin
    ) external initializer {
        if (admin == address(0) || _implementation == address(0) || _agentImplementation == address(0)) {
            revert ZeroAddress();
        }
        implementation = _implementation;
        agentImplementation = _agentImplementation;
        agentIdentityRegistry = _agentIdentityRegistry;
        proxyAdmin = admin;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    /**
     * @notice Deploys a new Chamber instance using TransparentUpgradeableProxy
     * @dev The chamber will be its own admin, allowing it to upgrade via governance
     * @param erc20Token The ERC20 token to be used for assets
     * @param erc721Token The ERC721 token to be used for membership
     * @param seats The initial number of board seats
     * @param name The name of the chamber's ERC20 token
     * @param symbol The symbol of the chamber's ERC20 token
     * @return chamber The address of the newly deployed chamber proxy
     */
    function createChamber(
        address erc20Token,
        address erc721Token,
        uint256 seats,
        string memory name,
        string memory symbol
    ) external returns (address payable chamber) {
        if (erc20Token == address(0) || erc721Token == address(0)) revert ZeroAddress();
        if (seats == 0 || seats > 20) revert InvalidSeats();
        if (implementation == address(0)) revert ZeroAddress();

        // Encode the initialization data
        bytes memory initData =
            abi.encodeWithSelector(IChamber.initialize.selector, erc20Token, erc721Token, seats, name, symbol);

        // Deploy new TransparentUpgradeableProxy with chamber as its own admin
        // We calculate a salt to make the address deterministic, then deploy with that address as admin
        // Note: This requires the chamber address to be known, so we use CREATE2 or deploy twice
        // For simplicity, deploy with Registry as admin, then transfer via Chamber function
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementation,
            address(this), // Registry as temporary admin - will transfer to chamber
            initData
        );

        chamber = payable(address(proxy));

        // Transfer ProxyAdmin ownership to the chamber itself
        // This allows the chamber to upgrade itself via governance
        _transferChamberAdmin(chamber);

        _chambers.push(chamber);
        _isChamber[chamber] = true;

        // Index chamber by asset
        if (!_isAsset[erc20Token]) {
            _isAsset[erc20Token] = true;
            _assets.push(erc20Token);
        }
        _chambersByAsset[erc20Token].push(chamber);

        emit ChamberCreated(chamber, seats, name, symbol, erc20Token, erc721Token);
    }

    /**
     * @notice Deploys a new Agent instance using TransparentUpgradeableProxy
     * @param owner The owner of the agent (can upgrade policies)
     * @param policy The initial policy contract for the agent
     * @param metadataURI The metadata URI for the Agent's identity
     * @return agent The address of the newly deployed agent proxy
     */
    function createAgent(address owner, address policy, string memory metadataURI)
        external
        returns (address payable agent)
    {
        if (owner == address(0)) revert ZeroAddress();
        if (agentImplementation == address(0)) revert ZeroAddress();

        // Encode the initialization data
        bytes memory initData = abi.encodeWithSelector(Agent.initialize.selector, owner, policy, address(this));

        // Deploy new TransparentUpgradeableProxy
        // We set the proxy admin to be the Registry (this contract) initially
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(agentImplementation, address(this), initData);

        agent = payable(address(proxy));

        // Transfer ProxyAdmin ownership to the Agent Owner
        _transferAgentAdmin(agent, owner);

        _agents.push(agent);
        _isAgent[agent] = true;

        // Register Agent Identity (ERC-8004)
        if (agentIdentityRegistry != address(0)) {
            AgentIdentityRegistry(agentIdentityRegistry)
                .registerAgent(
                    owner, // Identity NFT goes to the owner (or should it go to the Agent?)
                    // ERC-8004 implies the Agent *is* the identity holder, or controls it.
                    // Actually, Identity Registry maps Agent Address -> TokenID.
                    // The OWNER of the NFT is usually the controller of the Agent.
                    agent,
                    metadataURI
                );
        }

        emit AgentCreated(agent, owner, policy);
    }

    /**
     * @notice Returns all deployed chambers
     * @return Array of chamber addresses
     */
    function getAllChambers() external view returns (address[] memory) {
        return _chambers;
    }

    /**
     * @notice Returns the total number of deployed chambers
     * @return The number of chambers
     */
    function getChamberCount() external view returns (uint256) {
        return _chambers.length;
    }

    /**
     * @notice Returns a subset of chambers for pagination
     * @param limit The maximum number of chambers to return
     * @param skip The number of chambers to skip
     * @return Array of chamber addresses
     */
    function getChambers(uint256 limit, uint256 skip) external view returns (address[] memory) {
        uint256 total = _chambers.length;
        if (skip >= total) {
            return new address[](0);
        }

        uint256 remaining = total - skip;
        uint256 count = remaining < limit ? remaining : limit;
        address[] memory result = new address[](count);

        for (uint256 i = 0; i < count;) {
            result[i] = _chambers[skip + i];
            unchecked {
                ++i;
            }
        }

        return result;
    }

    /**
     * @notice Checks if an address is a deployed chamber
     * @param chamber The address to check
     * @return bool True if the address is a deployed chamber
     */
    function isChamber(address chamber) external view returns (bool) {
        return _isChamber[chamber];
    }

    /**
     * @notice Checks if an address is a deployed agent
     * @param agent The address to check
     * @return bool True if the address is a deployed agent
     */
    function isAgent(address agent) external view returns (bool) {
        return _isAgent[agent];
    }

    /**
     * @notice Returns all deployed agents
     * @return Array of agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return _agents;
    }

    /**
     * @notice Returns all chambers for a given asset
     * @param asset The asset address
     * @return Array of chamber addresses
     */
    function getChambersByAsset(address asset) external view returns (address[] memory) {
        return _chambersByAsset[asset];
    }

    /**
     * @notice Returns all unique assets (Organizations)
     * @return Array of asset addresses
     */
    function getAssets() external view returns (address[] memory) {
        return _assets;
    }

    /**
     * @notice Transfers ProxyAdmin ownership to the chamber itself
     * @dev This allows the chamber to upgrade itself via governance
     * @param chamber The chamber proxy address
     */
    function _transferChamberAdmin(address chamber) internal {
        // Get the ProxyAdmin address from the chamber
        address proxyAdminAddress = IChamber(chamber).getProxyAdmin();
        if (proxyAdminAddress == address(0)) revert ZeroAddress();

        // Transfer ownership of ProxyAdmin to the chamber
        ProxyAdmin proxyAdminInstance = ProxyAdmin(proxyAdminAddress);
        proxyAdminInstance.transferOwnership(chamber);
    }

    /**
     * @notice Transfers ProxyAdmin ownership of an Agent to the Agent's owner
     * @param agent The agent proxy address
     * @param owner The new owner address
     */
    function _transferAgentAdmin(address agent, address owner) internal {
        // Get ProxyAdmin address from the Agent
        // Note: Agent must implement getProxyAdmin()
        try Agent(payable(agent)).getProxyAdmin() returns (address proxyAdminAddress) {
            if (proxyAdminAddress != address(0)) {
                ProxyAdmin(proxyAdminAddress).transferOwnership(owner);
            }
        } catch {
            revert("Failed to get ProxyAdmin");
        }
    }
}

