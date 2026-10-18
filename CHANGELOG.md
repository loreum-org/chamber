# Changelog

Contract-level changes to `Chamber` that affect integrations. App, docs, and tooling changes are tracked in PRs.

## 1.2.0 (unreleased; not deployed)

Security review 2026-10-12 fixes (#392) and the EIP-170 size refactor (#394). See `docs/security/review-2026-10-12.md`.

### Breaking: ABI removals (#394)

1.2.0 chambers no longer have these functions. Integrations that call them must switch to the replacement.

| Removed | Use instead |
|---|---|
| `getDirectorOperator`, `getDirectorOperatorScope`, `getDirectorOperatorLiveAt` | `getDirectorSession(tokenId)`. The stored session is live only when `isTokenAuthorized(tokenId, operator)` **and** `isTokenAuthorized(tokenId, sessionOwner)` are both true. Checking the operator alone is not enough: it is also true after the NFT is transferred to its own session key, which leaves the previous owner's `scope` / `liveAt` behind. For a self-registered key (`operator == sessionOwner`) both reads pass through the owner branch, so also require `expiry != 0`, `block.timestamp <= expiry`, and owner `code.length > 0`, as `_isLiveSessionKey` does. |
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
