# chamber-indexer

One Ponder process indexes every testnet that has a deployed Factory. Package root: `indexer/` in [loreum-org/chamber](https://github.com/loreum-org/chamber). The Vite app does not build or serve this package. It reads this GraphQL API when `VITE_INDEXER_URL` is set, and calls the chain directly only to check parameters and send a transaction.

## State tables

On each Chamber event the indexer re-reads the chamber's own views at that block (`src/lib/state.ts`, through Multicall3) and upserts current state. Board ranking, quorum and proposal status therefore match the contract instead of being re-derived in TypeScript. Views missing from older implementations are stored as `null`.

Every table includes `chainId`, and every primary key starts with it. The Factory is CREATE2, so the same address on two chains is two rows. `chainId` is `context.network.chainId`.

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

Time-based checks (proposal expiry, seating maturity, session-key liveness) are left to the client: compare stored `deadline` / `seatedAt` / `liveAt` with the head from `_meta { status }` for that chain's network. See `src/chamber.graphql` for the queries the app uses.

`abis/ChamberAbi.ts` is generated from this repo's `contracts/` forge build; regenerate it when the contract events or views change.

## What it indexes

Factory address and Factory start block are read from `contracts/deployments/<network>.txt`. An indexer-only checkout uses the staged copy in `indexer/.deployment/` (`scripts/stage-deployment.mjs` fetches every `contracts/deployments/*.txt`).

| Chain id | Network | Ponder name | Deployment file |
| --- | --- | --- | --- |
| 84532 | Base Sepolia | `baseSepolia` | `base-sepolia.txt` |
| 421614 | Arbitrum Sepolia | `arbitrumSepolia` | `arbitrum-sepolia.txt` |
| 11155420 | OP Sepolia | `opSepolia` | `op-sepolia.txt` |
| 11155111 | Ethereum Sepolia | `sepolia` | `sepolia.txt` |

A chain is added to each contract only when that file has the address the contract needs. A file that says "Not deployed yet" is skipped. Appending a `Factory` line and a `Factory start block` (what `make deploy-testnet` does) includes that chain on the next start, with no indexer code change.

Ethereum Sepolia is indexed only after a 1.3.0 Factory is recorded. The Aug 26, 2026 Factory `0x43aA92c8A26392f21F63cdA88B6BaB5031C40550` is ignored. Mainnet is not in the chain table.

With the deployment files in the repo today, the process indexes Base Sepolia only.

A chain with a Factory and no Registry still registers Registry, Chamber, and RegistryNft against `0x000000000000000000000000000000000000dEaD` from the Factory start block, so those handlers stay loaded and the backfill stays empty. A `Registry (proxy)` line in the file replaces the placeholder.

Each Factory chamber's membership NFT is indexed (`FactoryNft`): directors change on ERC-721 transfer with no Chamber event.

## RPC

Set `PONDER_RPC_URL_<chainId>` to a dedicated Alchemy (or other) HTTPS URL for each chain that has a Factory. The URL for a skipped chain is not opened.

Do not use an origin-locked frontend key (`VITE_*` / browser Alchemy apps).

| Variable | Chain |
| --- | --- |
| `PONDER_RPC_URL_84532` | Base Sepolia (`base-sepolia`) |
| `PONDER_RPC_URL_421614` | Arbitrum Sepolia |
| `PONDER_RPC_URL_11155420` | OP Sepolia |
| `PONDER_RPC_URL_11155111` | Ethereum Sepolia, once a 1.3.0 Factory is in `sepolia.txt` |

A public RPC for a Base Sepolia smoke check, not production load: `https://sepolia.base.org`.

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

`railway.toml` runs `node scripts/stage-deployment.mjs` before start. A full checkout reads `../contracts/deployments/*.txt`. With the root directory set to `indexer`, that sibling directory is not in the checkout, so the script loads the same files from this git commit into `indexer/.deployment/` (not committed).

### Railway environment

Postgres in production (`DATABASE_URL`). `ponder dev` can leave it unset and use the local PGlite database. `ponder start` also needs `DATABASE_SCHEMA` (Ponder 0.8).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SCHEMA` | Ponder schema name, for example `public` |
| `PONDER_RPC_URL_84532` | Base Sepolia HTTPS RPC. Keep this set. |
| `PONDER_RPC_URL_421614` | Arbitrum Sepolia HTTPS RPC. Safe to set before that Factory exists. |
| `PONDER_RPC_URL_11155420` | OP Sepolia HTTPS RPC. Safe to set before that Factory exists. |
| `PONDER_RPC_URL_11155111` | Ethereum Sepolia HTTPS RPC. Used once `sepolia.txt` has a 1.3.0 Factory. |

The app uses one indexer URL for every indexed chain. On the app service set `VITE_INDEXER_URL` and `VITE_INDEXER_CHAIN_IDS` to the chain ids this process actually indexes (today `84532`). Add `421614` and `11155420` after those deployment files contain a Factory. `VITE_INDEXER_CHAIN_ID` still works as a single-id fallback.

Per-chain overrides, all optional:

| Variable | When unset |
| --- | --- |
| `PONDER_FACTORY_ADDRESS_<chainId>` | `Factory` in that chain's deployment file |
| `PONDER_FACTORY_START_BLOCK_<chainId>` | `Factory start block` in that file |
| `PONDER_REGISTRY_ADDRESS_<chainId>` | `Registry (proxy)` in that file, or the placeholder when the file has none |
| `PONDER_REGISTRY_START_BLOCK_<chainId>` | `Registry start block`, or the Factory start block |

Unscoped `PONDER_FACTORY_ADDRESS` and `PONDER_REGISTRY_ADDRESS` are not read.

## Reindex

Primary keys changed from address-only to `(chainId, …)`. Ponder will not migrate that in place. After this deploy, drop the Ponder Postgres schema (or the volume) and restart so historical intervals rebuild. `_meta.status.<network>.ready` is true per network when that chain has caught up.

Adding a Factory or moving its start block also creates new filters. Rebuild historical intervals on that deploy.

## Acceptance (after reindex)

```graphql
{
  chambers { totalCount }
  registry_ChamberCreateds { totalCount }
  factory_ChamberCreateds { totalCount }
  _meta { status }
}
```

| Field | Expected with today's deployment files |
| --- | --- |
| `registry_ChamberCreateds.totalCount` | `0` until a Registry is deployed on an indexed chain |
| `factory_ChamberCreateds.totalCount` | `0` until someone calls `createChamber` on an indexed Factory |
| `_meta.status.baseSepolia.ready` | `true` |
| `_meta.status.arbitrumSepolia` | absent until `arbitrum-sepolia.txt` has a Factory |
| `_meta.status.opSepolia` | absent until `op-sepolia.txt` has a Factory |
| `_meta.status.sepolia` | absent until `sepolia.txt` has a 1.3.0 Factory |

Queries filter with `chainId`. The same chamber address on two chains is two `chamber` rows.

## Local

```bash
cd indexer
cp .env.example .env.local   # set PONDER_RPC_URL_84532
pnpm install
pnpm test
pnpm check-deployment
pnpm dev                     # or: pnpm start --schema local
```

`ponder start` requires `--schema` or `DATABASE_SCHEMA` (Ponder 0.8). Production already sets this.

`GET /health` and `GET /ready` are Ponder’s process probes (200 with an empty body). Use GraphQL `_meta.status.<network>.ready` for sync.

## Out of scope

- The Vite app does not import this package. It uses one `VITE_INDEXER_URL` and `VITE_INDEXER_CHAIN_IDS`. Chains absent from that list fall back to chunked `getLogs`.
- Mainnet.
- Landing copy.
