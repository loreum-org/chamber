import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import {
  INDEXED_CHAIN_TABLE,
  deploymentsDir,
  stagedDeploymentsDir,
} from "../baseSepoliaDeployment.mjs";

if (existsSync(deploymentsDir)) {
  const names = readdirSync(deploymentsDir).filter((name) => name.endsWith(".txt"));
  console.log(`deployment records: ${deploymentsDir} (${names.length} files)`);
  process.exit(0);
}

const sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
const owner = process.env.RAILWAY_GIT_REPO_OWNER || "loreum-org";
const repo = process.env.RAILWAY_GIT_REPO_NAME || "chamber";
if (!sha) {
  console.error(
    "contracts/deployments/ is not in this checkout, and RAILWAY_GIT_COMMIT_SHA / GITHUB_SHA is unset.",
  );
  process.exit(1);
}

const known = [
  ...INDEXED_CHAIN_TABLE.map((chain) => `${chain.network}.txt`),
  "mainnet.txt",
];

async function listDeploymentFiles() {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/contracts/deployments?ref=${sha}`;
  const response = await fetch(api, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "chamber-indexer",
    },
  });
  if (!response.ok) {
    console.error(`Deployment listing failed (${response.status}); staging ${known.join(", ")}.`);
    return known;
  }
  const body = await response.json();
  if (!Array.isArray(body)) return known;
  const names = body
    .filter((entry) => entry && entry.type === "file" && typeof entry.name === "string" && entry.name.endsWith(".txt"))
    .map((entry) => entry.name);
  return names.length > 0 ? names : known;
}

const names = await listDeploymentFiles();
await mkdir(stagedDeploymentsDir, { recursive: true });

for (const name of names) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/contracts/deployments/${name}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to read ${url}: ${response.status}`);
    process.exit(1);
  }
  await writeFile(`${stagedDeploymentsDir}/${name}`, await response.text());
  console.log(`deployment record staged from ${url}`);
}
