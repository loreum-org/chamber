# Changelog

Contract-level changes to `Chamber` that affect integrations. App, docs, and tooling changes are tracked in PRs.

## 1.3.0 (unreleased; not deployed)

Scope cuts before mainnet (epic #395). Chamber runtime bytecode drops from 24,571 to 21,810 bytes, leaving 2,766 bytes under the EIP-170 limit.

### Breaking: session keys removed (#396)

Directors act only as `ownerOf(tokenId)`. An agent acting for a director signs through the owner's own wallet, for example a Safe module or an ERC-4337 / ERC-7579 smart-account session key.

Removed: `setDirectorOperator`, `getDirectorSession`, `isTokenAuthorized`, the `SESSION_SCOPE_*` constants, event `DirectorOperatorSet`, errors `InvalidSessionExpiry` and `InvalidSessionScope`. This makes R-1012-L5 and the session half of R-1012-L4 moot. The seat-maturity half of L4 is still open.

### Breaking: one submit function (#397)

| Removed | Use instead |
|---|---|
| `submitTransaction(tokenId, target, value, data)` | `submitTransaction(tokenId, target, value, data, "", 0)` |
| `submitTransaction(tokenId, target, value, data, deadline)` | `submitTransaction(tokenId, target, value, data, "", deadline)` |
| `submitTransactionWithMetadata(tokenId, target, value, data, metadataURI)` | `submitTransaction(tokenId, target, value, data, metadataURI, 0)` |
| `submitTransactionWithMetadata(..., metadataURI, deadline)` | `submitTransaction(..., metadataURI, deadline)` |

Empty `metadataURI` stores nothing. `deadline = 0` uses the 30-day default. Submitting always records the submitter's confirmation.

### Changed

- Pre-upgrade delegation backfill removed (#398). `getDelegations` returns the holder's tracked set in insertion order. Chambers deployed before 1.2.0 cannot be upgraded in place to 1.3.0; redeploy them. The `directorSession` and `evictedTokenIds` storage fields stay in place, unused, so the layout does not shift.
- New error `IBoard.LegacyDelegation`. A pre-1.2.0 chamber is upgraded by its own old code (or its ProxyAdmin), so 1.3.0 code cannot stop the implementation switch itself. Instead 1.3.0 fails closed on the data it cannot account for: a positive delegation row with `holderEpoch == 0` (only pre-1.2.0 code writes those) on a node still on the board makes `delegate` and `undelegate` revert `LegacyDelegation`, rather than letting `undelegate` free the shares while the board keeps the weight. Rows on nodes that already left the board can still be withdrawn. Chambers born on 1.2.0+ are unaffected.
- Upgrade tooling version guard: `ProposeChamberUpgrade` and the app's upgrade preflight read both `VERSION()`s and refuse an in-place upgrade of a pre-1.2.0 chamber to 1.3.0+ (its pre-1.2.0 delegations would hit `LegacyDelegation` and stay locked; redeploy instead), refuse an unreadable version, and warn on a downgrade. The app also flags ProxyAdmin `transferOwnership` / `renounceOwnership` proposals as high risk.
- Deploy scripts: new `script/DeployChamberImplementation.s.sol` and `script/ProposeChamberUpgrade.s.sol` (ProxyAdmin `upgradeAndCall` quorum tx with preflight), plus `make deploy-chamber-implementation` / `make propose-chamber-upgrade`. `script/Chamber.s.sol` now creates chambers through the Factory, so the chamber owns its ProxyAdmin (it used to deploy a bare proxy whose ProxyAdmin an EOA owned). `Chamber.s.sol`, `Registry.s.sol` and `DeployAllAnvil.s.sol` no longer import `test/utils` deploy helpers, which failed under `forge script` ("no bytecode for contract ... unlinked"). Chain id 1 broadcasts of the new scripts are gated by `MAINNET_DEPLOY_UNBLOCKED`.
- Breaking: `upgradeImplementation` removed. The only upgrade path is a quorum transaction with `target = getProxyAdmin()` and `data = upgradeAndCall(chamber, newImplementation, initData)`, which was already possible and skipped `upgradeImplementation`'s checks anyway. ProxyAdmin has no version or migration checks of its own; the board is responsible for what it approves (and for not calling `transferOwnership` / `renounceOwnership` on it). Calls to the ProxyAdmin now store their calldata onchain like self-calls (L-04), so an approved upgrade executes with empty `data`. Self-calls are limited to `pause` / `unpause`; the old selector `0xc89311b6` now reverts in `fallback` (`InvalidTransaction`) unless ETH is attached.
- `fallback` reverts with `InvalidTransaction` when called with no ETH, so unknown functions such as `permit` no longer appear to succeed (#399, closes R-1012-L3). Plain ETH and ETH sent with calldata are still accepted.
- `maxWithdraw` and `maxRedeem` stop at shares the holder has not delegated (R-1012-L1). `redeem(maxRedeem(owner))` no longer reverts `ExceedsDelegatedAmount` for a holder who still has free shares. Paused vaults still report zero.
- Wallet execution reverts `TransactionFailed` when an ERC-20 `transfer`, `transferFrom`, `approve`, `increaseAllowance`, or `decreaseAllowance` returns a 32-byte zero word, instead of marking the nonce executed (R-1012-L2). Empty return data is still success, and a 32-byte zero from any other selector (including `uint256 0`) is still success.
- A failed `ownerOf` on a bound seat stores an unbound snap instead of deleting `seatedOwner`, so a remint of that id waits out `SEATING_DELAY` again (R-1012-L4 seat half). The session half of L4 is already moot.
- Seat-update support records `ownerOf` and does not count after that controller changes. `withdrawSeatSupport(tokenId)` lets the current owner retract a vote or clear a stale one (R-1012-M5). The original proposer token can still cancel. Proposals written before this field existed have an empty controller snap and still count. New storage is appended on the Board ERC-7201 struct (`seatProposalProposer`, `seatSupporter`).
- Confirm and cancel votes record `msg.sender` as the controller (it is always the owner now) instead of reading `ownerOf` again.
- `VERSION` is `1.3.0`.

## 1.2.0 (unreleased; not deployed)

Security review 2026-10-12 fixes (#392) and the EIP-170 size refactor (#394). See `docs/security/review-2026-10-12.md`.

### Breaking: ABI removals (#394)

1.2.0 chambers no longer have these functions. Integrations that call them must switch to the replacement.

| Removed | Use instead |
|---|---|
| `getDirectorOperator`, `getDirectorOperatorScope`, `getDirectorOperatorLiveAt` | (1.3.0 removes session keys entirely.) `getDirectorSession(tokenId)`. The stored session is live only when `isTokenAuthorized(tokenId, operator)` **and** `isTokenAuthorized(tokenId, sessionOwner)` are both true. Checking the operator alone is not enough: it is also true after the NFT is transferred to its own session key, which leaves the previous owner's `scope` / `liveAt` behind. For a self-registered key (`operator == sessionOwner`) both reads pass through the owner branch, so also require `expiry != 0`, `block.timestamp <= expiry`, and owner `code.length > 0`, as `_isLiveSessionKey` does. |
| `getReachableDirectorCount` | `min(getSeats(), getSize())` |
| `getHolderDelegation`, `getTotalHolderDelegations` | `getDelegations(holder)` |
| `isTransactionExpired` | `getTransactionDeadline(nonce)` (`0` never expires) |
| `getNextTransactionId`, `getCurrentNonce` | `getTransactionCount()` |
| `acceptAdmin` (was a no-op) | nothing; no callers in `Registry`, `Factory`, or scripts |

### Changed

- `VERSION` is `1.2.0`.
- Chamber runtime bytecode is 24,571 bytes (EIP-170 limit 24,576). `test/unit/ChamberSize.t.sol` fails if it grows past the limit.
- `directorCall` uses the same transient reentrancy slot as OpenZeppelin's `nonReentrant`, pinned by `test/findings/FindingM02_SharedGuardSlot.t.sol`.
- Single and batch `confirmTransaction` revert order changed (checks now come from `WalletLib.confirmTransaction`); the set of revert conditions is the same.
- `delegate` also rejects a token whose `ownerOf` is the zero address.
