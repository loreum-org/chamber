import { parseAbi } from "viem";

/**
 * Factory ABI synced from loreum-org/chamber main
 * (`contracts/src/interfaces/IFactory.sol` + Ownable).
 *
 * ChamberCreated(chamber, asset, nft, seats, name, symbol, creator)
 */
export const FactoryAbi = parseAbi([
  "constructor(address implementation_, address admin)",
  "function createChamber(address erc20Token, address erc721Token, uint256 seats, string name, string symbol) returns (address chamber)",
  "function setImplementation(address newImplementation)",
  "function implementation() view returns (address)",
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
  "function renounceOwnership()",
  "event ChamberCreated(address indexed chamber, address indexed asset, address indexed nft, uint256 seats, string name, string symbol, address creator)",
  "event ChamberImplementationUpdated(address indexed previousImplementation, address indexed newImplementation)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "error ZeroAddress()",
  "error InvalidSeats()",
  "error OwnableUnauthorizedAccount(address account)",
  "error OwnableInvalidOwner(address owner)",
]);
