import type { Context } from "ponder:registry";
import {
  boardSeat,
  chamber,
  delegation,
  directorOperator,
  proposal,
  proposalVote,
  seatUpdate,
} from "ponder:schema";
import { and, eq, notInArray } from "ponder";
import { hexToString, zeroAddress, type Hex } from "viem";

import { ChamberAbi } from "../../abis/ChamberAbi";
import { Erc721Abi } from "../../abis/Erc721Abi";

/**
 * Snapshot refreshers. Each one re-reads the chamber's own views at the
 * handler's block (Ponder's client defaults to the event block and caches
 * results), then upserts the state row. Reads go through Multicall3 with
 * allowFailure so views missing from older implementations become null
 * instead of failing the handler.
 */

export type Ctx = Pick<Context<"Chamber:Transfer">, "db" | "client">;
export type Address = `0x${string}`;

export type BlockRef = { number: bigint; timestamp: bigint };

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
/** getTop(getSize()) walks the whole list; cap it so a huge board cannot stall indexing. */
const MAX_BOARD_NODES = 256n;

export const asHex = (value: string): Address =>
  value.toLowerCase() as Address;

type ChamberCall = {
  address: Address;
  abi: typeof ChamberAbi;
  functionName: string;
  args?: readonly unknown[];
};

async function readMany(
  context: Ctx,
  calls: ChamberCall[],
): Promise<(unknown | null)[]> {
  if (calls.length === 0) return [];
  const results = await context.client.multicall({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: calls as any,
    allowFailure: true,
    multicallAddress: MULTICALL3,
  });
  return results.map((r) => (r.status === "success" ? r.result : null));
}

const bigOrNull = (v: unknown): bigint | null =>
  typeof v === "bigint" ? v : typeof v === "number" ? BigInt(v) : null;

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : null;

/** VERSION is `string` on current builds and `bytes32` on some older ones. */
function versionLabel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (/^0x[0-9a-fA-F]{64}$/.test(v)) {
    return hexToString(v as Hex, { size: 32 }).replace(/\0+$/, "") || null;
  }
  return v;
}

/** Chamber-wide totals, quorum, seats, pause flag, implementation. */
export async function refreshChamber(
  context: Ctx,
  address: Address,
  block: BlockRef,
): Promise<void> {
  const existing = await context.db.find(chamber, { id: address });
  if (!existing) return;

  const c = (functionName: string): ChamberCall => ({
    address,
    abi: ChamberAbi,
    functionName,
  });
  const [
    totalAssets,
    totalSupply,
    decimals,
    quorum,
    seats,
    boardSize,
    reachable,
    txCount,
    paused,
    version,
  ] = await readMany(context, [
    c("totalAssets"),
    c("totalSupply"),
    c("decimals"),
    c("getQuorum"),
    c("getSeats"),
    c("getSize"),
    c("getReachableDirectorCount"),
    c("getTransactionCount"),
    c("paused"),
    c("VERSION"),
  ]);

  const [ethBalance, implSlot] = await Promise.all([
    context.client.getBalance({ address }).catch(() => null),
    context.client
      .getStorageAt({ address, slot: IMPLEMENTATION_SLOT })
      .catch(() => null),
  ]);
  const implementation =
    implSlot && implSlot !== "0x" ? asHex(`0x${implSlot.slice(-40)}`) : null;

  await context.db.update(chamber, { id: address }).set({
    totalAssets: bigOrNull(totalAssets),
    totalSupply: bigOrNull(totalSupply),
    decimals: numOrNull(decimals),
    quorum: bigOrNull(quorum),
    seats: bigOrNull(seats) ?? existing.seats,
    boardSize: bigOrNull(boardSize),
    reachableDirectors: bigOrNull(reachable),
    transactionCount: bigOrNull(txCount),
    paused: typeof paused === "boolean" ? paused : null,
    version: versionLabel(version),
    ethBalance,
    implementation,
    updatedBlock: block.number,
    updatedAt: block.timestamp,
  });
}

