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

    /**
     * @notice ERC-7201 namespaced storage layout for ChamberRegistry
     * @dev Address fields (20 bytes each) cannot be packed together in the same 32-byte slot.
     *      Mappings and dynamic arrays each occupy a full slot regardless of value type.
     * @custom:storage-location erc7201:loreum.ChamberRegistry
     */
    struct ChamberRegistryStorage {
        address implementation;
        address agentImplementation;
        address agentIdentityRegistry;
        address proxyAdmin;
        address[] chambers;
        address[] agents;
        address[] assets;
        mapping(address => bool) isChamber;
        mapping(address => bool) isAgent;
        mapping(address => bool) isAsset;
        mapping(address => address[]) chambersByAsset;
        mapping(address => address) parentChamber;
        mapping(address => address[]) childChambers;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("erc7201:loreum.ChamberRegistry")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _CHAMBERREGISTRY_STORAGE_SLOT =
        0xf6315592a63ddf317bd8b41aa1ba894c04251b3cfbd8a95258342cd83f2a4600;

    function _getChamberRegistryStorage() internal pure returns (ChamberRegistryStorage storage $) {
        assembly {
            $.slot := _CHAMBERREGISTRY_STORAGE_SLOT
        }
    }

    /// EXPLICIT GETTERS for formerly-public state variables ///

    /// @notice The implementation contract for Chamber proxies
    function implementation() external view returns (address) {
        return _getChamberRegistryStorage().implementation;
    }

    /// @notice The implementation contract for Agent proxies
    function agentImplementation() external view returns (address) {
        return _getChamberRegistryStorage().agentImplementation;
    }

    /// @notice The Agent Identity Registry contract
    function agentIdentityRegistry() external view returns (address) {
        return _getChamberRegistryStorage().agentIdentityRegistry;
    }

    /// @notice Admin address for Chamber proxies (Registry admin)
    function proxyAdmin() external view returns (address) {
        return _getChamberRegistryStorage().proxyAdmin;
    }

    /**
     * @notice Emitted when a new chamber is deployed
     */
    event ChamberCreated(
        address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token
    );

    /**
     * @notice Emitted when a new agent is deployed
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
        ChamberRegistryStorage storage $ = _getChamberRegistryStorage();
        $.implementation = _implementation;
        $.agentImplementation = _agentImplementation;
        $.agentIdentityRegistry = _agentIdentityRegistry;
        $.proxyAdmin = admin;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    /**
     * @notice Deploys a new Chamber instance using TransparentUpgradeableProxy
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
        ChamberRegistryStorage storage $ = _getChamberRegistryStorage();

        if (erc20Token == address(0) || erc721Token == address(0)) revert ZeroAddress();
        if (seats == 0 || seats > 20) revert InvalidSeats();
        if ($.implementation == address(0)) revert ZeroAddress();

        bytes memory initData =
            abi.encodeWithSelector(IChamber.initialize.selector, erc20Token, erc721Token, seats, name, symbol);

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy($.implementation, address(this), initData);

        chamber = payable(address(proxy));

        _transferChamberAdmin(chamber);

        $.chambers.push(chamber);
        $.isChamber[chamber] = true;

        if (!$.isAsset[erc20Token]) {
            $.isAsset[erc20Token] = true;
            $.assets.push(erc20Token);
        }
        $.chambersByAsset[erc20Token].push(chamber);

        if ($.isChamber[erc20Token]) {
            $.parentChamber[chamber] = erc20Token;
            $.childChambers[erc20Token].push(chamber);
        }

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
        ChamberRegistryStorage storage $ = _getChamberRegistryStorage();

        if (owner == address(0)) revert ZeroAddress();
        if ($.agentImplementation == address(0)) revert ZeroAddress();

        bytes memory initData = abi.encodeWithSelector(Agent.initialize.selector, owner, policy, address(this));

        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy($.agentImplementation, address(this), initData);

        agent = payable(address(proxy));

        _transferAgentAdmin(agent, owner);

        $.agents.push(agent);
        $.isAgent[agent] = true;

        if ($.agentIdentityRegistry != address(0)) {
            AgentIdentityRegistry($.agentIdentityRegistry).registerAgent(owner, agent, metadataURI);
        }

        emit AgentCreated(agent, owner, policy);
    }

    /**
     * @notice Returns all deployed chambers
     * @return Array of chamber addresses
     */
    function getAllChambers() external view returns (address[] memory) {
        return _getChamberRegistryStorage().chambers;
    }

    /**
     * @notice Returns the total number of deployed chambers
     * @return The number of chambers
     */
    function getChamberCount() external view returns (uint256) {
        return _getChamberRegistryStorage().chambers.length;
    }

    /**
     * @notice Returns a subset of chambers for pagination
     * @param limit The maximum number of chambers to return
     * @param skip The number of chambers to skip
     * @return Array of chamber addresses
     */
    function getChambers(uint256 limit, uint256 skip) external view returns (address[] memory) {
        address[] storage allChambers = _getChamberRegistryStorage().chambers;
        uint256 total = allChambers.length;
        if (skip >= total) {
            return new address[](0);
        }

        uint256 remaining = total - skip;
        uint256 count = remaining < limit ? remaining : limit;
        address[] memory result = new address[](count);

        for (uint256 i = 0; i < count;) {
            result[i] = allChambers[skip + i];
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
        return _getChamberRegistryStorage().isChamber[chamber];
    }

    /**
     * @notice Checks if an address is a deployed agent
     * @param agent The address to check
     * @return bool True if the address is a deployed agent
     */
    function isAgent(address agent) external view returns (bool) {
        return _getChamberRegistryStorage().isAgent[agent];
    }

    /**
     * @notice Returns all deployed agents
     * @return Array of agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return _getChamberRegistryStorage().agents;
    }

    /**
     * @notice Returns all chambers for a given asset
     * @param asset The asset address
     * @return Array of chamber addresses
     */
    function getChambersByAsset(address asset) external view returns (address[] memory) {
        return _getChamberRegistryStorage().chambersByAsset[asset];
    }

    /**
     * @notice Returns all unique assets (Organizations)
     * @return Array of asset addresses
     */
    function getAssets() external view returns (address[] memory) {
        return _getChamberRegistryStorage().assets;
    }

    /**
     * @notice Returns the parent chamber address for a given chamber
     * @param chamber The chamber address
     * @return The parent chamber address, or address(0) if it's a root chamber
     */
    function getParentChamber(address chamber) external view returns (address) {
        return _getChamberRegistryStorage().parentChamber[chamber];
    }

    /**
     * @notice Returns all child chambers for a given parent chamber
     * @param chamber The parent chamber address
     * @return Array of child chamber addresses
     */
    function getChildChambers(address chamber) external view returns (address[] memory) {
        return _getChamberRegistryStorage().childChambers[chamber];
    }

    /**
     * @notice Transfers ProxyAdmin ownership to the chamber itself
     * @param chamber The chamber proxy address
     */
    function _transferChamberAdmin(address chamber) internal {
        address proxyAdminAddress = IChamber(chamber).getProxyAdmin();
        if (proxyAdminAddress == address(0)) revert ZeroAddress();

        ProxyAdmin proxyAdminInstance = ProxyAdmin(proxyAdminAddress);
        proxyAdminInstance.transferOwnership(chamber);
    }

    /**
     * @notice Transfers ProxyAdmin ownership of an Agent to the Agent's owner
     * @param agent The agent proxy address
     * @param owner The new owner address
     */
    function _transferAgentAdmin(address agent, address owner) internal {
        try Agent(payable(agent)).getProxyAdmin() returns (address proxyAdminAddress) {
            if (proxyAdminAddress != address(0)) {
                ProxyAdmin(proxyAdminAddress).transferOwnership(owner);
            }
        } catch {
            revert("Failed to get ProxyAdmin");
        }
    }
}
