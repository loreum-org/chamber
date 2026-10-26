import { parseAbi } from "viem";

/**
 * Registry ABI synced from loreum-org/chamber main
 * (`contracts/src/Registry.sol`). ChamberCreated has no creator field;
 * the indexer records `tx.from` as creator on the Chamber row.
 *
 * ChamberCreated(chamber, seats, name, symbol, erc20Token, erc721Token)
 */
export const RegistryAbi = parseAbi([
  "function initialize(address _implementation, address admin)",
  "function createChamber(address erc20Token, address erc721Token, uint256 seats, string name, string symbol) returns (address chamber)",
  "function setChamberImplementation(address newImplementation)",
  "function getAllChambers() view returns (address[])",
  "function getChamberCount() view returns (uint256)",
  "function getChambers(uint256 limit, uint256 skip) view returns (address[])",
  "function isChamber(address chamber) view returns (bool)",
  "function getChambersByAsset(address asset) view returns (address[])",
  "function getChambersByAsset(address asset, uint256 limit, uint256 skip) view returns (address[])",
  "function getChambersByAssetCount(address asset) view returns (uint256 count)",
  "function getChildChambers(address chamber) view returns (address[])",
  "function getChildChambers(address chamber, uint256 limit, uint256 skip) view returns (address[])",
  "function getChildChamberCount(address chamber) view returns (uint256 count)",
  "function getParentChamber(address chamber) view returns (address)",
  "function getAssets() view returns (address[])",
  "function getAssets(uint256 limit, uint256 skip) view returns (address[])",
  "function getAssetCount() view returns (uint256 count)",
  "function MAX_PAGE_SIZE() view returns (uint256)",
  "function implementation() view returns (address)",
  "function proxyAdmin() view returns (address)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function renounceRole(bytes32 role, address callerConfirmation)",
  "event ChamberCreated(address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token)",
  "event ChamberImplementationUpdated(address indexed previousImplementation, address indexed newImplementation)",
  "event Initialized(uint64 version)",
  "event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)",
  "event RoleGranted(bytes32 indexed role, bytes32 indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, bytes32 indexed account, address indexed sender)",
  "error ZeroAddress()",
  "error InvalidSeats()",
  "error InvalidInitialization()",
  "error NotInitializing()",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error AccessControlBadConfirmation()",
]);