/** Full ranked board: getTop(getSize()), each node's NFT owner and seatedAt. */
export async function refreshBoard(
  context: Ctx,
  address: Address,
  block: BlockRef,
): Promise<void> {
  const row = await context.db.find(chamber, { id: address });
  if (!row) return;

  const [size] = await readMany(context, [
    { address, abi: ChamberAbi, functionName: "getSize" },
  ]);
  const count = bigOrNull(size) ?? 0n;
  let tokenIds: readonly bigint[] = [];
  let amounts: readonly bigint[] = [];
  if (count > 0n) {
    const [top] = await readMany(context, [
      {
        address,
        abi: ChamberAbi,
        functionName: "getTop",
        args: [count > MAX_BOARD_NODES ? MAX_BOARD_NODES : count],
      },
    ]);
    if (Array.isArray(top)) {
      tokenIds = top[0] as readonly bigint[];
      amounts = top[1] as readonly bigint[];
    }
  }

  const perToken = await context.client.multicall({
    contracts: tokenIds.flatMap((tokenId) => [
      {
        address: row.nft,
        abi: Erc721Abi,
        functionName: "ownerOf" as const,
        args: [tokenId] as const,
      },
      {
        address,
        abi: ChamberAbi,
        functionName: "getSeatedAt" as const,
        args: [tokenId] as const,
      },
    ]),
    allowFailure: true,
    multicallAddress: MULTICALL3,
  });

  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i]!;
    const owner = perToken[i * 2];
    const seatedAt = perToken[i * 2 + 1];
    const values = {
      rank: i,
      amount: amounts[i] ?? 0n,
      owner:
        owner?.status === "success" && owner.result !== zeroAddress
          ? asHex(owner.result as string)
          : null,
      seatedAt:
        seatedAt?.status === "success" ? bigOrNull(seatedAt.result) : null,
      updatedBlock: block.number,
    };
    await context.db
      .insert(boardSeat)
      .values({ chamberId: address, tokenId, ...values })
      .onConflictDoUpdate(values);
  }

  // Drop nodes that left the board (fully undelegated or cleaned up).
  await context.db.sql
    .delete(boardSeat)
    .where(
      tokenIds.length > 0
        ? and(
            eq(boardSeat.chamberId, address),
            notInArray(boardSeat.tokenId, [...tokenIds]),
          )
        : eq(boardSeat.chamberId, address),
    );
}

export async function refreshDelegation(
  context: Ctx,
  address: Address,
  holder: Address,
  tokenId: bigint,
  block: BlockRef,
  knownAmount?: bigint,
): Promise<void> {
  let amount = knownAmount;
  if (amount === undefined) {
    const [read] = await readMany(context, [
      {
        address,
        abi: ChamberAbi,
        functionName: "getHolderDelegation",
        args: [holder, tokenId],
      },
    ]);
    amount = bigOrNull(read) ?? undefined;
  }
  if (amount === undefined) return;
  const values = { amount, updatedBlock: block.number };
  await context.db
    .insert(delegation)
    .values({ chamberId: address, holder: asHex(holder), tokenId, ...values })
    .onConflictDoUpdate(values);
}

