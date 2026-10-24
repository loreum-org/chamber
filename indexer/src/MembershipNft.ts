import { ponder } from "ponder:registry";
import { boardSeat, chamber } from "ponder:schema";
import { eq } from "ponder";

import { asHex, refreshBoard, refreshChamber, type Ctx } from "./lib/state";

/**
 * Directors are the NFT owners of the top board tokenIds, and seating
 * maturity resets on transfer. Neither emits a Chamber event, so watch each
 * chamber's membership NFT and refresh boards that hold the moved tokenId.
 */
async function onNftTransfer({
  event,
  context,
}: {
  event: {
    args: { tokenId: bigint };
    log: { address: string };
    block: { number: bigint; timestamp: bigint };
  };
  context: Ctx;
}) {
  const nft = asHex(event.log.address);
  const chambers = await context.db.sql
    .select({ id: chamber.id })
    .from(chamber)
    .where(eq(chamber.nft, nft));
  const block = { number: event.block.number, timestamp: event.block.timestamp };

  for (const { id } of chambers) {
    const seat = await context.db.find(boardSeat, {
      chamberId: id,
      tokenId: event.args.tokenId,
    });
    if (!seat) continue;
    await refreshBoard(context, id, block);
    await refreshChamber(context, id, block);
  }
}

ponder.on("RegistryNft:Transfer", onNftTransfer as never);
ponder.on("FactoryNft:Transfer", onNftTransfer as never);
