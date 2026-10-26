import assert from "node:assert/strict";

import {
  parseBaseSepoliaDeployment,
  readBaseSepoliaDeployment,
} from "../baseSepoliaDeployment.mjs";

const sample = `
Factory                   0x0000000000000000000000000000000000000001
Factory start block       10
Factory                   https://sepolia.basescan.org/address/0x0000000000000000000000000000000000000001#code
Factory tx                0x57b2222ab86525ab3b1b8e13f44f94d874466deeae0b7d20102159b4eced7820
Factory start block       11
`;

const parsed = parseBaseSepoliaDeployment(sample);
assert.equal(parsed.factory, "0x0000000000000000000000000000000000000001");
assert.equal(parsed.factoryStartBlock, 11);

assert.throws(
  () => parseBaseSepoliaDeployment("Factory start block       1\n"),
  /Factory and Factory start block/,
);

const live = readBaseSepoliaDeployment();
assert.match(live.factory, /^0x[a-fA-F0-9]{40}$/);
assert.equal(Number.isInteger(live.factoryStartBlock), true);
assert.equal(live.factoryStartBlock > 0, true);
console.log(`${live.factory} ${live.factoryStartBlock}`);