/** Wallet transaction status; `seed` carries fields only the submit event has. */
export async function refreshProposal(
  context: Ctx,
  address: Address,
  nonce: bigint,
  block: BlockRef,
  seed: Partial<typeof proposal.$inferInsert> = {},
): Promise<void> {
  const c = (functionName: string): ChamberCall => ({
    address,
    abi: ChamberAbi,
    functionName,
    args: [nonce],
  });
  const [tx, cancelled, cancelCount, deadline, requiredQuorum, metadata, calldata] =
    await readMany(context, [
      c("getTransaction"),
      c("getCancelled"),
      c("getCancelConfirmations"),
      c("getTransactionDeadline"),
      c("getTransactionRequiredQuorum"),
      c("getTransactionMetadata"),
      c("getTransactionCalldata"),
    ]);

  // getTransaction reverts for a nonce that does not exist yet (e.g. deadline
  // or metadata events emitted before SubmitTransaction in the same tx).
  const t = Array.isArray(tx)
    ? (tx as readonly [boolean, number, string, bigint, string])
    : null;
  const values = {
    ...seed,
    executed: t ? t[0] : false,
    confirmations: t ? t[1] : null,
    target: t ? asHex(t[2]) : (seed.target ?? null),
    value: t ? t[3] : (seed.value ?? null),
    dataHash: t ? (t[4] as Hex) : null,
    // Older implementations don't store calldata (the view returns 0x); keep
    // the SubmitTransaction event's bytes instead of overwriting them.
    data:
      typeof calldata === "string" && calldata !== "0x"
        ? (calldata as Hex)
        : (seed.data ?? null),
    cancelled: cancelled === true,
    cancelConfirmations: numOrNull(cancelCount),
    deadline: bigOrNull(deadline),
    requiredQuorum: bigOrNull(requiredQuorum),
    metadataURI: typeof metadata === "string" && metadata !== "" ? metadata : null,
    updatedBlock: block.number,
  };
  // Keep first-seen submit fields when later refreshes have no seed.
  const update = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== null && v !== undefined),
  );
  await context.db
    .insert(proposal)
    .values({ chamberId: address, nonce, ...values })
    .onConflictDoUpdate({ ...update, executed: values.executed, cancelled: values.cancelled });
}

export async function refreshVote(
  context: Ctx,
  address: Address,
  nonce: bigint,
  tokenId: bigint,
  block: BlockRef,
): Promise<void> {
  const [confirmed, cancelVoted] = await readMany(context, [
    {
      address,
      abi: ChamberAbi,
      functionName: "getConfirmation",
      args: [tokenId, nonce],
    },
    {
      address,
      abi: ChamberAbi,
      functionName: "getCancelConfirmation",
      args: [tokenId, nonce],
    },
  ]);
  const values = {
    confirmed: confirmed === true,
    cancelVoted: cancelVoted === true,
    updatedBlock: block.number,
  };
  await context.db
    .insert(proposalVote)
    .values({ chamberId: address, nonce, tokenId, ...values })
    .onConflictDoUpdate(values);
}

export async function refreshSeatUpdate(
  context: Ctx,
  address: Address,
  block: BlockRef,
): Promise<void> {
  const [update] = await readMany(context, [
    { address, abi: ChamberAbi, functionName: "getSeatUpdate" },
  ]);
  if (!Array.isArray(update)) return;
  const [proposedSeats, timestamp, requiredQuorum, supporters] = update as [
    bigint,
    bigint,
    bigint,
    readonly bigint[],
  ];
  const values = {
    proposedSeats,
    timestamp,
    requiredQuorum,
    supporters: [...supporters],
    updatedBlock: block.number,
  };
  await context.db
    .insert(seatUpdate)
    .values({ chamberId: address, ...values })
    .onConflictDoUpdate(values);
}

export async function refreshOperator(
  context: Ctx,
  address: Address,
  tokenId: bigint,
  owner: Address,
  operator: Address,
  expiry: bigint,
  block: BlockRef,
): Promise<void> {
  const [scope, liveAt] = await readMany(context, [
    {
      address,
      abi: ChamberAbi,
      functionName: "getDirectorOperatorScope",
      args: [tokenId],
    },
    {
      address,
      abi: ChamberAbi,
      functionName: "getDirectorOperatorLiveAt",
      args: [tokenId],
    },
  ]);
  const values = {
    owner: asHex(owner),
    operator: asHex(operator),
    expiry,
    scope: bigOrNull(scope),
    liveAt: bigOrNull(liveAt),
    updatedBlock: block.number,
  };
  await context.db
    .insert(directorOperator)
    .values({ chamberId: address, tokenId, ...values })
    .onConflictDoUpdate(values);
}

/** Initial snapshot after ChamberCreated (Initialized fires before the directory row exists). */
export async function refreshNewChamber(
  context: Ctx,
  address: Address,
  block: BlockRef,
): Promise<void> {
  await refreshChamber(context, address, block);
  await refreshBoard(context, address, block);
  await refreshSeatUpdate(context, address, block);
}
