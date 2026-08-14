---
name: "locking-semantics"
description: "Trigger Pattern Always required for DAML audits (self-skips if no lock pattern present) - Inject Into Breadth agents, depth-state-trace, depth-edge-case"
---

# LOCKING_SEMANTICS Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits — self-skip if no lock pattern present
> **Inject Into**: Breadth agents, depth-state-trace, depth-edge-case
> **Finding prefix**: `[DML-LK-N]`
> **Rules referenced**: R8, R10, R14

DAML has no native lock primitive; locking is emulated by a template field (`locked : Bool`, `lockedUntil : Time`, a held lock contract, or a separate `Locked` template wrapping the asset). The invariant is: while locked, the asset MUST NOT be split, merged, transferred, or archived through any path; and the value MUST be conserved across the lock→unlock cycle. The two high-yield bugs are **lock-bypass** (a choice that moves the asset ignores the lock field) and **lock-erase** (a choice recreates the asset successor dropping the `locked` field). If no template carries a lock field / lock wrapper, this skill self-skips.

## 1. Lock-State Inventory

Identify every lock mechanism and the asset it protects:

| Template | Lock Mechanism | Lock Field/Wrapper | Set By (choice) | Cleared By (choice) | Asset Protected |
|----------|----------------|--------------------|-----------------|---------------------|-----------------|
| `{T}` | bool field / time field / Locked wrapper | `{locked / lockedUntil}` | `{choice}` | `{choice}` | `{asset field}` |

**DAML note**: A lock encoded as a plain `Bool`/`Time` field on the asset template is only honored if EVERY value-moving choice reads it. A lock encoded as a separate wrapper template is only honored if the underlying asset cannot be exercised directly while wrapped.

## 2. Lock-Honoring Audit (lock-bypass)

For EVERY value-moving choice on a lockable template, verify it checks the lock:

| Template.Choice | Moves/Splits/Merges/Archives Asset? | Reads Lock Field? | Lock Check Expr | Bypassable? |
|-----------------|--------------------------------------|-------------------|-----------------|-------------|
| `{T.C}` | YES/NO | YES/NO | `assertMsg "locked" (not locked)` / NONE | `[DML-LK-N]` if moves while locked |

**Attack**: A `Transfer`/`Split` choice does not read `locked`, so a locked asset can still be moved (`[ELEVATE:LOCK_BYPASS]`). For wrapper-based locks: verify the underlying asset's own choices are not directly exercisable while wrapped (e.g., the wrapper holds the only `ContractId` and the asset's signatories prevent independent exercise).

**Check for**:
- ANY value-moving choice with zero lock check on a lockable template.
- A time-lock (`lockedUntil`) compared with the wrong relation (`>=` vs `>`) or against a caller-supplied time instead of `getTime`.

## 3. Lock-Erase Audit

A choice that recreates the asset successor must carry the lock field forward.

| Template.Choice | Recreates Asset Successor? | Carries `locked` Forward? | Erase Risk? |
|-----------------|----------------------------|----------------------------|-------------|
| `{T.C}` | YES/NO | YES/NO | `[DML-LK-N]` if successor unlocked |

**Attack**: A `consuming` choice (e.g., a metadata update or partial action) archives the locked asset and creates a successor with `locked = False` (or omits the field, defaulting unlocked). The lock is silently erased and the asset is now freely movable. Verify every successor of a locked contract preserves the lock state.

## 4. Value-Conservation Across Lock/Unlock

The lock→unlock cycle must conserve the protected value and not double-count it.

| Lock Choice | Unlock Choice | Value Locked | Value Returned On Unlock | Conserved? | Finding? |
|-------------|---------------|--------------|--------------------------|------------|----------|
| `{choice}` | `{choice}` | `{amount}` | `{amount}` | YES/NO | `[DML-LK-N]` if mismatch |

**Check for** (R14):
- Unlock returns MORE than was locked (value inflation) or LESS (value loss).
- The locked asset is counted both in a `Locked` wrapper AND still in the original holder's balance (double-count).
- A unlock path reachable without the corresponding lock (mint-on-unlock), or a lock with no unlock (permanent loss / brick).

## Finding Template

```markdown
**ID**: [DML-LK-N]
**Severity**: [Critical if locked value moved/inflated, High if lock erased, Medium if liveness/double-count]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R8:✓/✗, R10:✓/✗, R14:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {Choice} ignores lock / erases lock on successor allows moving locked {asset}
**Description**: [The lock mechanism, the choice that bypasses or erases it, and the value path that breaks the invariant]
**Impact**: [Locked asset moved despite lock / lock silently cleared / value inflated or double-counted across lock cycle]
**PoC steer**: lock the asset, then `submit owner (exerciseCmd cid Transfer ...)` and assert it SUCCEEDS (bypass); or update-then-`query@T` the successor and assert `locked == False` (erase); or assert unlock value /= locked value (conservation).
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Lock-State Inventory | IF lock pattern present | ✓/✗(N/A)/? | Every lock field/wrapper and protected asset |
| 2. Lock-Honoring Audit | IF lockable template present | ✓/✗(N/A)/? | Every value-moving choice reads the lock |
| 3. Lock-Erase Audit | IF lockable template present | ✓/✗(N/A)/? | Every successor carries lock forward |
| 4. Value-Conservation Across Lock/Unlock | IF lock+unlock cycle present | ✓/✗(N/A)/? | Lock/unlock value parity, no double-count |
