import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  INDEXED_CHAIN_TABLE,
  PRE_130_SEPOLIA_FACTORY,
  REGISTRY_PLACEHOLDER,
  deploymentsDir,
  assertIndexedChains,
  chainPrimaryKey,
  ignoreFactoriesFor,
  loadIndexedChains,
  parseDeployment,
  registrySource,
  resolveDeploymentPath,
  resolveIndexedChains,
  rpcUrlFor,
} from "../baseSepoliaDeployment.mjs";

const FACTORY = "0x9bd245B992f0ba869D208bdABecB608080984701";
const OTHER = "0x1111111111111111111111111111111111111111";

test("skips a file that says Not deployed yet", () => {
  const text = `
  Arbitrum Sepolia (chain 421614)
  Not deployed yet. Run from contracts/:
    make deploy-testnet network=arbitrum-sepolia account=<keystore>
  The script appends the Factory, Chamber implementation, start block and
  demo token addresses here.
`;
  assert.equal(parseDeployment(text), null);
});

test("a Factory line appended under Not deployed yet enables the chain", () => {
  const text = `
  Not deployed yet.
  Factory                   ${FACTORY}
  Factory start block       50
`;
  const parsed = parseDeployment(text);
  assert.equal(parsed.factory, FACTORY);
  assert.equal(parsed.factoryStartBlock, 50);
});

test("ignores the pre-1.3.0 Aug 26 Sepolia Factory even with a start block", () => {
  const oldOnly = `
  Aug 26, 2026 - Sepolia (Factory path, library extraction)
  Factory                   ${PRE_130_SEPOLIA_FACTORY}
  Factory start block       9
`;
  assert.equal(
    parseDeployment(oldOnly, { ignoreFactories: ignoreFactoriesFor("sepolia") }),
    null,
  );

  const withNext = `
  ${oldOnly}
  Factory                   ${OTHER}
  Factory start block       42
  Registry (proxy)          0x2222222222222222222222222222222222222222
`;
  const parsed = parseDeployment(withNext, {
    ignoreFactories: ignoreFactoriesFor("sepolia"),
  });
  assert.equal(parsed.factory, OTHER);
  assert.equal(parsed.factoryStartBlock, 42);
  assert.equal(parsed.registry, "0x2222222222222222222222222222222222222222");
  assert.notEqual(parsed.factory.toLowerCase(), PRE_130_SEPOLIA_FACTORY.toLowerCase());
});

test("invalid Factory start block throws", () => {
  assert.throws(
    () => parseDeployment(`Factory ${FACTORY}\nFactory start block       -1\n`),
    /Factory start block/,
  );
});

test("last Factory line wins", () => {
  const parsed = parseDeployment(`
Factory                   0x0000000000000000000000000000000000000001
Factory start block       10
Factory                   ${FACTORY}
Factory start block       11
`);
  assert.equal(parsed.factory, FACTORY);
  assert.equal(parsed.factoryStartBlock, 11);
});

test("same Factory address on two chains is two primary keys", () => {
  const text = `Factory ${FACTORY}\nFactory start block 10\n`;
  const chains = resolveIndexedChains(
    INDEXED_CHAIN_TABLE,
    (network) => (network === "base-sepolia" || network === "op-sepolia" ? text : "Not deployed yet\n"),
    {},
  );
  assert.deepEqual(
    chains.map((chain) => chain.chainId),
    [84532, 11155420],
  );
  assert.equal(chains[0].factory.toLowerCase(), chains[1].factory.toLowerCase());
  const left = chainPrimaryKey(chains[0].chainId, chains[0].factoryKey);
  const right = chainPrimaryKey(chains[1].chainId, chains[1].factoryKey);
  assert.equal(left[1], right[1]);
  assert.notDeepEqual(left, right);
  assert.equal(new Set(chains.map((chain) => `${chain.chainId}:${chain.factoryKey}`)).size, 2);
});

