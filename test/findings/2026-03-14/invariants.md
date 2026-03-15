# Invariants — Chamber Protocol v1.1.3

**Date**: 2026-03-14
**Agent**: A4 — Invariant Designer

---

## INV-01: Delegation Solvency

**Statement**: For every user, their total delegated shares must never exceed their actual chamber balance.

```
∀ user: totalAgentDelegations[user] ≤ balanceOf(user)
```

**Enforced by**: `Chamber._update()` reverts `ExceedsDelegatedAmount` if a transfer/burn would violate this.
**Functions that affect it**: `delegate()` (increases both), `undelegate()` (decreases both), `withdraw()`/`redeem()` (decreases balance via burn).
**BROKEN BY**: Finding 11 — evicted board nodes leave `totalAgentDelegations` elevated permanently; the invariant becomes unrecoverable without a fix.

---

## INV-02: Board Sorted Order

**Statement**: The board linked list is sorted in descending order by `node.amount`.

```
∀ i: nodes[i].amount ≥ nodes[i.next].amount
```

**Enforced by**: `_insert()` traverses to correct position; `_reposition()` removes and re-inserts.
**Functions that affect it**: `_delegate()`, `_undelegate()`.
**Status**: Maintained. No violations found.

---

## INV-03: Board Size Bound

**Statement**: The board never contains more than MAX_NODES (100) nodes.

```
BoardStorage.size ≤ MAX_NODES
```

**Enforced by**: `_insert()` evicts tail before inserting new node when `size >= MAX_NODES`.
**Status**: Maintained. Note: eviction is the trigger for Finding 11.

---

## INV-04: Quorum Monotonicity

**Statement**: Transaction execution requires at least `getQuorum()` distinct director confirmations.

```
transaction.confirmations ≥ getQuorum()   before executeTransaction()
```

**Enforced by**: `executeTransaction()` and `executeBatchTransactions()` revert if `confirmations < getQuorum()`.
**Status**: Maintained. Quorum can change between submission and execution (seats change), but execution checks current quorum at call time.

---

## INV-05: Self-Call Upgrade Guard

**Statement**: `upgradeImplementation()` can only be called from the Chamber itself (via multisig execution).

```
msg.sender == address(this)   when upgradeImplementation() is called
```

**Enforced by**: `if (msg.sender != address(this)) revert NotAuthorized()`.
**Status**: Maintained. Previously broken (Finding 1); fixed.

---

## INV-06: Unique Confirmation per Director

**Statement**: Each tokenId can confirm a given transaction at most once.

```
∀ tokenId, nonce: isConfirmed[nonce][tokenId] is set at most once
```

**Enforced by**: `notConfirmed(tokenId, nonce)` modifier in `_confirmTransaction`.
**Status**: Maintained.

---

## INV-07: Transaction Execution Idempotency

**Statement**: An executed transaction cannot be executed again.

```
transaction.executed == true  ⟹  cannot re-execute
```

**Enforced by**: `notExecuted(nonce)` modifier.
**Status**: Maintained. Note: `executed = false` is reset on failure, allowing retry — intentional design.

---

## INV-08: Agent Policy Gate

**Statement**: `autoConfirm()` only calls `confirmTransaction()` if `policy.canApprove()` returns true.

```
autoConfirm() called  ⟹  policy.canApprove() == true
```

**Enforced by**: `autoConfirm()` body.
**BROKEN BY**: Finding 12 — `execute()` allows owner to bypass policy entirely.

---

## Missing Invariant Enforcement

| Invariant | Current State |
|-----------|--------------|
| Delegations to evicted nodes should be clearable | NOT ENFORCED — `undelegate()` reverts if node missing |
| Agent `isValidSignature` should bind hash to owner approval | NOT ENFORCED — 32-byte path ignores hash |
| Seat proposals should be protected against single-actor griefing | NOT ENFORCED — no cooldown/multi-actor cancellation |
