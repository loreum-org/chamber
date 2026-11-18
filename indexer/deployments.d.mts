export type ChainTableEntry = {
  chainId: number;
  network: string;
  name: string;
};

export type DeploymentRecord = {
  factory: `0x${string}`;
  factoryStartBlock: number;
  registry?: `0x${string}`;
  registryStartBlock?: number;
};

export type IndexedChain = {
  chainId: number;
  network: string;
  name: string;
  factory: `0x${string}`;
  /** Lowercase factory address, paired with chainId for cross-chain identity. */
  factoryKey: string;
  factoryStartBlock: number;
  registry?: `0x${string}`;
  registryStartBlock: number;
};

export const deploymentsDir: string;
export const stagedDeploymentsDir: string;
export const INDEXED_CHAIN_TABLE: readonly ChainTableEntry[];
export const PRE_130_SEPOLIA_FACTORY: `0x${string}`;
export const REGISTRY_PLACEHOLDER: `0x${string}`;

export function ignoreFactoriesFor(network: string): readonly string[];
export function chainPrimaryKey(
  chainId: number,
  ...parts: readonly (string | number | bigint)[]
): [number, ...(string | number | bigint)[]];
export function parseDeployment(
  text: string,
  options?: { ignoreFactories?: readonly string[] },
): DeploymentRecord | null;
export function resolveDeploymentPath(network: string): string | null;
export function readDeployment(network: string): DeploymentRecord | null;
export function resolveIndexedChains(
  table: readonly ChainTableEntry[],
  readText: (network: string) => string | null,
  env?: Record<string, string | undefined>,
): IndexedChain[];
export function loadIndexedChains(
  env?: Record<string, string | undefined>,
): IndexedChain[];
export function assertIndexedChains(chains: readonly IndexedChain[]): IndexedChain[];
export function rpcUrlFor(
  chain: { chainId: number; network: string },
  env: Record<string, string | undefined>,
): string;
export function registrySource(chain: {
  registry?: string;
  registryStartBlock: number;
}): { address: `0x${string}`; startBlock: number; placeholder: boolean };
