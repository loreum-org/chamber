import { ponder } from "ponder:registry";
import { factory_ChamberCreated } from "ponder:schema";

import { asHex, upsertChamber } from "./lib/directory";
import { refreshNewChamber } from "./lib/state";

ponder.on("Factory:ChamberCreated", async ({ context, event }) => {
  const address = asHex(event.args.chamber);

  await context.db.insert(factory_ChamberCreated).values({
    id: event.log.id,
    chamber: address,
    asset: asHex(event.args.asset),
    nft: asHex(event.args.nft),
    seats: event.args.seats,
    name: event.args.name,
    symbol: event.args.symbol,
    creator: asHex(event.args.creator),
  });

  await upsertChamber(context.db, {
    id: address,
    address,
    asset: asHex(event.args.asset),
    nft: asHex(event.args.nft),
    seats: event.args.seats,
    name: event.args.name,
    symbol: event.args.symbol,
    creator: asHex(event.args.creator),
    source: "factory",
    createdBlock: event.block.number,
    createdAt: event.block.timestamp,
  });

  await refreshNewChamber(context, address, {
    number: event.block.number,
    timestamp: event.block.timestamp,
  });
});
