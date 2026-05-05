# Design notes

This section captures implementation choices reflected in `contracts/src/` (`Chamber.sol`, `Board.sol`, `Wallet.sol`, `Registry.sol`). It is meant for reviewers and integrators, not end users.

## Contract composition

- **`Chamber`** inherits OpenZeppelin **`ERC4626Upgradeable`** (vault over a fixed ERC‑20 underlying), **`Board`** (delegation leaderboard and seat mechanics), **`Wallet`** (queued transactions with quorum confirmations), **`ReentrancyGuardUpgradeable`**, and **`IChamber`**.
- **Single proxy per Chamber**: governance and vault logic share one deployed address (`TransparentUpgradeableProxy` wrapping a `Chamber` implementation).

## ERC‑7201 namespaced storage

Board, Wallet, Chamber-specific delegation storage, and Registry each use deterministic storage slots declared in Solidity (`erc7201:loreum.*`) so upgradeable layouts stay collision-resistant and intentional gaps can be preserved between versions.

## Board: sorted leaderboard

- Delegations accumulate **per membership ERC‑721 tokenId** into a doubly linked list sorted by delegated weight (descending).
- **`MAX_SEATS`** on the Chamber is **20**; **`MAX_NODES`** on the Board is **50**. The list may track more NFTs than active seats.
- **`next` / `prev` links are `uint128`**, so **`tokenId` must be \(\le\) `type(uint128).max`** on insert; larger IDs revert.
- **`circuitBreaker`** on `_delegate` / `_undelegate` uses **EIP‑1153 transient storage** (`TSTORE`/`TLOAD`) instead of persistent locks to prevent reentrant manipulation of ordering during list updates.

## Wallet: hash-only calldata

- Stored per transaction: `target`, `value`, `executed`, `confirmations`, and **`bytes32 dataHash`** (`keccak256(calldata)`), not raw `bytes`.
- **`executeTransaction` and `executeBatchTransactions` require callers to pass the original calldata**; the runtime checks `keccak256(data) == dataHash`.
- **`SubmitTransaction`** event includes full `bytes data` so indexers can persist calldata while chain state stays cheap.

## Targets and upgrades

- **Calls where `target == address(chamber)`** are restricted: calldata selector must match **`upgradeImplementation(address,bytes)`** (computed as `upgradeImplementation`'s selector in `Chamber`), so accidental self‑calls cannot drain state through arbitrary selectors.
- **Implementation upgrades**: `upgradeImplementation` resolves the Chamber’s **`ProxyAdmin`** from the ERC‑1967 admin slot and calls **`upgradeAndCall`**. Typical path is a Wallet **`executeTransaction`** that performs an internal call (`msg.sender == address(this)` check inside `upgradeImplementation`).

## Quorum

- Wallet confirmations follow **`getQuorum() = 1 + (getSeats() * 51) / 100`** (integer arithmetic, same semantics as Solidity in `Board._getQuorum`).
- **`cancelTransaction`**: directors record cancel votes until **`getQuorum()`** cancel confirmations are collected, then the nonce is marked cancelled and cannot accumulate further confirmations.

## Seat updates

- After initialization, **`updateSeats`** records a **`SeatUpdate`**: supporters (director **`tokenId`s**) must match **`proposedSeats`** strings of calls so the same proposal aggregates votes.
- **`executeSeatsUpdate`** applies only after **`7 days`**, and only if at least **`requiredQuorum`** supporters (frozen at proposal creation) remain **among the top `getSeats()` tokenIds by delegation** when execution runs—which prevents stale backers from approving a hostile resize.

## Shares, delegation, and transfers

- **`_update`** (ERC‑20 hooks) rejects any transfer/redemption pattern that would leave **`balance(h) < totalHolderDelegations[h]`**.
- **`_decimalsOffset()`** returns **3** so the vault uses virtual shares mitigation against first‑depositor inflation / donation quirks (OZ ERC‑4626 pattern).

## Director authentication

Actions gated by **`isDirector(tokenId)`** require **`msg.sender`** to be:

1. **`ownerOf(tokenId)`** on the configured membership NFT, **or**
2. A contract **`owner`** returning **`ERC1271.isValidSignature.selector`** over `keccak256(abi.encodePacked("DirectorAuth", address(this), tokenId, msg.sender))`.

Membership slots are taken from traversing **`getTop(getSeats())`** (head‑first leaderboard walk).

## Registry

- **`createChamber`** deploys a **`TransparentUpgradeableProxy`** wired to `Registry` as **`ProxyAdmin` owner**, then **`ProxyAdmin.transferOwnership(chamber)`** so **each Chamber eventually owns its own proxy admin**.
- **`erc20Token`** that is **`isChamber(erc20Token)`** sets **parent/child** bookkeeping for sub‑chamber vault hierarchies (`getParentChamber` / `getChildChambers`).
- **`setChamberImplementation`** updates **only future** proxies; existing chambers upgrade through their **`ProxyAdmin`**.

## Deploy script caveat

Standalone **`contracts/script/Chamber.s.sol`** (via **`DeployChamber` test util**) constructs a Chamber proxy whose **`TransparentUpgradeableProxy` admin role** is **`admin`**. That differs from **`Registry.createChamber`**, which ends with **upgrade rights on the ProxyAdmin residing with the Chamber contract itself**. Prefer the Registry path when modeling production governance semantics.
