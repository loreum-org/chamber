# Security Audit Report — Chamber Protocol v1.1.3

**Date**: 2026-03-14
**Target**: `src/` directory
**Reviewer**: AI Security Pipeline (Agents A0–A13)
**Commit**: Current HEAD (all prior findings 1–10 fixed)

---

## Executive Summary

A comprehensive second-cycle security review of the Chamber protocol identified **1 High**, **2 Medium**, and **1 Low** severity finding in the current codebase (v1.1.3). All 10 previously reported findings (Finding 1–10) are confirmed fixed. The protocol carries **1 release blocker** that must be remediated before deployment.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | — |
| High | 1 | **OPEN** — Release Blocker |
| Medium | 2 | **OPEN** |
| Low | 1 | **OPEN** |

**Ship approval**: ❌ BLOCKED until Finding 11 is fixed and verified.

---

## Finding 11: Permanent Delegation Lock on Evicted Board Nodes [HIGH]

**Location**: `src/Board.sol:_insert()` + `src/Chamber.sol:undelegate()` + `src/Chamber.sol:_update()`

**Description**:
The Board maintains a sorted linked list of at most `MAX_NODES = 100` token delegation nodes. When a new node with higher stake than the current tail is inserted and the board is full, `_insert()` evicts the tail node via `_remove()`, which deletes the node from storage entirely.

Any user who has `agentDelegation[user][evictedTokenId] > 0` is now in an unrecoverable state:

1. `Chamber.undelegate(evictedTokenId, amount)` calls `_undelegate()`, which reverts with `NodeDoesNotExist` because the board node no longer exists.
2. The full transaction reverts, so `agentDelegation` and `totalAgentDelegations` are NOT decremented.
3. `Chamber._update()` blocks any transfer or withdrawal that would bring `balanceOf(user)` below `totalAgentDelegations[user]`.
4. The user's shares are permanently locked above the stranded delegation amount.

**Impact**:
User funds (chamber shares) are permanently inaccessible. The user cannot withdraw their ERC-20 assets from the vault or transfer their shares to any address. The delegation serves no governance purpose (the board node is gone), yet its accounting effect persists forever.

**Proof of Concept**:
```
1. Board has MAX_NODES (100) nodes; tail node is tokenId #55 with 50 delegated shares
2. Alice has agentDelegation[Alice][55] = 50
3. Bob delegates 51 shares to a brand new tokenId #200
4. _insert(200, 51): size >= 100 → _remove(55) → delete $.nodes[55]
5. Alice calls undelegate(55, 50):
   - agentDelegation[Alice][55] -= 50 ✓ (state updated)
   - totalAgentDelegations[Alice] -= 50 ✓ (state updated)
   - _undelegate(55, 50) → $.nodes[55].tokenId == 0 != 55 → revert NodeDoesNotExist
   - FULL TRANSACTION REVERTS; state unchanged
6. Alice tries withdraw(amount) → _update check: balance - amount < 50 → revert ExceedsDelegatedAmount
7. Alice's 50+ shares are permanently locked
```

**Recommendation**:
In `Chamber.undelegate()`, check whether the board node still exists before calling `_undelegate()`. If the node is gone (evicted), skip the board removal but still update the delegation accounting:

```solidity
function undelegate(uint256 tokenId, uint256 amount) external override {
    if (tokenId == 0) revert IChamber.ZeroTokenId();
    if (amount == 0) revert IChamber.ZeroAmount();

    ChamberStorage storage $ = _getChamberStorage();
    uint256 currentDelegation = $.agentDelegation[msg.sender][tokenId];
    if (currentDelegation < amount) revert IChamber.InsufficientDelegatedAmount();

    uint256 newDelegation = currentDelegation - amount;
    $.agentDelegation[msg.sender][tokenId] = newDelegation;
    $.totalAgentDelegations[msg.sender] -= amount;

    // Only modify board if the node still exists
    BoardStorage storage $b = _getBoardStorage();
    if ($b.nodes[tokenId].tokenId == tokenId) {
        _undelegate(tokenId, amount);
    }

    emit IChamber.DelegationUpdated(msg.sender, tokenId, newDelegation);
}
```

---

## Finding 12: Agent `execute()` Bypasses Governance Policy [MEDIUM]

**Location**: `src/Agent.sol:execute()`

**Description**:
The `Agent` contract exposes an `execute(address target, uint256 value, bytes calldata data)` function restricted to `onlyOwner`. This function makes an arbitrary external call without any policy check. Since `Chamber.confirmTransaction()` is an external function, the Agent owner can call it directly through `execute()`, bypassing the policy gate enforced by `autoConfirm()`.

**Impact**:
The governance policy system (`IAgentPolicy.canApprove()`) is advisory, not enforced. Any policy — including `ConservativeYieldPolicy` with value limits and target whitelists — can be bypassed by the Agent owner at any time. Users who rely on Agent policies for governance accountability receive a false guarantee.

