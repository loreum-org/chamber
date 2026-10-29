import { ponder } from "ponder:registry";
import { chamberEvent } from "ponder:schema";
import type { Hex } from "viem";

import { applyShareTransfer } from "./lib/directory";
import {
  asHex,
  refreshBoard,
  refreshChamber,
  refreshDelegation,
  refreshOperator,
  refreshProposal,
  refreshSeatUpdate,
  refreshVote,
  type Address,
  type BlockRef,
  type Ctx,
} from "./lib/state";

/**
 * Registry- and Factory-discovered chambers share one ABI but are two Ponder
 * contracts (0.8 allows one factory() per contract), so handlers are
 * registered once per source name.
 */
type ChamberSource = "Chamber" | "FactoryChamber";

type AnyEvent = {
  name: string;
  args: Record<string, unknown>;
  log: { id: string; address: string; logIndex: number };
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: Hex };
};

type Handler = (
  context: Ctx,
  chainId: number,
  chamber: Address,
  event: AnyEvent,
  block: BlockRef,
) => Promise<void>;

const big = (v: unknown) => v as bigint;
const addr = (v: unknown) => asHex(v as string);

async function refreshBoardState(
  context: Ctx,
  chainId: number,
  chamber: Address,
  block: BlockRef,
) {
  await refreshBoard(context, chainId, chamber, block);
  await refreshChamber(context, chainId, chamber, block);
}

async function refreshSeatState(
  context: Ctx,
  chainId: number,
  chamber: Address,
  block: BlockRef,
) {
  await refreshSeatUpdate(context, chainId, chamber, block);
  await refreshBoardState(context, chainId, chamber, block);
}

const byNonce: Handler = (context, chainId, chamber, event, block) =>
  refreshProposal(context, chainId, chamber, big(event.args.nonce), block);

const byTransactionId: Handler = (context, chainId, chamber, event, block) =>
  refreshProposal(context, chainId, chamber, big(event.args.transactionId), block);

const vote: Handler = async (context, chainId, chamber, event, block) => {
  const nonce = big(event.args.nonce);
  await refreshVote(context, chainId, chamber, nonce, big(event.args.tokenId), block);
  await refreshProposal(context, chainId, chamber, nonce, block);
};

const seatChange: Handler = (context, chainId, chamber, _event, block) =>
  refreshSeatState(context, chainId, chamber, block);

const chamberOnly: Handler = (context, chainId, chamber, _event, block) =>
  refreshChamber(context, chainId, chamber, block);

const HANDLERS: Record<string, Handler | null> = {
  Approval: null,
  Transfer: async (context, chainId, chamber, event, block) => {
    await applyShareTransfer(
      context.db,
      chainId,
      chamber,
      addr(event.args.from),
      addr(event.args.to),
      big(event.args.value),
    );
    await refreshChamber(context, chainId, chamber, block);
  },
  Deposit: chamberOnly,
  Withdraw: chamberOnly,
  Received: chamberOnly,
  ReceivedERC721: null,
  Paused: chamberOnly,
  Unpaused: chamberOnly,
  Initialized: chamberOnly,
  Upgraded: chamberOnly,

  Delegate: async (context, chainId, chamber, event, block) => {
    await refreshDelegation(
      context,
      chainId,
      chamber,
      addr(event.args.sender),
      big(event.args.tokenId),
      block,
    );
    await refreshBoardState(context, chainId, chamber, block);
  },
  Undelegate: async (context, chainId, chamber, event, block) => {
    await refreshDelegation(
      context,
      chainId,
      chamber,
      addr(event.args.sender),
      big(event.args.tokenId),
      block,
    );
    await refreshBoardState(context, chainId, chamber, block);
  },
  DelegationUpdated: (context, chainId, chamber, event, block) =>
    refreshDelegation(
      context,
      chainId,
      chamber,
      addr(event.args.holder),
      big(event.args.tokenId),
      block,
      big(event.args.amount),
    ),

  SetSeats: seatChange,
  ExecuteSetSeats: seatChange,
  SeatUpdateCancelled: seatChange,
  SeatsRecovered: seatChange,
  InertSeatCleaned: seatChange,

  SubmitTransaction: async (context, chainId, chamber, event, block) => {
    await refreshProposal(context, chainId, chamber, big(event.args.nonce), block, {
      proposerTokenId: big(event.args.tokenId),
      target: addr(event.args.to),
      value: big(event.args.value),
      data: event.args.data as Hex,
      submittedBlock: block.number,
      submittedAt: block.timestamp,
      submittedTx: event.transaction.hash,
    });
    await refreshChamber(context, chainId, chamber, block);
  },
  TransactionDeadlineSet: byNonce,
  ProposalMetadataSet: byNonce,
  TransactionCancelled: byNonce,
  ConfirmTransaction: vote,
  RevokeConfirmation: vote,
  CancelTransaction: vote,
  // An executed proposal can call anything on the chamber (seats, upgrade,
  // transfers out), so refresh all chamber-level state.
  ExecuteTransaction: async (context, chainId, chamber, event, block) => {
    await refreshProposal(context, chainId, chamber, big(event.args.nonce), block, {
      executedTx: event.transaction.hash,
    });
    await refreshSeatState(context, chainId, chamber, block);
  },
  TransactionSubmitted: byTransactionId,
  TransactionConfirmed: byTransactionId,
  TransactionExecuted: byTransactionId,
  TransactionCancelVoted: byTransactionId,

  DirectorOperatorSet: (context, chainId, chamber, event, block) =>
    refreshOperator(
      context,
      chainId,
      chamber,
      big(event.args.tokenId),
      addr(event.args.owner),
      addr(event.args.operator),
      big(event.args.expiry),
      block,
    ),
};

/** JSON-safe copy of event args (bigint → decimal string). */
function jsonArgs(args: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

export function registerChamberHandlers(source: ChamberSource): void {
  // Ponder types each "<Contract>:<Event>" key separately; the handlers above
  // read args by name, so register them through a loose signature.
  const on = ponder.on.bind(ponder) as unknown as (
    name: string,
    fn: (input: { event: AnyEvent; context: Ctx }) => Promise<void>,
  ) => void;

  for (const [name, handler] of Object.entries(HANDLERS)) {
    on(`${source}:${name}`, async ({ event, context }) => {
      const chainId = context.network.chainId;
      const chamber = asHex(event.log.address);
      const block: BlockRef = {
        number: event.block.number,
        timestamp: event.block.timestamp,
      };
      await context.db.insert(chamberEvent).values({
        chainId,
        id: event.log.id,
        chamberId: chamber,
        name,
        args: jsonArgs(event.args),
        blockNumber: block.number,
        timestamp: block.timestamp,
        txHash: event.transaction.hash,
        logIndex: event.log.logIndex,
      });
      if (handler) await handler(context, chainId, chamber, event, block);
    });
  }
}
