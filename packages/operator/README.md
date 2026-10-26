# `@loreum/chamber-operator`

A typed library and CLI that let a script or agent run a Chamber board: read the board, delegate, and submit, confirm, revoke, cancel and execute queued transactions. It calls the same contract functions as the React app and reports reverts with the same messages.

## Actions

| Action | Chamber function |
| --- | --- |
| Read board and quorum | `getTop`, `getSeats`, `getQuorum`, `getDirectors`, `getSeatedAt`, `paused` |
| Read a queued transaction | `getTransaction`, `getTransactionDeadline`, `getTransactionRequiredQuorum`, `getCancelled` |
| Delegate | `delegate` |
| Undelegate | `undelegate` |
| Submit | `submitTransaction(tokenId, target, value, data, metadataURI, deadline)` |
| Confirm | `confirmTransaction` |
| Revoke confirmation | `revokeConfirmation` |
| Cancel queued tx | `cancelTransaction` |
| Execute | `executeTransaction` |

Submitting also records the submitter's confirmation. `metadataURI` defaults to `""` (none) and `deadline` to `0` (the 30-day default).

Reverts are reported with the app's messages:

| Revert | Message |
| --- | --- |
| `DirectorNotSeated` | Your seat is not mature yet |
| `EnforcedPause` | This chamber is paused |
| `TransactionExpired` | This transaction has expired |
| `NotDirector` | You are not a director |

## How an agent acts for a director

Chamber only checks `ownerOf(tokenId)`. Whoever signs as the owner of the membership NFT is the director, and the contract has no separate delegation of director rights. An agent can act for a director in two ways:

- **Sign with the owner's key.** Give the agent the private key of the EOA that owns the NFT.
- **Own the NFT with a smart account.** Move the NFT to a smart account (an ERC-4337 or ERC-7579 account, or a Safe), and give the agent a limited session key or module on that account. The account enforces the limits, such as which functions the agent may call, spending caps and expiry. Pass the account's client as the signer:

```ts
const op = await createOperator({
  rpcUrl,
  chamber,
  signer: { type: 'walletClient', walletClient: smartAccountClient },
})
```

The package does not include a bundler or paymaster. Any viem `WalletClient` whose `writeContract` sends a user operation will work.

## Library

```ts
import { createOperator } from '@loreum/chamber-operator'

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
  metadataURI: 'ipfs://…', // optional, default ""
  // deadline: 1893456000n,  // optional, default 0n = 30 days
})
await op.confirm(2n, nonce)
await op.execute(1n, nonce, '0x')

await op.undelegate(1n, 10n ** 18n)
await op.revokeConfirmation(2n, nonce)
await op.cancelTransaction(1n, nonce)
```

The signer can be a private key, a viem `Account`, or a prebuilt `WalletClient`.

## CLI

```bash
cd packages/operator && npm install

export CHAMBER_RPC=http://127.0.0.1:8545
export CHAMBER=0x…
export PRIVATE_KEY=0x…

npx chamber-operator board --rpc "$CHAMBER_RPC" --chamber "$CHAMBER"
npx chamber-operator quorum --rpc "$CHAMBER_RPC" --chamber "$CHAMBER"
npx chamber-operator tx --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --nonce 0
npx chamber-operator delegate --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --amount 1ether
npx chamber-operator undelegate --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --amount 1ether
npx chamber-operator submit --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --target 0x… --value 0 --data 0x --metadata ipfs://…
npx chamber-operator confirm --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 2 --nonce 0
npx chamber-operator revoke --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 2 --nonce 0
npx chamber-operator cancel --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --nonce 0
npx chamber-operator execute --rpc "$CHAMBER_RPC" --chamber "$CHAMBER" --key "$PRIVATE_KEY" \
  --token-id 1 --nonce 0 --data 0x
```

### Networks

`--network` picks one of the four testnets and its public RPC: `sepolia`, `base-sepolia`, `arbitrum-sepolia` or `op-sepolia`. Add `--rpc` to use your own node on that network.

```bash
npx chamber-operator board --network arbitrum-sepolia --chamber 0x…
```

In the library, pass `rpcUrl` and `chain` from `NETWORKS['op-sepolia']`.

The CLI signs only with a private key. To use a smart-account signer, call the library.

## Anvil end-to-end

Requires Foundry (`anvil`, `forge`). From `packages/operator`:

```bash
npm install
npm run example:anvil
```

The script starts Anvil if needed, deploys the contracts and creates a 3-seat chamber. It then delegates from two directors, shows that a submit before the seating delay fails, and runs submit, confirm, revoke, cancel and execute. It also checks the expired, not-a-director and paused error messages.
