import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INDEXED_CHAIN_TABLE,
  deploymentsDir,
  ignoreFactoriesFor,
  loadIndexedChains,
  parseDeployment,
} from "../baseSepoliaDeployment.mjs";

const chains = loadIndexedChains({});
assert.equal(chains.some((chain) => chain.chainId === 1), false);
assert.equal(
  chains.some((chain) => chain.chainId === 84532),
  true,
  "base-sepolia Factory should be indexed",
);

const tableByNetwork = new Map(INDEXED_CHAIN_TABLE.map((chain) => [chain.network, chain]));
const names = readdirSync(deploymentsDir).filter((name) => name.endsWith(".txt")).sort();
assert.ok(names.length > 0);

for (const name of names) {
  const network = name.slice(0, -".txt".length);
  const text = readFileSync(join(deploymentsDir, name), "utf8");
  const parsed = parseDeployment(text, { ignoreFactories: ignoreFactoriesFor(network) });
  const indexed = chains.find((chain) => chain.network === network);
  const entry = tableByNetwork.get(network);
  if (!entry) {
    assert.equal(indexed, undefined, `${name} is outside the testnet chain table`);
    console.log(`${name}: not indexed`);
    continue;
  }
  if (parsed === null) {
    assert.equal(indexed, undefined, `${name} has no Factory and must be skipped`);
    console.log(`${name}: skipped`);
    continue;
  }
  assert.ok(indexed, `${name} Factory should be indexed`);
  assert.equal(indexed.chainId, entry.chainId);
  assert.equal(indexed.factory, parsed.factory);
  assert.equal(indexed.factoryStartBlock, parsed.factoryStartBlock);
  assert.match(indexed.factory, /^0x[a-fA-F0-9]{40}$/);
  assert.equal(Number.isInteger(indexed.factoryStartBlock), true);
  assert.equal(indexed.factoryStartBlock > 0, true);
  console.log(`${name}: ${indexed.chainId} ${indexed.factory} @ ${indexed.factoryStartBlock}`);
}
