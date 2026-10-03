# Chad broadcast runbook: Ethereum mainnet Factory + Chamber (M1)

Human-only package for deploying **Factory + Chamber implementation + BoardLib + WalletLib**, then `createChamber` for live LORE, then pasting verified addresses. Safe `transferOwnership` is **human-only**.

This document does **not** close [#188](https://github.com/loreum-org/chamber/issues/188). #188 stays open until Chad broadcasts, pastes verified chain-id-1 addresses, and wires app env.

Fork rehearsal (mechanics only, never broadcast): [`mainnet-lore-handoff-rehearsal.md`](./mainnet-lore-handoff-rehearsal.md).

## Agents stop here

Do **not**:

- set `MAINNET_DEPLOY_UNBLOCKED=1` for a live chain-id-1 send
- pass `--broadcast` against mainnet
- invent Factory / Chamber / BoardLib / WalletLib / Registry addresses
- copy Sepolia Factory `0x43aA92c8A26392f21F63cdA88B6BaB5031C40550` (or any Sepolia address) onto chain id 1
- execute Safe `transferOwnership`, CCA, or invent credentials
- use generic `make deploy` for this path (it is not gated)

Rehearsal, print, and verify-print are the agent ceiling. Remaining unchecked items in `deployments/mainnet.txt` are **Chad-only**.

## Current truth (on `main`)

Review blockers that the old checklist marked open are **merged**:

| Item | Issue | PR | Status |
| --- | --- | --- | --- |
| PMN-H01 seating-control bind | [#208](https://github.com/loreum-org/chamber/issues/208) | [#220](https://github.com/loreum-org/chamber/pull/220) | merged |
| PMN-M01 reachable quorum | [#209](https://github.com/loreum-org/chamber/issues/209) | [#223](https://github.com/loreum-org/chamber/pull/223) | merged |
| PMN-M02 inert seated NFTs | [#210](https://github.com/loreum-org/chamber/issues/210) | [#224](https://github.com/loreum-org/chamber/pull/224) | merged |
| PMN-M03 Factory-only create / impl probe | [#211](https://github.com/loreum-org/chamber/issues/211) | [#225](https://github.com/loreum-org/chamber/pull/225) | merged |
| PMN-M04 session-key expiry/scope | [#212](https://github.com/loreum-org/chamber/issues/212) | [#226](https://github.com/loreum-org/chamber/pull/226) | merged |
| 1.1.7 / 1.1.9 eviction hot-path | — | [#213](https://github.com/loreum-org/chamber/pull/213) | merged (`Chamber.VERSION` is `1.1.9`) |
| Halmos harness (not a full proof) | — | [#206](https://github.com/loreum-org/chamber/pull/206) | merged |
| Verified deploy package | [#188](https://github.com/loreum-org/chamber/issues/188) | [#214](https://github.com/loreum-org/chamber/pull/214) | merged; Factory fields still TBD |

PMN-M03 **C** (Factory owner is a Safe / timelock) is the constructor default: team Safe `0x5d45A213B2B6259F0b3c116a8907B56AB5E22095`. Do not invent a different owner.

Live tokens already on Ethereum (not Chamber / Factory):

| Token | Address |
| --- | --- |
| LORE (erc20) | `0x7756D245527F5f8925A537be509BF54feb2FdC99` |
| LoreumNFT Explorers | `0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15` |
| Team Safe (LORE owner / Factory admin) | `0x5d45A213B2B6259F0b3c116a8907B56AB5E22095` |

Sepolia is already deployed. Do not redeploy Sepolia as a substitute for mainnet.

## What this package is

| Piece | Path | Broadcast? |
| --- | --- | --- |
| Print commands | `make print-mainnet-factory-deploy` | No (refuses `--broadcast`) |
| Fork rehearsal (test) | `make rehearse-mainnet-lore-handoff` | No |
| Fork rehearsal (script) | `make rehearse-mainnet-lore-handoff-script` | No (reverts on `--broadcast`) |
| Factory + libs + impl | `script/DeployMainnetFactory.s.sol` | Gated: `MAINNET_DEPLOY_UNBLOCKED=1` (**Chad only**) |
| `createChamber` | `script/CreateMainnetLoreChamber.s.sol` | Same gate; needs `FACTORY` (**Chad only**) |
| Verify | `make verify-mainnet-factory` | No (Etherscan only; refuses TBD / Sepolia) |
| Receipt extract | `script/extract-mainnet-broadcast.sh` | No (prints labels; does not write the file as live) |
| Address template | `deployments/mainnet.txt` | TBD until a chain-id-1 receipt |

`DeployFactory.s.sol` remains the generic script (any chain). Use **DeployMainnetFactory** on Ethereum so libs are logged and Sepolia is refused. Do not invent a new Make broadcast target.

## Required env (do not commit)

| Variable | Role |
| --- | --- |
| `MAINNET_RPC_URL` | Preferred Ethereum RPC (`foundry.toml` `[rpc_endpoints].mainnet`). Fallback: `ETH_RPC_URL` |
| `ETHERSCAN_API_KEY` | `foundry.toml` `[etherscan].mainnet` |
| `--account` / keystore | Deployer (Foundry). Do not commit keys |
| `ADMIN` | Optional. Default: team Safe `0x5d45A213B2B6259F0b3c116a8907B56AB5E22095` |
| `FACTORY` | Required for create. From the Factory **broadcast receipt**, never Sepolia |
| `MAINNET_DEPLOY_UNBLOCKED` | Must be `1` to pass `--broadcast`. **Chad only.** Agents must not set this for a live send |

Do not commit RPC URLs or keys. Sepolia Factory `0x43aA92c8A26392f21F63cdA88B6BaB5031C40550` is **reference only**.

## Constructor / create args

### Factory

```
constructor(address implementation_, address admin)
```

- `implementation_`: Chamber implementation from the same deploy (over EIP-170; linked to BoardLib + WalletLib)
- `admin`: team Safe `0x5d45A213B2B6259F0b3c116a8907B56AB5E22095` (matches Sepolia Factory owner; PMN-M03 C)

Chamber implementation, BoardLib, and WalletLib have empty constructors.

### createChamber (after Factory exists)

Same args as `script/Chamber.s.sol` when `block.chainid == 1` and the fork rehearsal:

| Arg | Value |
| --- | --- |
| `erc20Token` | LORE `0x7756D245527F5f8925A537be509BF54feb2FdC99` |
| `erc721Token` | membership `0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15` |
| `seats` | `5` (quorum `1 + (n * 51) / 100` over reachable authorized directors; n=5 → 3) |
| `name` | `Chamber LORE` |
| `symbol` | `cLORE` |

`Factory.createChamber` uses `new TransparentUpgradeableProxy` (**CREATE**, no salt). The Chamber proxy address is the Factory’s next nonce. **Do not pre-commit it.** Record it from the create receipt, then (human) Safe-sign `LORE.transferOwnership(chamber)`.

The Ownable target is the **Chamber proxy**. Wallet execution uses `address(this)` as `msg.sender`.

## Exact order

From `contracts/`:

```bash
export MAINNET_RPC_URL=...          # do not commit
export ETHERSCAN_API_KEY=...        # do not commit
```

### 0. Rehearsal (anyone; no broadcast)

```bash
make rehearse-mainnet-lore-handoff
# or
make rehearse-mainnet-lore-handoff-script
```

`script/RehearseMainnetLoreHandoff.s.sol` reverts if you pass `--broadcast` / `--resume`.

### 1. Dry-run Factory package on a fork (anyone)

```bash
make print-mainnet-factory-deploy
forge script script/DeployMainnetFactory.s.sol:DeployMainnetFactory \
  --fork-url "$MAINNET_RPC_URL" -vvv
```

Dry-run / fork CREATE addresses are **not** live. Do not paste them into `deployments/mainnet.txt`.

---

### Agents stop here

Steps 2–6 are **Chad only**. Do not set `MAINNET_DEPLOY_UNBLOCKED=1` for a live chain-id-1 send. Do not `--broadcast` against mainnet from an agent. Do not invent addresses.

---

### 2. Broadcast Factory (Chad only)

```bash
export MAINNET_DEPLOY_UNBLOCKED=1
export ADMIN=0x5d45A213B2B6259F0b3c116a8907B56AB5E22095
forge script script/DeployMainnetFactory.s.sol:DeployMainnetFactory \
  --rpc-url "$MAINNET_RPC_URL" \
  --account "$ACCOUNT" \
  --broadcast \
  --chain-id 1 \
  -vvv
```

```bash
bash script/extract-mainnet-broadcast.sh \
  broadcast/DeployMainnetFactory.s.sol/1/run-latest.json
```

**Paste where:** **Factory**, **Chamber implementation**, **BoardLib**, **WalletLib** into all three templates (keep identical):

- `contracts/deployments/mainnet.txt`
- `app/contracts/deployments/mainnet.txt`
- `explorers/deployments/mainnet.txt`

Leave **Chamber (proxy)** and **Registry (proxy)** as TBD until step 4.

### 3. Verify (libs → Chamber impl → Factory)

```bash
make verify-mainnet-factory
# Print commands only (no API key needed):
PRINT_ONLY=1 make verify-mainnet-factory
```

The script refuses TBD and refuses the Sepolia Factory address. Factory constructor args are `abi.encode(implementation, admin)`. Chamber verify passes `--libraries` for BoardLib + WalletLib (same pairing as `make verify-sepolia-factory`).

Optional `--verify` on the forge script can run at broadcast time; still re-run this target so Etherscan links the libs.

### 4. Broadcast createChamber (Chad only; after Factory is verified)

```bash
export MAINNET_DEPLOY_UNBLOCKED=1
export FACTORY=0x<factory-from-step-2-receipt>
forge script script/CreateMainnetLoreChamber.s.sol:CreateMainnetLoreChamber \
  --rpc-url "$MAINNET_RPC_URL" \
  --account "$ACCOUNT" \
  --broadcast \
  --chain-id 1 \
  -vvv
```

**Paste where:** **Chamber (proxy)** from that receipt into the same three `mainnet.txt` copies. On Etherscan, mark the proxy as a TransparentUpgradeableProxy pointing at the verified implementation.

### 5. App env (Chad only; after verify)

`getContractAddresses(1)` reads `VITE_MAINNET_*` then `deployments/mainnet.txt`. TBD / empty → zero address. The app already treats that as unset (`isMainnetConfigured` / `hasValidAddresses`). Chain id 1 never falls back to Sepolia.

Set `VITE_MAINNET_FACTORY` (and impl) only after verify. Do not invent addresses.

### 6. Safe `transferOwnership` (Chad / Safe UI only)

Do **not** run this from a script. From the team Safe (`0x5d45A213B2B6259F0b3c116a8907B56AB5E22095`), call `LORE.transferOwnership(chamber)` on the **Chamber proxy** from step 4. The fork rehearsal impersonates this call; production is a real Safe tx.

## App wiring

- `app/src/lib/mainnetDeployments.ts` parses `app/contracts/deployments/mainnet.txt`
- `getContractAddresses(1)` → `CONTRACT_ADDRESSES.mainnet` (env, then file, else zero)
- Keep `contracts/`, `app/`, and `explorers/` `mainnet.txt` copies in sync when pasting

## What this package does not do

- Does not broadcast from Make / print / verify / extract
- Does not execute Safe or `transferOwnership`
- Does not invent mainnet Factory / Chamber / lib / Registry addresses
- Does not copy Sepolia addresses onto chain id 1
- Does not pre-compute the Chamber proxy (CREATE, no salt)
- Does not close #188 until Chad finishes steps 2–6
