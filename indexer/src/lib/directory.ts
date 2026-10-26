import type { Context } from "ponder:registry";
import { chamber, chamberHolder } from "ponder:schema";
import { zeroAddress } from "viem";

type DirectoryDb = Context<"Registry:ChamberCreated">["db"];

export type ChamberRow = {
  id: `0x${string}`;
  address: `0x${string}`;
  asset: `0x${string}`;
  nft: `0x${string}`;
  seats: bigint;
  name: string;
  symbol: string;
  creator: `0x${string}`;
  source: "factory" | "registry";
  createdBlock: bigint;
  createdAt: bigint;
};

export const asHex = (value: string): `0x${string}` =>
  value.toLowerCase() as `0x${string}`;

export async function upsertChamber(
  db: DirectoryDb,
  values: ChamberRow,
): Promise<void> {
  await db.insert(chamber).values(values).onConflictDoNothing();
}

/**
 * Reconstruct current share balances from ERC-20 Transfer (mint/burn/transfer).
 * Deposit is not applied here — ERC-4626 already emits Transfer on mint.
 */
export async function applyShareTransfer(
  db: DirectoryDb,
  chamberAddress: `0x${string}`,
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint,
): Promise<void> {
  if (from !== zeroAddress) {
    await applyShareDelta(db, chamberAddress, from, -value);
  }
  if (to !== zeroAddress) {
    await applyShareDelta(db, chamberAddress, to, value);
  }
}

async function applyShareDelta(
  db: DirectoryDb,
  chamberAddress: `0x${string}`,
  account: `0x${string}`,
  delta: bigint,
): Promise<void> {
  await db
    .insert(chamberHolder)
    .values({
      chamberId: chamberAddress,
      account,
      shares: delta > 0n ? delta : 0n,
    })
    .onConflictDoUpdate((row) => {
      const next = row.shares + delta;
      return { shares: next < 0n ? 0n : next };
    });
}
