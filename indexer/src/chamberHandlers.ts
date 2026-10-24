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

type Handler = (context: Ctx, chamber: Address, event: AnyEvent, block: BlockRef) => Promise<void>;

const big = (v: unknown) => v as bigint;
const addr = (v: unknown) => asHex(v as string);

async function refreshBoardState(context: Ctx, chamber: Address, block: BlockRef) {
  await refreshBoard(context, chamber, block);
  await refreshChamber(context, chamber, block);
}

async function refreshSeatState(context: Ctx, chamber: Address, block: BlockRef) {
  await refreshSeatUpdate(context, chamber, block);
  await refreshBoardState(context, chamber, block);
}

const byNonce: Handler = (context, chamber, event, block) =>
  refreshProposal(context, chamber, big(event.args.nonce), block);

const byTransactionId: Handler = (context, chamber, event, block) =>
  refreshProposal(context, chamber, big(event.args.transactionId), block);

const vote: Handler = async (context, chamber, event, block) => {
  const nonce = big(event.args.nonce);
  await refreshVote(context, chamber, nonce, big(event.args.tokenId), block);
  await refreshProposal(context, chamber, nonce, block);
};

const seatChange: Handler = (context, chamber, _event, block) =>
  refreshSeatState(context, chamber, block);

const chamberOnly: Handler = (context, chamber, _event, block) =>
  refreshChamber(context, chamber, block);

const HANDLERS: Record<string, Handler | null> = {
  Approval: null,
  Transfer: async (context, chamber, event, block) => {
    await applyShareTransfer(
      context.db,
      chamber,
      addr(event.args.from),
      addr(event.args.to),
      big(event.args.value),
    );
    await refreshChamber(context, chamber, block);
  },
  Deposit: chamberOnly,
  Withdraw: chamberOnly,
  Received: chamberOnly,
  ReceivedERC721: null,
  Paused: chamberOnly,
  Unpaused: chamberOnly,
  Initialized: chamberOnly,
  Upgraded: chamberOnly,

  Delegate: async (context, chamber, event, block) => {
    await refreshDelegation(context, chamber, addr(event.args.sender), big(event.args.tokenId), block);
    await refreshBoardState(context, chamber, block);
  },
  Undelegate: async (context, chamber, event, block) => {
    await refreshDelegation(context, chamber, addr(event.args.sender), big(event.args.tokenId), block);
    await refreshBoardState(context, chamber, block);
  },
  DelegationUpdated: (context, chamber, event, block) =>
    refreshDelegation(
      context,
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

  SubmitTransaction: async (context, chamber, event, block) => {
    await refreshProposal(context, chamber, big(event.args.nonce), block, {
      proposerTokenId: big(event.args.tokenId),
      target: addr(event.args.to),
      value: big(event.args.value),
      data: event.args.data as Hex,
      submittedBlock: block.number,
      submittedAt: block.timestamp,
      submittedTx: event.transaction.hash,
    });
    await refreshChamber(context, chamber, block);
  },
  TransactionDeadlineSet: byNonce,
  ProposalMetadataSet: byNonce,
  TransactionCancelled: byNonce,
  ConfirmTransaction: vote,
  RevokeConfirmation: vote,
  CancelTransaction: vote,
  // An executed proposal can call anything on the chamber (seats, upgrade,
  // transfers out), so refresh all chamber-level state.
  ExecuteTransaction: async (context, chamber, event, block) => {
    await refreshProposal(context, chamber, big(event.args.nonce), block, {
      executedTx: event.transaction.hash,
    });
    await refreshSeatState(context, chamber, block);
  },
  TransactionSubmitted: byTransactionId,
  TransactionConfirmed: byTransactionId,
  TransactionExecuted: byTransactionId,
  TransactionCancelVoted: byTransactionId,

  DirectorOperatorSet: (context, chamber, event, block) =>
    refreshOperator(
      context,
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
      const chamber = asHex(event.log.address);
      const block: BlockRef = {
        number: event.block.number,
        timestamp: event.block.timestamp,
      };
      await context.db.insert(chamberEvent).values({
        id: event.log.id,
        chamberId: chamber,
        name,
        args: jsonArgs(event.args),
        blockNumber: block.number,
        timestamp: block.timestamp,
        txHash: event.transaction.hash,
        logIndex: event.log.logIndex,
      });
      if (handler) await handler(context, chamber, event, block);
    });
  }
}
