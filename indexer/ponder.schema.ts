import { index, onchainEnum, onchainTable, primaryKey, relations } from "ponder";

/**
 * The Chamber app reads display state from these tables instead of the chain.
 * State tables are snapshots: on each relevant event the indexer re-reads the
 * contract's own views at that block (src/lib/state.ts), so board ranking,
 * quorum and proposal status match what the contract enforces.
 *
 * Time-dependent checks (proposal expiry, seating maturity, session-key
 * liveness) are left to the client: compare the stored deadline / seatedAt /
 * liveAt with `_meta.status` block number and timestamp.
 */

export const chamberSource = onchainEnum("chamber_source", [
  "factory",
  "registry",
]);

/** Directory row plus current chamber-wide state. Nullable columns are views the deployed implementation may not have. */
export const chamber = onchainTable(
  "chamber",
  (t) => ({
    id: t.hex().primaryKey(),
    address: t.hex().notNull(),
    asset: t.hex().notNull(),
    nft: t.hex().notNull(),
    seats: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    creator: t.hex().notNull(),
    source: chamberSource().notNull(),
    createdBlock: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    decimals: t.integer(),
    totalAssets: t.bigint(),
    totalSupply: t.bigint(),
    ethBalance: t.bigint(),
    quorum: t.bigint(),
    boardSize: t.bigint(),
    reachableDirectors: t.bigint(),
    transactionCount: t.bigint(),
    paused: t.boolean(),
    implementation: t.hex(),
    version: t.text(),
    updatedBlock: t.bigint(),
    updatedAt: t.bigint(),
  }),
  (table) => ({
    creatorIdx: index().on(table.creator),
    sourceIdx: index().on(table.source),
    assetIdx: index().on(table.asset),
    nftIdx: index().on(table.nft),
  }),
);

/** Current share balance per account, reconstructed from ERC-20 Transfer. */
export const chamberHolder = onchainTable(
  "chamber_holder",
  (t) => ({
    chamberId: t.hex().notNull(),
    account: t.hex().notNull(),
    shares: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.account] }),
    accountIdx: index().on(table.account),
    chamberIdx: index().on(table.chamberId),
  }),
);

/** Ranked board node (every delegated tokenId, not only seated ones). `rank` < chamber.seats means in a top seat. */
export const boardSeat = onchainTable(
  "board_seat",
  (t) => ({
    chamberId: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    rank: t.integer().notNull(),
    amount: t.bigint().notNull(),
    /** NFT owner; null when ownerOf reverts (burned / unreachable). */
    owner: t.hex(),
    /** First block the token may act as director (getSeatedAt); null if the view is missing. */
    seatedAt: t.bigint(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.tokenId] }),
    chamberIdx: index().on(table.chamberId),
    ownerIdx: index().on(table.owner),
  }),
);

/** Current delegation from a share holder to a membership tokenId. */
export const delegation = onchainTable(
  "delegation",
  (t) => ({
    chamberId: t.hex().notNull(),
    holder: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    amount: t.bigint().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.holder, table.tokenId] }),
    chamberIdx: index().on(table.chamberId),
    holderIdx: index().on(table.holder),
  }),
);

/** Wallet transaction (proposal) state, re-read from the contract on every related event. */
export const proposal = onchainTable(
  "proposal",
  (t) => ({
    chamberId: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    proposerTokenId: t.bigint(),
    target: t.hex(),
    value: t.bigint(),
    data: t.hex(),
    dataHash: t.hex(),
    metadataURI: t.text(),
    deadline: t.bigint(),
    requiredQuorum: t.bigint(),
    confirmations: t.integer(),
    cancelConfirmations: t.integer(),
    executed: t.boolean().notNull(),
    cancelled: t.boolean().notNull(),
    submittedBlock: t.bigint(),
    submittedAt: t.bigint(),
    submittedTx: t.hex(),
    executedTx: t.hex(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.nonce] }),
    chamberIdx: index().on(table.chamberId),
  }),
);

/** Per-seat confirm / cancel flags for a proposal. */
export const proposalVote = onchainTable(
  "proposal_vote",
  (t) => ({
    chamberId: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    tokenId: t.bigint().notNull(),
    confirmed: t.boolean().notNull(),
    cancelVoted: t.boolean().notNull(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.nonce, table.tokenId] }),
    chamberNonceIdx: index().on(table.chamberId, table.nonce),
  }),
);

/** Active seat-count change proposal (getSeatUpdate). Row is kept with timestamp 0 when none is active. */
export const seatUpdate = onchainTable("seat_update", (t) => ({
  chamberId: t.hex().primaryKey(),
  proposedSeats: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  requiredQuorum: t.bigint().notNull(),
  supporters: t.bigint().array().notNull(),
  updatedBlock: t.bigint().notNull(),
}));

