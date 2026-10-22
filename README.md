# chamber-indexer

Ponder indexer for [loreum-org/chamber](https://github.com/loreum-org/chamber) on Base Sepolia (chain 84532). The Chamber app reads display state from this GraphQL API; it calls the chain directly only to check parameters and send a transaction.

## State tables

On each Chamber event the indexer re-reads the chamber's own views at that block (`src/lib/state.ts`, through Multicall3) and upserts current state. Board ranking, quorum and proposal status therefore match the contract instead of being re-derived in TypeScript. Views missing from older implementations are stored as `null`.

| Table | Refreshed on | Source views |
| --- | --- | --- |
| `chamber` | vault, seat, proposal submit/execute, pause, upgrade events | `totalAssets`, `totalSupply`, `getQuorum`, `getSeats`, `getSize`, `getReachableDirectorCount`, `getTransactionCount`, `paused`, `VERSION`, ETH balance, ERC-1967 slot |
| `boardSeat` | Delegate / Undelegate, seat events, executed proposals, membership NFT Transfer of a board tokenId | `getTop(getSize())`, `ownerOf`, `getSeatedAt` |
| `delegation` | DelegationUpdated, Delegate, Undelegate | event amount / `getHolderDelegation` |
| `proposal` | submit, deadline, metadata, confirm, revoke, cancel, execute | `getTransaction`, `getCancelled`, `getCancelConfirmations`, `getTransactionDeadline`, `getTransactionRequiredQuorum`, `getTransactionMetadata`, `getTransactionCalldata` (falls back to SubmitTransaction `data`) |
| `proposalVote` | ConfirmTransaction, RevokeConfirmation, CancelTransaction | `getConfirmation`, `getCancelConfirmation` |
| `seatUpdate` | SetSeats, ExecuteSetSeats, SeatUpdateCancelled, SeatsRecovered, InertSeatCleaned, executed proposals | `getSeatUpdate` |
| `directorOperator` | DirectorOperatorSet | event + `getDirectorOperatorScope`, `getDirectorOperatorLiveAt` |
| `chamberHolder` | share Transfer | event |
| `chamberEvent` | every Chamber event | event args as JSON |

Time-based checks (proposal expiry, seating maturity, session-key liveness) are left to the client: compare stored `deadline` / `seatedAt` / `liveAt` with the head from `_meta { status }`. See `src/chamber.graphql` for the queries the app uses.

`abis/ChamberAbi.ts` is generated from the chamber repo's forge build; regenerate it when the contract events or views change.

## What it indexes

Defaults match `contracts/deployments/base-sepolia.txt` in loreum-org/chamber (chain 84532). Ethereum Sepolia stays in that repo's `sepolia.txt` and is not indexed here.

| Source | Address | Start block | Why |
| --- | --- | --- | --- |
| Factory (Oct 22, 2026) | `0x9bd245B992f0ba869D208bdABecB608080984701` | `48743114` | Verified Base Sepolia Factory. Chamber implementation `0xC6e817C021D4fADA5Ed27B62112991ec48522E90`. |
| Registry | none on this deploy | `48743114` | Handlers still require a Registry source. The default address is not a registry, so those tables stay empty until `PONDER_REGISTRY_*` is set. |

Each Factory chamber's membership NFT is indexed (`FactoryNft`): directors change on ERC-721 transfer with no Chamber event.

## RPC (required for a non-empty directory)

**Set `PONDER_RPC_URL_84532` to a dedicated Alchemy Base Sepolia HTTPS URL** (dashboard network `base-sepolia`).

Do not use an origin-locked frontend key (`VITE_*` / browser Alchemy apps).

A public RPC for a smoke check, not production load: `https://sepolia.base.org`.

**RPC cost:** state refreshes add a few `eth_call`s (one Multicall3 batch) per indexed event, made once by the indexer rather than by every open browser tab. Ponder caches them, so a re-sync against a warm cache does not repeat them.

## Railway (production)

Service: `chamber-indexer` on Loreum.org. Host: `https://chamber-indexer-production.up.railway.app`.

After this config is deployed, a human must set (values except the RPC secret). This schema adds tables, so the deploy re-syncs from the start blocks.

| Variable | Value |
| --- | --- |
| `PONDER_RPC_URL_84532` | Dedicated Alchemy Base Sepolia HTTPS URL (secret) |

Address/start defaults are in `ponder.config.ts`. Override only if you intend a different source:

| Variable | Default (no need to set) |
| --- | --- |
| `PONDER_FACTORY_ADDRESS` | `0x9bd245B992f0ba869D208bdABecB608080984701` |
| `PONDER_FACTORY_START_BLOCK` | `48743114` |
| `PONDER_REGISTRY_ADDRESS` | unset — code uses `0x000000000000000000000000000000000000dEaD`, not a registry |
| `PONDER_REGISTRY_START_BLOCK` | `48743114` |

Changing Factory address or start block creates new Ponder filters, so historical intervals should rebuild on deploy. If `_meta.status.baseSepolia.ready` is true and Factory chambers are still missing, drop the Ponder Postgres schema (or the volume) and restart. The previous Ethereum Sepolia backfill is a different chain.

## Acceptance (after reindex)

```graphql
{
  chambers { totalCount }
  registry_ChamberCreateds { totalCount }
  factory_ChamberCreateds { totalCount }
  _meta { status }
}
```

| Field | Expected |
| --- | --- |
| `registry_ChamberCreateds.totalCount` | `0` until a Registry is deployed on Base Sepolia |
| `factory_ChamberCreateds.totalCount` | `0` until someone calls `createChamber` on this Factory |
| `_meta.status.baseSepolia.ready` | `true` |

## Local

```bash
cp .env.example .env.local   # set PONDER_RPC_URL_84532
pnpm install
pnpm dev                     # or: pnpm start --schema local
```

`ponder start` requires `--schema` or `DATABASE_SCHEMA` (Ponder 0.8). Production already sets this.

`GET /health` and `GET /ready` are Ponder’s process probes (200 with an empty body). Use GraphQL `_meta.status.baseSepolia.ready` for sync.

## Out of scope

- Wiring loreum-org/chamber to this host (chamber#144 / draft #151).
- Landing copy (chamber#158).
