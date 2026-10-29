import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

/** Full checkout: `contracts/deployments/<network>.txt`. */
export const deploymentsDir = join(packageRoot, "../contracts/deployments");

/**
 * Indexer-only checkout (Railway root directory `indexer/`).
 * `scripts/stage-deployment.mjs` writes the same files here.
 */
export const stagedDeploymentsDir = join(packageRoot, ".deployment");

/**
 * Testnets this process can index. Mainnet is intentionally absent.
 * A chain is included only when its deployment file (or a per-chain env
 * override) has a Factory and a Factory start block.
 */
export const INDEXED_CHAIN_TABLE = [
  { chainId: 84532, network: "base-sepolia", name: "baseSepolia" },
  { chainId: 421614, network: "arbitrum-sepolia", name: "arbitrumSepolia" },
  { chainId: 11155420, network: "op-sepolia", name: "opSepolia" },
  { chainId: 11155111, network: "sepolia", name: "sepolia" },
];

/**
 * Aug 26, 2026 Ethereum Sepolia Factory (pre-1.3.0, `DeployFactory`).
 * A later Factory line in `sepolia.txt` is the 1.3.0 CREATE2 deploy.
 */
export const PRE_130_SEPOLIA_FACTORY =
  "0x43aA92c8A26392f21F63cdA88B6BaB5031C40550";

/** Not a Chamber registry. Handlers still need a Registry source. */
export const REGISTRY_PLACEHOLDER =
  "0x000000000000000000000000000000000000dEaD";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const FACTORY_LINE = /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i;
const START_LINE = /^Factory start block\s+(\S+)\s*$/i;
const REGISTRY_LINE = /^Registry \(proxy\)\s+(0x[a-fA-F0-9]{40})\s*$/i;
const REGISTRY_START_LINE = /^Registry start block\s+(\S+)\s*$/i;

export function ignoreFactoriesFor(network) {
  return network === "sepolia" ? [PRE_130_SEPOLIA_FACTORY] : [];
}

