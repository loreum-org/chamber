# chamber-indexer

Ponder indexer for Chamber on Base Sepolia (chain 84532). Package root: `indexer/` in [loreum-org/chamber](https://github.com/loreum-org/chamber). The Vite app does not build or serve this package. It reads this GraphQL API when `VITE_INDEXER_URL` is set, and calls the chain directly only to check parameters and send a transaction.

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

`abis/ChamberAbi.ts` is generated from this repo's `contracts/` forge build; regenerate it when the contract events or views change.

## What it indexes

Factory address and Factory start block are read from [`contracts/deployments/base-sepolia.txt`](../contracts/deployments/base-sepolia.txt). That file is the only copy. Ethereum Sepolia stays in `contracts/deployments/sepolia.txt` and is not indexed here.

| Source | Address | Start block | Why |
| --- | --- | --- | --- |
| Factory | `Factory` in `base-sepolia.txt` | `Factory start block` in that file | Verified Base Sepolia Factory deploy. |
| Registry | none on this deploy | same Factory start block | Handlers still require a Registry source. The default address is not a registry, so those tables stay empty until `PONDER_REGISTRY_*` is set. |

Each Factory chamber's membership NFT is indexed (`FactoryNft`): directors change on ERC-721 transfer with no Chamber event.

## RPC (required for a non-empty directory)

**Set `PONDER_RPC_URL_84532` to a dedicated Alchemy Base Sepolia HTTPS URL** (dashboard network `base-sepolia`).

Do not use an origin-locked frontend key (`VITE_*` / browser Alchemy apps).

A public RPC for a smoke check, not production load: `https://sepolia.base.org`.

**RPC cost:** state refreshes add a few `eth_call`s (one Multicall3 batch) per indexed event, made once by the indexer rather than by every open browser tab. Ponder caches them, so a re-sync against a warm cache does not repeat them.

## Host

Package root is `indexer/`. Ponder is its own deploy. Do not fold it into the Vite app.

Railway service `chamber-indexer` on Loreum.org. Host: `https://chamber-indexer-production.up.railway.app`.

| Setting | Value |
| --- | --- |
| Repository | `loreum-org/chamber` |
| Root directory | `indexer` |
| Config | `indexer/railway.toml` |
| Start | `pnpm start` |
| `PONDER_RPC_URL_84532` | Dedicated Alchemy Base Sepolia HTTPS URL (secret). Keep this set. |

`railway.toml` runs `node scripts/stage-deployment.mjs` before start. A full checkout reads `../contracts/deployments/base-sepolia.txt`. With the root directory set to `indexer`, that sibling directory is not in the checkout, so the script loads the same file from this git commit into `indexer/.deployment/` (not committed).

Override the deployment record only if you intend a different source:

| Variable | When unset |
| --- | --- |
| `PONDER_FACTORY_ADDRESS` | `Factory` in `contracts/deployments/base-sepolia.txt` |
| `PONDER_FACTORY_START_BLOCK` | `Factory start block` in that file |
| `PONDER_REGISTRY_ADDRESS` | `0x000000000000000000000000000000000000dEaD`, not a registry |
| `PONDER_REGISTRY_START_BLOCK` | Factory start block from that file |

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
cd indexer
cp .env.example .env.local   # set PONDER_RPC_URL_84532
pnpm install
pnpm check-deployment
pnpm dev                     # or: pnpm start --schema local
```

`ponder start` requires `--schema` or `DATABASE_SCHEMA` (Ponder 0.8). Production already sets this.

`GET /health` and `GET /ready` are Ponder’s process probes (200 with an empty body). Use GraphQL `_meta.status.baseSepolia.ready` for sync.

## Out of scope

- The Vite app does not import this package. It uses `VITE_INDEXER_URL` and falls back to chunked `getLogs`.
- Landing copy.
