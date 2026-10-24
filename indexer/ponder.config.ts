import { parseAbiItem } from "abitype";
import { createConfig, factory } from "ponder";
import type { Address } from "viem";
import { http, isAddress } from "viem";

import { ChamberAbi } from "./abis/ChamberAbi";
import { Erc721Abi } from "./abis/Erc721Abi";
import { FactoryAbi } from "./abis/FactoryAbi";
import { RegistryAbi } from "./abis/RegistryAbi";
import { readBaseSepoliaDeployment } from "./baseSepoliaDeployment.mjs";

/**
 * Base Sepolia (chain 84532). Factory address and start block come from
 * `contracts/deployments/base-sepolia.txt`. `PONDER_FACTORY_*` overrides that
 * file. This package does not keep a second copy of those values.
 * Ethereum Sepolia stays in `contracts/deployments/sepolia.txt` and is not indexed.
 *
 * This deploy has no Registry. Registry / Chamber / RegistryNft stay in the
 * config because their handlers are registered. They watch a non-registry
 * address from the Factory block so the backfill stays empty. Set
 * PONDER_REGISTRY_* only after a Registry exists on this chain.
 *
 * RPC: set PONDER_RPC_URL_84532 to a dedicated Alchemy Base Sepolia HTTPS URL
 * (network `base-sepolia`). Do not use an origin-locked frontend key.
 */
const deployment = readBaseSepoliaDeployment();

/** Not a Chamber registry. Handlers require a Registry source; this one emits nothing. */
const DEFAULT_REGISTRY_ADDRESS =
  "0x000000000000000000000000000000000000dEaD" as const;

const registryAddress = addressFromEnv(
  process.env.PONDER_REGISTRY_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS,
  "PONDER_REGISTRY_ADDRESS",
);
const registryStartBlock = blockFromEnv(
  process.env.PONDER_REGISTRY_START_BLOCK,
  deployment.factoryStartBlock,
  "PONDER_REGISTRY_START_BLOCK",
);

const factoryAddress = addressFromEnv(
  process.env.PONDER_FACTORY_ADDRESS,
  deployment.factory,
  "PONDER_FACTORY_ADDRESS",
);
const factoryStartBlock = blockFromEnv(
  process.env.PONDER_FACTORY_START_BLOCK,
  deployment.factoryStartBlock,
  "PONDER_FACTORY_START_BLOCK",
);

const registryChamberCreatedEvent = parseAbiItem(
  "event ChamberCreated(address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token)",
);

const factoryChamberCreatedEvent = parseAbiItem(
  "event ChamberCreated(address indexed chamber, address indexed asset, address indexed nft, uint256 seats, string name, string symbol, address creator)",
);

function addressFromEnv(
  value: string | undefined,
  fallback: Address,
  envName: string,
): Address {
  if (value === undefined || value.trim() === "") return fallback;
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw new Error(
      `Invalid ${envName} '${trimmed}'. Expected a 20-byte hex address.`,
    );
  }
  return trimmed;
}

function blockFromEnv(
  value: string | undefined,
  fallback: number,
  envName: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid ${envName} '${value}'. Expected a non-negative integer.`,
    );
  }
  return parsed;
}

export default createConfig({
  networks: {
    baseSepolia: {
      chainId: 84532,
      transport: http(process.env.PONDER_RPC_URL_84532),
    },
  },
  contracts: {
    Registry: {
      abi: RegistryAbi,
      network: {
        baseSepolia: {
          address: registryAddress,
        },
      },
      startBlock: registryStartBlock,
    },
    Factory: {
      abi: FactoryAbi,
      network: {
        baseSepolia: {
          address: factoryAddress,
          startBlock: factoryStartBlock,
        },
      },
      startBlock: factoryStartBlock,
    },
    Chamber: {
      abi: ChamberAbi,
      network: {
        baseSepolia: {
          address: factory({
            address: registryAddress,
            event: registryChamberCreatedEvent,
            parameter: "chamber",
          }),
        },
      },
      startBlock: registryStartBlock,
    },
    // Same Chamber ABI, discovered from Factory ChamberCreated (different event).
    // Ponder 0.8 accepts one factory() per contract, so this is a second source.
    FactoryChamber: {
      abi: ChamberAbi,
      network: {
        baseSepolia: {
          address: factory({
            address: factoryAddress,
            event: factoryChamberCreatedEvent,
            parameter: "chamber",
          }),
          startBlock: factoryStartBlock,
        },
      },
      startBlock: factoryStartBlock,
    },
    // Membership NFTs: seat owners change on ERC-721 Transfer with no Chamber event.
    RegistryNft: {
      abi: Erc721Abi,
      network: {
        baseSepolia: {
          address: factory({
            address: registryAddress,
            event: registryChamberCreatedEvent,
            parameter: "erc721Token",
          }),
        },
      },
      startBlock: registryStartBlock,
    },
    FactoryNft: {
      abi: Erc721Abi,
      network: {
        baseSepolia: {
          address: factory({
            address: factoryAddress,
            event: factoryChamberCreatedEvent,
            parameter: "nft",
          }),
          startBlock: factoryStartBlock,
        },
      },
      startBlock: factoryStartBlock,
    },
  },
});
