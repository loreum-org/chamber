# Mainnet fork rehearsal: Factory + LORE Ownable handoff (M1)

Dry run for [#188](https://github.com/loreum-org/chamber/issues/188): deploy Chamber Factory on an **Ethereum mainnet fork**, create a Chamber bound to live LORE + membership NFT, then impersonate the team Safe and `transferOwnership` of LORE to that Chamber.

This proves the **mechanics**. It does **not** decide CCA vs Ownable production sequencing, move Safe residual balances, or change CCA params.

**Never broadcast these transactions to live mainnet.**

## M1 deploy checklist (PMN-M03 C)

Factory owner must be a **timelock or Safe** before any mainnet broadcast. Do not deploy Factory with an EOA owner. Record the real owner address on the M1 deploy task when it exists. This document does **not** invent a mainnet Factory or owner address.

`Registry.createChamber` is disabled. Ethereum creates go through `Factory.createChamber` only.

## What it does

1. Forks Ethereum (`vm.createSelectFork` / `forge script --fork-url`).
2. Deploys a `Chamber` implementation. `forge test` uses `new Chamber()` (Foundry auto-links `BoardLib` + `WalletLib`, same as `DeployFactory.s.sol`). `forge script` dry-run cannot — it deploys the two libs and links the Chamber artifact (the pairing Etherscan verify needs).
3. Deploys `Factory(implementation, team Safe)` — Factory Ownable admin matches Sepolia (`0x5d45A213B2B6259F0b3c116a8907B56AB5E22095`).
4. Calls `Factory.createChamber`:
   - `erc20Token`: LORE `0x7756D245527F5f8925A537be509BF54feb2FdC99`
   - `erc721Token`: membership `0xB99DEdbDe082B8Be86f06449f2fC7b9FED044E15`
   - `seats`: `5`
   - `name` / `symbol`: `Chamber LORE` / `cLORE`  
   These match `script/Chamber.s.sol` when `block.chainid == 1`.
5. Impersonates the Safe (`vm.prank`) and calls `LORE.transferOwnership(chamber)`.
6. Asserts / logs `LORE.owner() == chamber`.

The Ownable target is the **Chamber proxy** returned by `createChamber`. Chamber wallet execution uses `address(this)` as `msg.sender` on the target, so that proxy is the account that later holds `onlyOwner` on LORE.

## Env

| Variable | Role |
| --- | --- |
| `MAINNET_RPC_URL` | Preferred archive/full Ethereum RPC (also `foundry.toml` `[rpc_endpoints].mainnet`) |
| `ETH_RPC_URL` | Fallback if `MAINNET_RPC_URL` is unset |

Do not commit RPC URLs or keys. CI (`make ci-test`) runs `forge test` **without** a fork URL; the test **skips** when both env vars are empty.

## Commands

From `contracts/`:

```bash
export MAINNET_RPC_URL=https://...   # or ETH_RPC_URL

# Preferred: assertions + address logs
forge test --match-path test/fork/MainnetLoreOwnableHandoff.t.sol -vvv

# Same as above
make rehearse-mainnet-lore-handoff

# Interactive script (omit --broadcast)
forge script script/RehearseMainnetLoreHandoff.s.sol:RehearseMainnetLoreHandoff \
  --fork-url "$MAINNET_RPC_URL" -vvv
```

The script reverts if you pass `--broadcast` / `--resume`.

Chad broadcast runbook (print / verify / gated scripts, TBD address file):
[`mainnet-verified-deploy.md`](./mainnet-verified-deploy.md). Review blockers are on `main` (#220 / #223 / #224 / #225 / #226 / #213 / #206 / #214). Remaining work is Chad-only broadcast / verify / paste / app env / Safe. Agents stop at rehearsal. Safe `transferOwnership` is human-only.

## Success

Logs look like:

```
Factory                0x...
Chamber implementation 0x...
Chamber (LORE owner)   0x...
LORE.owner()           0x...   # equal to Chamber
```

The test also checks vault asset / NFT / seats, empty board, and `ProxyAdmin.owner() == chamber`.

## Gaps / mainnet blockers

| Topic | Finding |
| --- | --- |
| **Lib linking** | Chamber is over EIP-170 without `BoardLib` + `WalletLib`. This rehearsal deploys both libs and links the Chamber artifact (placeholders `__$562d…$__` / `__$a345…$__`). Production `forge script --broadcast` (`DeployFactory.s.sol`) auto-deploys libs; verify still needs the two lib addresses (see `deployments/sepolia.txt` / `make verify-sepolia-factory`). |
| **CREATE vs CREATE2** | `Factory.createChamber` uses `new TransparentUpgradeableProxy` (CREATE). Chamber address = next Factory nonce. No salt; you cannot pre-commit the address until Factory exists. |
| **Safe path** | Fork uses `vm.prank(Safe)`. Production is a real Safe `execTransaction` / UI call to `LORE.transferOwnership(chamber)` — same `msg.sender`, different signing UX. |
| **Board seating** | Create leaves an empty board. `seats = 5` → quorum 3. Seating needs membership NFT holders + LORE deposits + `SEATING_DELAY`. Not required to prove Ownable handoff. |
| **Ownable vs 2-step** | Mainnet LORE ABI is single-step Ownable (`owner` / `transferOwnership` / `renounceOwnership`; no `pendingOwner`). Chamber does not need `acceptOwnership`. |
| **CCA sequencing** | Still undecided. This fork does not claim a production order vs CCA. |
| **PMN-H01 (#208)** | Fixed on `main` via #220. |
| **PMN-M01 (#209) / PMN-M04 (#212)** | Fixed on `main` via #223 / #226. Quorum is over reachable authorized directors; session keys have expiry, scope, and set delay. |
| **PMN-M02 (#210) / PMN-M03 (#211)** | Fixed on `main` via #224 / #225. Factory is the only Ethereum create path; inert seated NFTs skip flags and drop rank. |
| **#213 / #206** | Merged (1.1.9 eviction hot-path; Halmos harness, not a full proof). |
| **Verified package (#214)** | `make print-mainnet-factory-deploy` / `make verify-mainnet-factory`. Paste addresses into `deployments/mainnet.txt` only from a chain-id-1 receipt. Agents stop before `MAINNET_DEPLOY_UNBLOCKED=1`. |
| **#188** | Stays open until Chad broadcasts, pastes verified addresses, and wires app env. |
