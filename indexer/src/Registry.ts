import { ponder } from "ponder:registry";
import {
  registry_ChamberCreated,
  registry_Initialized,
  registry_RoleAdminChanged,
  registry_RoleGranted,
  registry_RoleRevoked,
} from "ponder:schema";

import { asHex, upsertChamber } from "./lib/directory";
import { refreshNewChamber } from "./lib/state";

ponder.on("Registry:ChamberCreated", async ({ context, event }) => {
  const address = asHex(event.args.chamber);

  await context.db.insert(registry_ChamberCreated).values({
    id: event.log.id,
    chamber: event.args.chamber,
    seats: event.args.seats,
    name: event.args.name,
    symbol: event.args.symbol,
    erc20Token: event.args.erc20Token,
    erc721Token: event.args.erc721Token,
  });

  // Legacy event has no creator; createChamber is called by the deployer EOA.
  await upsertChamber(context.db, {
    id: address,
    address,
    asset: asHex(event.args.erc20Token),
    nft: asHex(event.args.erc721Token),
    seats: event.args.seats,
    name: event.args.name,
    symbol: event.args.symbol,
    creator: asHex(event.transaction.from),
    source: "registry",
    createdBlock: event.block.number,
    createdAt: event.block.timestamp,
  });

  await refreshNewChamber(context, address, {
    number: event.block.number,
    timestamp: event.block.timestamp,
  });
});

ponder.on("Registry:Initialized", async ({ context, event }) => {
  await context.db.insert(registry_Initialized).values({
    id: event.log.id,
    version: event.args.version,
  });
});

ponder.on("Registry:RoleAdminChanged", async ({ context, event }) => {
  await context.db.insert(registry_RoleAdminChanged).values({
    id: event.log.id,
    role: event.args.role,
    previousAdminRole: event.args.previousAdminRole,
    newAdminRole: event.args.newAdminRole,
  });
});

ponder.on("Registry:RoleGranted", async ({ context, event }) => {
  await context.db.insert(registry_RoleGranted).values({
    id: event.log.id,
    role: event.args.role,
    account: event.args.account,
    sender: event.args.sender,
  });
});

ponder.on("Registry:RoleRevoked", async ({ context, event }) => {
  await context.db.insert(registry_RoleRevoked).values({
    id: event.log.id,
    role: event.args.role,
    account: event.args.account,
    sender: event.args.sender,
  });
});
