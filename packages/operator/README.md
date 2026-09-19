# `@loreum/chamber-operator`

Typed operator surface for Chamber. Agents cannot click `TransactionQueue`; this package calls the same functions the React app already uses, through `contracts/generated-abis.ts` plus the PMN-M04 session-key fragments.

Implements [loreum-org/chamber#146](https://github.com/loreum-org/chamber/issues/146) (board / queue) and [loreum-org/chamber#253](https://github.com/loreum-org/chamber/issues/253) (M04 4-arg session-key director operator).

## What it does

Given RPC + a signer + a chamber address:

| Action | Chamber function |
| --- | --- |
| Read board + quorum | `getTop`, `getSeats`, `getQuorum`, `getReachableDirectorCount`, `getDirectors`, `getSeatedAt`, `paused` |
| Read session key | `getDirectorOperator`, `getDirectorOperatorScope`, `getDirectorOperatorLiveAt`, `getDirectorSession` |
| Delegate | `delegate` |
| Undelegate | `undelegate` |
| Submit | `submitTransaction` |
| Confirm | `confirmTransaction` |
| Revoke confirmation | `revokeConfirmation` |
| Cancel queued tx | `cancelTransaction` |
| Execute | `executeTransaction` |
| Set / clear session key | `setDirectorOperator(tokenId, operator, expiry, scope)` — clear with `(address(0), 0, 0)` |

Signer is a private key, a viem `Account`, or a prebuilt `WalletClient` (including a 4337 smart-account client whose `writeContract` submits a user operation). This package does not ship a bundler or paymaster.

Failures decode to the same copy the app already shows:

| Revert | App copy |
| --- | --- |
| `DirectorNotSeated` | Your seat is not mature yet |
| `EnforcedPause` | This chamber is paused |
| `TransactionExpired` | This transaction has expired |
| `NotDirector` | You are not a director |
| `InvalidSessionExpiry` | Session expiry must be a future unix timestamp (0 is rejected) |
| `InvalidSessionScope` | Session scope 0 is rejected; use SESSION_SCOPE_UNSCOPED for full access |

## Library

```ts
import {
  createOperator,
  defaultSessionExpiry,
  SESSION_SCOPE_UNSCOPED,
} from '@loreum/chamber-operator'

const op = await createOperator({
  rpcUrl: process.env.RPC_URL!,
  chamber: '0x…',
  signer: { type: 'privateKey', privateKey: process.env.PRIVATE_KEY as `0x${string}` },
})

const board = await op.getBoard()
await op.delegate(1n, 10n ** 18n)
const { nonce } = await op.submitTransaction({
  tokenId: 1n,
  target: '0x…',
  value: 0n,
  data: '0x',
})
await op.confirm(2n, nonce)
await op.execute(1n, nonce, '0x')

await op.undelegate(1n, 10n ** 18n)
await op.revokeConfirmation(2n, nonce)
await op.cancelTransaction(1n, nonce)

const live = await op.getDirectorOperatorState(1n)
// live.operator / live.expiry / live.scope / live.liveAt / live.status
await op.setDirectorOperator(1n, '0x…') // defaults: 30-day expiry, SESSION_SCOPE_UNSCOPED
await op.setDirectorOperator(1n, '0x…', defaultSessionExpiry(), SESSION_SCOPE_UNSCOPED)
await op.clearDirectorOperator(1n) // setDirectorOperator(tokenId, address(0), 0, 0)
```

`setDirectorOperator` / `clearDirectorOperator` must be sent by the current NFT owner, and that owner must be a **contract**. EOA-owned membership NFTs are rejected by the protocol (`NotDirector` / `You are not a director`). There is **no ERC-1271 fallback** — Chamber never calls `isValidSignature`. Use a 4337 / smart-account `walletClient` whose address is the contract owner (see below).

Defaults and M04 rules:

- **expiry** defaults to now + 30 days. `expiry == 0` is rejected (not a no-expiry sentinel).
- **scope** defaults to `SESSION_SCOPE_UNSCOPED` (`type(uint32).max` / `0xffffffff`). Scope `0` is rejected.
- After a set, **confirm/execute wait until `liveAt`** (`SEATING_DELAY` after the set block). Submit is not delayed. Refreshing the key restarts `liveAt`. The owner may clear immediately, including during that delay.
- Reads return `address(0)` / `0` when the key is unset, stale after transfer, expired, or the owner is an EOA. Use `getDirectorSession` for raw leftovers; `getDirectorOperatorState` is the live snapshot.

4337 signer:

```ts
const op = await createOperator({
  rpcUrl,
  chamber,
  signer: { type: 'walletClient', walletClient: smartAccountClient },
})
```

## CLI

```bash
cd packages/operator && npm install

export CHAMBER_RPC=http://127.0.0.1:8545
export CHAMBER=0x…
export PRIVATE_KEY=0x…

npx chamber-operator board --rpc "$CHAMBER_RPC" --chamber "$CHAMBER"
npx chamber-operator quorum --rpc "$CHAMBER_RPC" --chamber "$CHAMBER"
npx chamber-operator operator --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --token-id 1
npx chamber-operator set-operator --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --operator 0x…
npx chamber-operator set-operator --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --operator 0x… --expiry 1893456000 --scope unscoped
npx chamber-operator clear-operator --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1
npx chamber-operator delegate --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --amount 1ether
npx chamber-operator undelegate --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --amount 1ether
npx chamber-operator submit --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --target 0x… --value 0 --data 0x
npx chamber-operator confirm --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 2 --nonce 0
npx chamber-operator revoke --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 2 --nonce 0
npx chamber-operator cancel --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --nonce 0
npx chamber-operator execute --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --nonce 0 --data 0x
```

`operator` is a read (no key). It prints live `operator`, `expiry`, `scope`, `liveAt`, and `status` (`none` / `active` / `delayed` / `expired` / `stale`). `set-operator` / `clear-operator` use the same signer as `delegate`. A CLI private key is an EOA, so those writes revert unless you wrap a contract-wallet signer via the library API. That revert is protocol behavior, not a 1271 workaround.

`--expiry` is a future unix timestamp (default: now + 30 days). `--scope` is a uint32 bitmask, hex, or `unscoped` (default: `0xffffffff`). Confirm/execute stay blocked until `liveAt`.

## Anvil end-to-end

Requires Foundry (`anvil`, `forge`). From `packages/operator`:

```bash
npm install
npm run example:anvil
```

That script starts Anvil if needed, runs `DeployAllAnvil`, creates a 3-seat chamber, then:

1. Reads `getDirectorOperatorState` (unset) and shows EOA `setDirectorOperator` → `You are not a director`
2. Contract-wallet owner 4-arg `setDirectorOperator` / CLI `operator` read / `clearDirectorOperator`
3. Delegates from two directors and shows a pending board
4. `submit` before the seating delay → `Your seat is not mature yet`
5. Mines one block (`SEATING_DELAY = 1`)
6. `submit` → `confirm` → `execute`
7. A third key `confirm` → `You are not a director`
8. A short-deadline nonce after `evm_increaseTime` → `This transaction has expired`
9. Board `pause()` then `execute` → `This chamber is paused`

## Out of scope

Sensor Hub, Agent Hub, a new subgraph, and a production agent runtime. No new Solidity. No React app.