/** Session-key operator per membership tokenId. */
export const directorOperator = onchainTable(
  "director_operator",
  (t) => ({
    chamberId: t.hex().notNull(),
    tokenId: t.bigint().notNull(),
    owner: t.hex().notNull(),
    operator: t.hex().notNull(),
    expiry: t.bigint().notNull(),
    scope: t.bigint(),
    liveAt: t.bigint(),
    updatedBlock: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chamberId, table.tokenId] }),
    operatorIdx: index().on(table.operator),
  }),
);

/** Every Chamber event, for activity feeds and history. `args` is JSON with bigints as strings. */
export const chamberEvent = onchainTable(
  "chamber_event",
  (t) => ({
    id: t.text().primaryKey(),
    chamberId: t.hex().notNull(),
    name: t.text().notNull(),
    args: t.json().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    chamberIdx: index().on(table.chamberId),
    nameIdx: index().on(table.name),
    blockIdx: index().on(table.blockNumber),
  }),
);

export const chamberRelations = relations(chamber, ({ many, one }) => ({
  holders: many(chamberHolder),
  board: many(boardSeat),
  delegations: many(delegation),
  proposals: many(proposal),
  operators: many(directorOperator),
  events: many(chamberEvent),
  seatUpdate: one(seatUpdate, {
    fields: [chamber.id],
    references: [seatUpdate.chamberId],
  }),
}));

export const chamberHolderRelations = relations(chamberHolder, ({ one }) => ({
  chamber: one(chamber, {
    fields: [chamberHolder.chamberId],
    references: [chamber.id],
  }),
}));

export const boardSeatRelations = relations(boardSeat, ({ one }) => ({
  chamber: one(chamber, { fields: [boardSeat.chamberId], references: [chamber.id] }),
}));

export const delegationRelations = relations(delegation, ({ one }) => ({
  chamber: one(chamber, { fields: [delegation.chamberId], references: [chamber.id] }),
}));

export const proposalRelations = relations(proposal, ({ one, many }) => ({
  chamber: one(chamber, { fields: [proposal.chamberId], references: [chamber.id] }),
  votes: many(proposalVote),
}));

export const proposalVoteRelations = relations(proposalVote, ({ one }) => ({
  proposal: one(proposal, {
    fields: [proposalVote.chamberId, proposalVote.nonce],
    references: [proposal.chamberId, proposal.nonce],
  }),
}));

export const directorOperatorRelations = relations(directorOperator, ({ one }) => ({
  chamber: one(chamber, { fields: [directorOperator.chamberId], references: [chamber.id] }),
}));

export const chamberEventRelations = relations(chamberEvent, ({ one }) => ({
  chamber: one(chamber, { fields: [chamberEvent.chamberId], references: [chamber.id] }),
}));

// Registry / Factory discovery events

export const registry_ChamberCreated = onchainTable(
  "chamber_created_event",
  (t) => ({
    id: t.text().primaryKey(),
    chamber: t.text().notNull(),
    seats: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    erc20Token: t.text().notNull(),
    erc721Token: t.text().notNull(),
  }),
  (table) => ({
    chamberIdx: index().on(table.chamber),
  }),
);
export const factory_ChamberCreated = onchainTable(
  "factory_chamber_created_event",
  (t) => ({
    id: t.text().primaryKey(),
    chamber: t.hex().notNull(),
    asset: t.hex().notNull(),
    nft: t.hex().notNull(),
    seats: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    creator: t.hex().notNull(),
  }),
  (table) => ({
    chamberIdx: index().on(table.chamber),
    creatorIdx: index().on(table.creator),
  }),
);

export const registry_Initialized = onchainTable(
  "initialized_event",
  (t) => ({
    id: t.text().primaryKey(),
    version: t.bigint().notNull(),
  }),
);

export const registry_RoleAdminChanged = onchainTable(
  "role_admin_changed_event",
  (t) => ({
    id: t.text().primaryKey(),
    role: t.text().notNull(),
    previousAdminRole: t.text().notNull(),
    newAdminRole: t.text().notNull(),
  }),
  (table) => ({
    roleIdx: index().on(table.role),
  }),
);

export const registry_RoleGranted = onchainTable(
  "role_granted_event",
  (t) => ({
    id: t.text().primaryKey(),
    role: t.text().notNull(),
    account: t.text().notNull(),
    sender: t.text().notNull(),
  }),
  (table) => ({
    roleIdx: index().on(table.role),
    accountIdx: index().on(table.account),
  }),
);

export const registry_RoleRevoked = onchainTable(
  "role_revoked_event",
  (t) => ({
    id: t.text().primaryKey(),
    role: t.text().notNull(),
    account: t.text().notNull(),
    sender: t.text().notNull(),
  }),
  (table) => ({
    roleIdx: index().on(table.role),
    accountIdx: index().on(table.account),
  }),
);