test("undeployed chains are omitted and a per-chain override adds one", () => {
  const text = (network) =>
    network === "base-sepolia"
      ? `Factory ${FACTORY}\nFactory start block 48743114\n`
      : "Not deployed yet\n";
  const skipped = resolveIndexedChains(INDEXED_CHAIN_TABLE, text, {});
  assert.deepEqual(skipped.map((chain) => chain.chainId), [84532]);

  const withArb = resolveIndexedChains(INDEXED_CHAIN_TABLE, text, {
    PONDER_FACTORY_ADDRESS_421614: OTHER,
    PONDER_FACTORY_START_BLOCK_421614: "80",
  });
  assert.deepEqual(withArb.map((chain) => chain.chainId), [84532, 421614]);
  assert.equal(withArb[1].factory, OTHER);
  assert.equal(withArb[1].factoryStartBlock, 80);
});

test("a partial Factory override fails instead of skipping the chain", () => {
  assert.throws(
    () =>
      resolveIndexedChains(
        INDEXED_CHAIN_TABLE,
        () => "Not deployed yet\n",
        { PONDER_FACTORY_ADDRESS_421614: OTHER },
      ),
    /421614/,
  );
});

test("Registry placeholder is used only when the file has no Registry", () => {
  const bare = resolveIndexedChains(
    INDEXED_CHAIN_TABLE,
    (network) =>
      network === "base-sepolia"
        ? `Factory ${FACTORY}\nFactory start block 1\n`
        : null,
    {},
  );
  assert.equal(registrySource(bare[0]).placeholder, true);
  assert.equal(registrySource(bare[0]).address, REGISTRY_PLACEHOLDER);

  const withRegistry = resolveIndexedChains(
    INDEXED_CHAIN_TABLE,
    (network) =>
      network === "base-sepolia"
        ? `Factory ${FACTORY}\nFactory start block 1\nRegistry (proxy) 0x3333333333333333333333333333333333333333\n`
        : null,
    {},
  );
  assert.equal(registrySource(withRegistry[0]).placeholder, false);
  assert.equal(
    registrySource(withRegistry[0]).address,
    "0x3333333333333333333333333333333333333333",
  );
});

test("rpc is required for indexed chains and unused for skipped ones", () => {
  const chains = resolveIndexedChains(
    INDEXED_CHAIN_TABLE,
    (network) =>
      network === "base-sepolia"
        ? `Factory ${FACTORY}\nFactory start block 1\n`
        : "Not deployed yet\n",
    {},
  );
  assert.throws(() => rpcUrlFor(chains[0], {}), /PONDER_RPC_URL_84532/);
  assert.equal(
    rpcUrlFor(chains[0], { PONDER_RPC_URL_84532: " https://example.invalid/base " }),
    "https://example.invalid/base",
  );
  assert.equal(chains.some((chain) => chain.chainId === 421614), false);
});

test("no indexed chains is an error, and mainnet is not in the table", () => {
  assert.throws(() => assertIndexedChains([]), /No testnet Factory/);
  assert.equal(INDEXED_CHAIN_TABLE.some((chain) => chain.chainId === 1), false);
  assert.equal(INDEXED_CHAIN_TABLE.some((chain) => chain.network === "mainnet"), false);
});

test("live deployment files stay inside the testnet table", () => {
  const chains = loadIndexedChains({});
  assert.equal(chains.some((chain) => chain.chainId === 1), false);
  const base = chains.find((chain) => chain.chainId === 84532);
  assert.ok(base);
  assert.match(base.factory, /^0x[a-fA-F0-9]{40}$/);
  assert.equal(base.factoryStartBlock > 0, true);
  assert.equal(registrySource(base).placeholder, true);

  for (const entry of INDEXED_CHAIN_TABLE) {
    const path = resolveDeploymentPath(entry.network);
    assert.ok(path);
    const text = readFileSync(path, "utf8");
    const parsed = parseDeployment(text, {
      ignoreFactories: ignoreFactoriesFor(entry.network),
    });
    const indexed = chains.find((chain) => chain.chainId === entry.chainId);
    if (parsed === null) {
      assert.equal(indexed, undefined);
    } else {
      assert.equal(indexed?.factory, parsed.factory);
      assert.notEqual(
        parsed.factory.toLowerCase(),
        PRE_130_SEPOLIA_FACTORY.toLowerCase(),
      );
    }
    if (/not deployed yet/i.test(text) && parsed === null) {
      assert.equal(indexed, undefined);
    }
  }

  const mainnet = readFileSync(join(deploymentsDir, "mainnet.txt"), "utf8");
  assert.doesNotThrow(() => parseDeployment(mainnet));
  assert.equal(chains.some((chain) => chain.network === "mainnet"), false);
});
