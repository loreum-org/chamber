# Critical Flows — Chamber Protocol v1.1.3

**Date**: 2026-03-14

---

## Flow 1: Deposit → Delegate → Board Entry

```
User deposits ERC-20 → receives chamber shares (ERC-4626)
User calls delegate(tokenId, amount)
  → validate tokenId != 0, amount != 0
  → check balanceOf(user) >= amount
  → validate NFT.ownerOf(tokenId) exists (try/catch)
  → update agentDelegation[user][tokenId] += amount
  → update totalAgentDelegations[user] += amount
  → check balanceOf(user) >= totalAgentDelegations[user]
  → _delegate(tokenId, amount) → _insert or _reposition in sorted list
  → if board full (100 nodes) and amount > tail.amount → evict tail
```

**Critical invariant**: `totalAgentDelegations[user] <= balanceOf(user)` at all times.
**Broken by**: Node eviction (Finding 11).

---

## Flow 2: Director Transaction Lifecycle

```
Director calls submitTransaction(tokenId, target, value, data)
  → isDirector(tokenId) modifier: verify NFT ownership + top-seat membership
  → target == address(this)? data selector must be UPGRADE_SELECTOR
  → value <= address(this).balance
  → _submitTransaction → auto-confirms for submitter
Director calls confirmTransaction(tokenId, txId)
  → isDirector(tokenId)
  → not yet executed, not yet confirmed by this tokenId
  → confirmations++
Director calls executeTransaction(tokenId, txId)
  → isDirector(tokenId)
  → confirmations >= quorum
  → CEI: set executed = true BEFORE external call
  → target.call{value}(data)
  → if fails: reset executed = false, revert
```

**Critical invariant**: Execution requires quorum. Self-call (upgrade) requires governance consensus.

---

## Flow 3: Upgrade Path

```
Directors build quorum for upgradeImplementation(newImpl, data) transaction
Execute via Flow 2
Chamber.upgradeImplementation():
  → msg.sender == address(this) required
  → get ProxyAdmin from ERC-1967 slot
  → proxyAdmin.owner() == address(this) required
  → proxyAdmin.upgradeAndCall(proxy, newImpl, data)
```

**Critical invariant**: Only governance (multisig quorum) can upgrade.

---

## Flow 4: Seat Update Governance

```
Director calls updateSeats(tokenId, numOfSeats)
  → isDirector(tokenId)
  → if seats == 0: set directly (initialization only)
  → if proposal exists with different value: cancel proposal (griefing vector)
  → else: add supporter to proposal
Director calls executeSeatsUpdate(tokenId) after 7+ days
  → isDirector(tokenId)
  → validate each supporter still in top seats
  → count validSupport; must meet requiredQuorum (captured at creation time)
  → update seats, delete proposal
```

**Critical invariant**: Seat changes require time-locked quorum with live supporters.
**Griefing vector**: Any director can cancel by proposing a different number (Finding 14).

---

## Flow 5: Agent Auto-Confirm

```
Keeper/Owner calls Agent.autoConfirm(chamber, transactionId, tokenId)
  → onlyAuthorized: caller must be owner or authorizedKeeper
  → policy.canApprove(chamber, transactionId) must return true
  → chamber.confirmTransaction(tokenId, transactionId)
```

**Alternative path (bypass)**: Owner calls Agent.execute(chamber, 0, confirmCalldata)
  → No policy check
  → Directly confirms transaction (Finding 12)

---

## Flow 6: Node Eviction (Critical Edge Case)

```
Board has 100 nodes (MAX_NODES reached)
New delegation arrives for a NEW tokenId with amount > tail.amount
_insert():
  → size >= MAX_NODES → _remove(tail)
  → tail's board node deleted
  → Any user with agentDelegation[user][tail] > 0 is now STUCK:
    - undelegate(tail, amount) calls _undelegate → reverts NodeDoesNotExist
    - totalAgentDelegations[user] remains elevated
    - _update blocks withdrawals/transfers
```

**Critical invariant violated**: Delegations should always be unrecoverable.
(Finding 11 — HIGH severity)
