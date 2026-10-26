import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

/** Chamber deployment record. Source of truth for Factory address and start block. */
export const canonicalDeploymentPath = join(
  packageRoot,
  "../contracts/deployments/base-sepolia.txt",
);

/**
 * Written by scripts/stage-deployment.mjs when the host checkout is only
 * this package (Railway root directory `indexer/`). Same file, same commit.
 */
export const stagedDeploymentPath = join(packageRoot, ".deployment/base-sepolia.txt");

const FACTORY_LINE = /^Factory\s+(0x[a-fA-F0-9]{40})\s*$/i;
const START_LINE = /^Factory start block\s+(\d+)\s*$/i;

/** Last matching label wins, same rule as the app's base-sepolia parser. */
export function parseBaseSepoliaDeployment(text) {
  let factory;
  let factoryStartBlock;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const factoryMatch = trimmed.match(FACTORY_LINE);
    if (factoryMatch?.[1]) factory = factoryMatch[1];
    const startMatch = trimmed.match(START_LINE);
    if (!startMatch?.[1]) continue;
    const parsed = Number(startMatch[1]);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(
        `Invalid Factory start block '${startMatch[1]}' in contracts/deployments/base-sepolia.txt.`,
      );
    }
    factoryStartBlock = parsed;
  }
  if (factory === undefined || factoryStartBlock === undefined) {
    throw new Error(
      "contracts/deployments/base-sepolia.txt must record Factory and Factory start block.",
    );
  }
  return { factory, factoryStartBlock };
}

export function resolveBaseSepoliaDeploymentPath() {
  if (existsSync(canonicalDeploymentPath)) return canonicalDeploymentPath;
  if (existsSync(stagedDeploymentPath)) return stagedDeploymentPath;
  throw new Error(
    "Missing contracts/deployments/base-sepolia.txt. A full chamber checkout reads ../contracts/deployments/base-sepolia.txt. An indexer-only host checkout must run scripts/stage-deployment.mjs first (Railway root directory indexer/).",
  );
}

export function readBaseSepoliaDeployment() {
  const path = resolveBaseSepoliaDeploymentPath();
  return parseBaseSepoliaDeployment(readFileSync(path, "utf8"));
}