/** `(chainId, …parts)`. The same CREATE2 address on two chains stays two keys. */
export function chainPrimaryKey(chainId, ...parts) {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chain id '${chainId}'.`);
  }
  return [chainId, ...parts];
}

function parseBlock(raw, label) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `Invalid ${label} '${raw}'. Expected a non-negative integer.`,
    );
  }
  return parsed;
}

/**
 * Last Factory line wins. A Factory in `ignoreFactories` is skipped, so the
 * Aug 26 Sepolia Factory cannot become the indexed source. No Factory, or a
 * Factory with no start block, returns null (file says "Not deployed yet",
 * or only the ignored Factory is present).
 */
export function parseDeployment(text, options = {}) {
  const ignore = new Set(
    (options.ignoreFactories ?? []).map((address) => address.toLowerCase()),
  );
  let factory;
  let factoryStartBlock;
  let ignoring = false;
  let registry;
  let registryStartBlock;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const factoryMatch = trimmed.match(FACTORY_LINE);
    if (factoryMatch?.[1]) {
      if (ignore.has(factoryMatch[1].toLowerCase())) {
        ignoring = true;
        continue;
      }
      ignoring = false;
      factory = factoryMatch[1];
      factoryStartBlock = undefined;
      continue;
    }
    const startMatch = trimmed.match(START_LINE);
    if (startMatch?.[1]) {
      if (ignoring || factory === undefined) continue;
      factoryStartBlock = parseBlock(startMatch[1], "Factory start block");
      continue;
    }
    const registryMatch = trimmed.match(REGISTRY_LINE);
    if (registryMatch?.[1]) {
      registry = registryMatch[1];
      continue;
    }
    const registryStartMatch = trimmed.match(REGISTRY_START_LINE);
    if (registryStartMatch?.[1]) {
      registryStartBlock = parseBlock(
        registryStartMatch[1],
        "Registry start block",
      );
    }
  }

  if (factory === undefined || factoryStartBlock === undefined) return null;
  return {
    factory,
    factoryStartBlock,
    ...(registry ? { registry } : {}),
    ...(registryStartBlock !== undefined ? { registryStartBlock } : {}),
  };
}

export function resolveDeploymentPath(network) {
  const canonical = join(deploymentsDir, `${network}.txt`);
  const staged = join(stagedDeploymentsDir, `${network}.txt`);
  if (existsSync(canonical)) return canonical;
  if (existsSync(staged)) return staged;
  return null;
}

/** Parsed deployment for one network, or null when that chain is not deployed. */
export function readDeployment(network) {
  const path = resolveDeploymentPath(network);
  if (path === null) return null;
  return parseDeployment(readFileSync(path, "utf8"), {
    ignoreFactories: ignoreFactoriesFor(network),
  });
}

function envValue(env, name) {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

function envAddress(env, name) {
  const value = envValue(env, name);
  if (value === undefined) return undefined;
  if (!ADDRESS_RE.test(value)) {
    throw new Error(
      `Invalid ${name} '${value}'. Expected a 20-byte hex address.`,
    );
  }
  return value;
}

function envBlock(env, name) {
  const value = envValue(env, name);
  if (value === undefined) return undefined;
  return parseBlock(value, name);
}

/**
 * Chains whose deployment file (or `PONDER_*_<chainId>` override) has a Factory.
 * `readText` returns the file body, or null when the file is missing.
 */
export function resolveIndexedChains(table, readText, env = {}) {
  const chains = [];
  for (const entry of table) {
    const text = readText(entry.network);
    const parsed =
      text == null
        ? null
        : parseDeployment(text, {
            ignoreFactories: ignoreFactoriesFor(entry.network),
          });
    const factoryOverride = envAddress(
      env,
      `PONDER_FACTORY_ADDRESS_${entry.chainId}`,
    );
    const startOverride = envBlock(
      env,
      `PONDER_FACTORY_START_BLOCK_${entry.chainId}`,
    );
    const factory = factoryOverride ?? parsed?.factory;
    const factoryStartBlock = startOverride ?? parsed?.factoryStartBlock;
    if (factory === undefined || factoryStartBlock === undefined) {
      if (factoryOverride !== undefined || startOverride !== undefined) {
        throw new Error(
          `Chain ${entry.chainId} (${entry.network}) needs both a Factory address and a Factory start block. Set the missing PONDER_FACTORY_*_${entry.chainId} value or record it in contracts/deployments/${entry.network}.txt.`,
        );
      }
      continue;
    }
    const registryOverride = envAddress(
      env,
      `PONDER_REGISTRY_ADDRESS_${entry.chainId}`,
    );
    const registryStartOverride = envBlock(
      env,
      `PONDER_REGISTRY_START_BLOCK_${entry.chainId}`,
    );
    const registry = registryOverride ?? parsed?.registry;
    const registryStartBlock =
      registryStartOverride ??
      parsed?.registryStartBlock ??
      factoryStartBlock;
    const [chainId, factoryKey] = chainPrimaryKey(
      entry.chainId,
      factory.toLowerCase(),
    );
    chains.push({
      chainId,
      network: entry.network,
      name: entry.name,
      factory,
      factoryKey,
      factoryStartBlock,
      ...(registry ? { registry } : {}),
      registryStartBlock,
    });
  }
  return chains;
}

export function loadIndexedChains(env = process.env) {
  return resolveIndexedChains(
    INDEXED_CHAIN_TABLE,
    (network) => {
      const path = resolveDeploymentPath(network);
      if (path === null) return null;
      return readFileSync(path, "utf8");
    },
    env,
  );
}

export function assertIndexedChains(chains) {
  if (chains.length === 0) {
    throw new Error(
      "No testnet Factory to index. Record Factory and Factory start block in contracts/deployments/<network>.txt, or stage those files into indexer/.deployment/.",
    );
  }
  return chains;
}

export function rpcUrlFor(chain, env) {
  const name = `PONDER_RPC_URL_${chain.chainId}`;
  const value = envValue(env, name);
  if (value === undefined) {
    throw new Error(
      `Missing ${name} for ${chain.network}. Set a dedicated HTTPS RPC URL.`,
    );
  }
  return value;
}

/** Real Registry when the file has one; otherwise the non-registry placeholder. */
export function registrySource(chain) {
  return {
    address: chain.registry ?? REGISTRY_PLACEHOLDER,
    startBlock: chain.registryStartBlock,
    placeholder: chain.registry === undefined,
  };
}