**Proof of Concept**:
```
1. Agent configured with ConservativeYieldPolicy (max 10 ETH, whitelist targets only)
2. Chamber has txId #5 targeting a non-whitelisted address with 15 ETH
3. autoConfirm(chamber, 5, tokenId) → PolicyRejection
4. agent.execute(
       address(chamber),
       0,
       abi.encodeWithSelector(IChamber.confirmTransaction.selector, tokenId, 5)
   ) → succeeds, transaction confirmed
```

**Recommendation**:
Option A (documentation): Add `@dev WARNING: This function bypasses governance policy` to `execute()`. This is appropriate if `execute()` is intended as an owner escape hatch.

Option B (enforcement): Remove `execute()` or gate it to prevent direct `confirmTransaction` calls when a policy is set.

---

## Finding 13: Agent EIP-1271 Hash-Agnostic 32-Byte Signature Path [MEDIUM]

**Location**: `src/Agent.sol:isValidSignature()`

**Description**:
The `isValidSignature()` implementation includes a 32-byte signature shortcut:

```solidity
if (signature.length == 32) {
    address authorizedSender = abi.decode(signature, (address));
    if (authorizedSender == _owner) {
        return IERC1271.isValidSignature.selector;
    }
}
```

This path returns the EIP-1271 magic value for **any** `hash` when the signature is a 32-byte ABI encoding of the owner's address. The `hash` parameter is completely ignored.

Within the Chamber's `_isDirector()` flow, this is safe: the Chamber constructs both the hash and the signature, and the interaction is internal. However, if the Agent is used as an EIP-1271 signer by any external protocol (token permit, order book, bridge, etc.), any actor can craft a 32-byte signature encoding the owner address to pass signature validation for arbitrary messages the owner never signed.

**Impact**:
If the Agent is integrated with external protocols expecting standard EIP-1271 behavior, arbitrary messages can be validated as signed by the Agent's owner, potentially enabling:
- Token permit approvals the owner never authorized
- Order book signatures for trades the owner never intended
- Any protocol that accepts `isValidSignature` as authentication

**Recommendation**:
Remove the 32-byte shortcut path. If contract-owned NFT directorship is needed, update `_isDirector()` to use a different authorization mechanism (e.g., an explicit `approveForDirectorship(chamber, tokenId)` mapping on the Agent, rather than EIP-1271).

---

## Finding 14: Seat Update Proposal Griefing by Minority Director [LOW]

**Location**: `src/Board.sol:_setSeats()`

**Description**:
When a seat update proposal exists with `proposedSeats = X`, any director calling `updateSeats(tokenId, Y)` where `Y != X` immediately cancels the proposal (deletes it). No quorum, cooldown, or penalty is required for cancellation. A single dissident director can permanently block seat changes by calling `updateSeats` with a different value every time a proposal is started.

**Impact**:
Governance liveness: seat configuration becomes immutable in practice if any director chooses to grief. Since quorum is based on current seats, an adversarial director who would be removed by the seat change is incentivized to block it.

**Recommendation**:
Require multi-director support to cancel an in-progress proposal (matching or exceeding the required quorum), or add a cooldown period before a cancelled proposal can be restarted.

---

## Confirmed Fixed Findings (Prior Cycles)

| Finding | Severity | Status |
|---------|----------|--------|
| 1 — Unauthorized Upgrade | CRITICAL | ✅ Fixed (msg.sender check) |
| 2 — Double Delegation | CRITICAL | ✅ Fixed (cumulative check) |
| 3 — Board DoS via Max Nodes | HIGH | ✅ Fixed (tail eviction) |
| 4 — ERC4626 Withdraw Bypasses Delegation | CRITICAL | ✅ Fixed (_update override) |
| 5 — Agent Dead Code Path | HIGH | ✅ Fixed (removed broken overload) |
| 6 — First Depositor Inflation Attack | HIGH | ✅ Fixed (_decimalsOffset = 3) |
| 7 — Stale Seat Update Supporters | MEDIUM | ✅ Fixed (_isInTopSeats check) |
| 8 — Permissionless Agent AutoConfirm | MEDIUM | ✅ Fixed (onlyAuthorized) |
| 9 — Wallet Reentrancy | MEDIUM | ✅ Fixed (nonReentrant on all wallet fns) |
| 10 — Unbounded Array DoS | LOW | ✅ Fixed (pagination + O(1) lookups) |

---

## Security Posture Summary

The Chamber protocol has a solid security foundation after the prior cycle's fixes. The upgrade guard, delegation lock, board DoS protection, and reentrancy guards are all correctly implemented. The remaining findings are concentrated in two areas:

1. **Delegation accounting edge case** (Finding 11): An invariant break in the interaction between board node eviction and delegation accounting. Straightforward fix.
2. **Agent design tensions** (Findings 12 & 13): The Agent's `execute()` escape hatch and non-standard EIP-1271 behavior are design choices that need clearer documentation or scoping to prevent misuse.

**Recommended actions before deployment**:
1. Fix Finding 11 and add the PoC test
2. Add documentation warnings to Agent.execute() and Agent.isValidSignature()
3. Re-run full test suite (currently 324 tests passing)
