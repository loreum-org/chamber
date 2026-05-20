# A1 — Intent and Spec Extractor

**Date**: 2026-03-14
**Target**: `src/` — Chamber Protocol v1.1.3

---

## System Summary

Chamber is an onchain governance primitive combining three primitives:

1. **ERC-4626 Vault** (`Chamber` inherits `ERC4626Upgradeable`) — users deposit ERC-20 tokens and receive vault shares ("chamber shares"). Shares represent proportional claims on the vault asset.

2. **Board Governance** (`Board.sol`) — a sorted linked list of NFT-token-ID nodes, ordered by cumulative delegated share amount. The top `seats` nodes constitute the Board of Directors. Governance proposals (multisig transactions, seat changes) require quorum approval from active directors.

3. **Multisig Wallet** (`Wallet.sol`) — directors submit, confirm, and execute arbitrary transactions. Execution requires `confirmations >= quorum`. Transactions can target any address including the Chamber itself (for upgrades).

**Supporting contracts**:
- `Registry` — factory and directory for Chamber and Agent proxies (TransparentUpgradeableProxy).
- `Agent` — smart-account contract that can hold an NFT directorship and auto-confirm transactions based on configurable governance policies. Implements EIP-1271.
- `AgentIdentityRegistry` — ERC-721 identity NFTs for Agents (ERC-8004).
- `ValidationRegistry` — ERC-8004 validation attestations for Agents.
- `ReputationRegistry` — ERC-8004 reputation signals for Agents.

---

## Protocol Claims

| Claim | Location |
|-------|----------|
| Vault shares cannot be transferred/burned below total delegated amount | `Chamber._update()` |
| Delegation requires the tokenId to own a valid NFT | `Chamber.delegate()` try/catch |
| Only directors (top-seat NFT holders) can submit/confirm/execute transactions | `isDirector` modifier |
| Seat changes require quorum at proposal time, 7-day timelock, and valid supporters at execution | `Board._executeSeatsUpdate()` |
| Upgrade can only be triggered via the multisig governance (self-call) | `Chamber.upgradeImplementation()` `msg.sender != address(this)` check |
| Agent `autoConfirm` restricted to owner or authorized keepers | `Agent.onlyAuthorized` modifier |
| Board limited to MAX_NODES = 100 entries; eviction replaces lowest-ranked node | `Board._insert()` |
| ERC-4626 inflation attack mitigated via `_decimalsOffset() = 3` | `Chamber._decimalsOffset()` |

---

## Divergences Found

| Claim | Divergence |
|-------|-----------|
| All delegations are recoverable | **DIVERGENCE**: Delegations to evicted board nodes cannot be undelegated because the board node no longer exists. `totalAgentDelegations` is never decremented, permanently locking shares. |
| Agent policy is enforced for all governance actions | **DIVERGENCE**: Agent owner can bypass policy via `Agent.execute()`, calling `confirmTransaction` directly. |
| Agent implements standard EIP-1271 | **DIVERGENCE**: The 32-byte signature path in `isValidSignature` ignores the hash parameter; any hash is valid if signature encodes the owner address. |

---

## Dangerous Assumptions

1. **NFT trustworthiness**: `delegate()` calls `nft.ownerOf()` with an external call before updating state. A malicious NFT could re-enter, though CEI-style ordering limits the damage.
2. **MAX_NODES eviction**: The system assumes that nodes with delegations to them are never evicted. If the board is full (100 nodes) and a higher-stake entrant arrives, the tail is ejected — any delegations to the tail are permanently stranded.
3. **Agent policy is optional**: The policy system is not cryptographically enforced; the owner can always bypass it via `execute()`.
4. **Proxy admin transferability**: After Chamber deployment, ProxyAdmin ownership is transferred to the Chamber itself. If the board becomes inoperable (no directors), upgrades are permanently blocked.
