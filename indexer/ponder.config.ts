import { parseAbiItem } from "abitype";
import { createConfig, factory } from "ponder";
import type { Address } from "viem";
import { http, isAddress } from "viem";

import { ChamberAbi } from "./abis/ChamberAbi";
import { Erc721Abi } from "./abis/Erc721Abi";
import { FactoryAbi } from "./abis/FactoryAbi";
import { RegistryAbi } from "./abis/RegistryAbi";
import {
  assertIndexedChains,
  loadIndexedChains,
  registrySource,
  rpcUrlFor,
} from "./baseSepoliaDeployment.mjs";

/**
 * One Ponder process for every testnet that has a Factory in
 * `contracts/deployments/<network>.txt` (staged copy: `indexer/.deployment/`).
 *
 * Chain table: 84532 base-sepolia, 421614 arbitrum-sepolia, 11155420 op-sepolia,
 * 11155111 sepolia. Sepolia is included only after a 1.3.0 Factory is recorded;
 * the Aug 26 pre-1.3.0 Factory is ignored. Files that say "Not deployed yet"
 * are skipped. Mainnet is not in the table.
 *
 * RPC: `PONDER_RPC_URL_<chainId>`. Overrides: `PONDER_FACTORY_ADDRESS_<chainId>`,
 * `PONDER_FACTORY_START_BLOCK_<chainId>`, `PONDER_REGISTRY_ADDRESS_<chainId>`,
 * `PONDER_REGISTRY_START_BLOCK_<chainId>`.
 *
 * A chain with a Factory and no Registry still watches the placeholder address
 * `0x000000000000000000000000000000000000dEaD` from the Factory block, so those
 * handlers stay registered and the backfill stays empty.
 */
const sources = assertIndexedChains(loadIndexedChains(process.env)).map(
  (chain) => ({
    ...chain,
    rpcUrl: rpcUrlFor(chain, process.env),
  }),
);

const registryChamberCreatedEvent = parseAbiItem(
  "event ChamberCreated(address indexed chamber, uint256 seats, string name, string symbol, address erc20Token, address erc721Token)",
);

const factoryChamberCreatedEvent = parseAbiItem(
  "event ChamberCreated(address indexed chamber, address indexed asset, address indexed nft, uint256 seats, string name, string symbol, address creator)",
);

function asAddress(value: string, label: string): Address {
  if (!isAddress(value)) {
    throw new Error(
      `Invalid ${label} '${value}'. Expected a 20-byte hex address.`,
    );
  }
  return value;
}

function perChain<T>(
  build: (chain: (typeof sources)[number]) => T,
): Record<string, T> {
  return Object.fromEntries(sources.map((chain) => [chain.name, build(chain)]));
}

function minStart(pick: (chain: (typeof sources)[number]) => number): number {
  return sources.reduce(
    (min, chain) => Math.min(min, pick(chain)),
    Number.POSITIVE_INFINITY,
  );
}

export default createConfig({
  networks: perChain((chain) => ({
    chainId: chain.chainId,
    transport: http(chain.rpcUrl),
  })),
  contracts: {
    Registry: {
      abi: RegistryAbi,
      network: perChain((chain) => {
        const registry = registrySource(chain);
        return {
          address: asAddress(registry.address, `Registry on ${chain.network}`),
          startBlock: registry.startBlock,
        };
      }),
      startBlock: minStart((chain) => registrySource(chain).startBlock),
    },
    Factory: {
      abi: FactoryAbi,
      network: perChain((chain) => ({
        address: asAddress(chain.factory, `Factory on ${chain.network}`),
        startBlock: chain.factoryStartBlock,
      })),
      startBlock: minStart((chain) => chain.factoryStartBlock),
    },
    Chamber: {
      abi: ChamberAbi,
      network: perChain((chain) => {
        const registry = registrySource(chain);
        return {
          address: factory({
            address: asAddress(registry.address, `Registry on ${chain.network}`),
            event: registryChamberCreatedEvent,
            parameter: "chamber",
          }),
          startBlock: registry.startBlock,
        };
      }),
      startBlock: minStart((chain) => registrySource(chain).startBlock),
    },
    // Same Chamber ABI, discovered from Factory ChamberCreated (different event).
    // Ponder 0.8 accepts one factory() per contract, so this is a second source.
    FactoryChamber: {
      abi: ChamberAbi,
      network: perChain((chain) => ({
        address: factory({
          address: asAddress(chain.factory, `Factory on ${chain.network}`),
          event: factoryChamberCreatedEvent,
          parameter: "chamber",
        }),
        startBlock: chain.factoryStartBlock,
      })),
      startBlock: minStart((chain) => chain.factoryStartBlock),
    },
    // Membership NFTs: seat owners change on ERC-721 Transfer with no Chamber event.
    RegistryNft: {
      abi: Erc721Abi,
      network: perChain((chain) => {
        const registry = registrySource(chain);
        return {
          address: factory({
            address: asAddress(registry.address, `Registry on ${chain.network}`),
            event: registryChamberCreatedEvent,
            parameter: "erc721Token",
          }),
          startBlock: registry.startBlock,
        };
      }),
      startBlock: minStart((chain) => registrySource(chain).startBlock),
    },
    FactoryNft: {
      abi: Erc721Abi,
      network: perChain((chain) => ({
        address: factory({
          address: asAddress(chain.factory, `Factory on ${chain.network}`),
          event: factoryChamberCreatedEvent,
          parameter: "nft",
        }),
        startBlock: chain.factoryStartBlock,
      })),
      startBlock: minStart((chain) => chain.factoryStartBlock),
    },
  },
});
