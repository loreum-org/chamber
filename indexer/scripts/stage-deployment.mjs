import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  canonicalDeploymentPath,
  stagedDeploymentPath,
} from "../baseSepoliaDeployment.mjs";

if (existsSync(canonicalDeploymentPath)) {
  console.log(`deployment record: ${canonicalDeploymentPath}`);
  process.exit(0);
}

const sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
const owner = process.env.RAILWAY_GIT_REPO_OWNER || "loreum-org";
const repo = process.env.RAILWAY_GIT_REPO_NAME || "chamber";
if (!sha) {
  console.error(
    "contracts/deployments/base-sepolia.txt is not in this checkout, and RAILWAY_GIT_COMMIT_SHA / GITHUB_SHA is unset.",
  );
  process.exit(1);
}

const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/contracts/deployments/base-sepolia.txt`;
const response = await fetch(url);
if (!response.ok) {
  console.error(`Failed to read ${url}: ${response.status}`);
  process.exit(1);
}

await mkdir(dirname(stagedDeploymentPath), { recursive: true });
await writeFile(stagedDeploymentPath, await response.text());
console.log(`deployment record staged from ${url}`);
