---
name: "ensure-invariants"
description: "Trigger Pattern Always required for DAML audits - Inject Into Breadth agents, depth-edge-case"
---

# ENSURE_INVARIANTS Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits
> **Inject Into**: Breadth agents, depth-edge-case
> **Finding prefix**: `[DML-EI-N]`
> **Rules referenced**: R10, R12, R14

A template's `ensure` clause is its creation precondition: a `create` whose `ensure` is `False` throws `PreconditionFailed` and the contract never exists. A missing or weak `ensure` lets an invalid contract enter the ACS (negative amount, empty party list, inconsistent fields), and every downstream choice then trusts the broken invariant. Separately, DAML `Int`/`Decimal` arithmetic THROWS on overflow rather than wrapping — so an arithmetic boundary is a **liveness/brick** bug (the choice aborts and becomes un-exercisable), not a silent-wrap value bug. The PoC for this class is a set of boundary-value `Script ()` functions (min / 1 / negative / max / empty-list), Aptos-style.

## 1. Ensure-Clause Inventory

For every template, record its `ensure` and the invariants it should enforce:

| Template | `ensure` Expr | Invariants It Should Enforce | Gap? |
|----------|---------------|------------------------------|------|
| `{T}` | `amount > 0.0 && obs /= []` / NONE | amount positive, parties non-empty, fields consistent | `[DML-EI-N]` if invariant unguarded |

**Critical patterns to flag**:
- No `ensure` at all on a template carrying an amount/balance/cap → a negative or zero amount contract is creatable (`[ELEVATE:ENSURE_GAP]`).
- An `ensure` that guards some fields but not the security-critical one (e.g., checks `amount > 0` but not `amount <= cap`, or not `maintainer non-empty`).
- An invariant assumed by a choice (`this.amount > 0`) that the `ensure` does not actually establish.

**DAML note**: `ensure` runs on `create` only. A choice that recreates a successor re-runs the successor's `ensure`; if the successor template has a weaker `ensure`, the invariant degrades across the lifecycle.

## 2. Boundary Substitution

For each ensure-guarded and arithmetic-bearing field, substitute boundary values and trace the outcome:

| Template/Choice | Field/Expr | Value Substituted | Outcome | Finding? |
|-----------------|-----------|-------------------|---------|----------|
| `{T / T.C}` | `amount` / `a + b` | 0 / 1 / -1 / maxInt / [] | created-invalid / abort / wrong-branch | `[DML-EI-N]` if invalid creatable or reachable abort |

**Substitute and trace**:
- `amount = 0` and `amount = -1`: does the contract create? Does a split produce zero-value children?
- `a + b` where both near `maxInt`/Decimal max: does the choice ABORT (`ArithmeticError`)? A reachable abort on a user path is a liveness brick (`[ELEVATE:ENSURE_GAP]` / boundary).
- empty list (`[]`) where a non-empty list is assumed (signatories, observers, maintainers): does `ensure`/the choice handle it, or does a later `head`/index abort?

## 3. Cross-Create Consistency

When several choices create instances of the same template, verify they all establish the same invariant.

| Template | Created By (choices) | All Paths Satisfy Same Invariant? | Weakest Path | Finding? |
|----------|----------------------|-----------------------------------|--------------|----------|
| `{T}` | `{choice list}` | YES/NO | `{choice}` | `[DML-EI-N]` if one path creates weaker state |

**Check for**:
- One creation path that bypasses a check another path enforces (asymmetric creation).
- An accumulator/cap that one creating choice updates but another does not, so the cap is enforced inconsistently (R14).

## 4. Deadline / Temporal-Gate Enforcement

A deadline is only enforced if a choice actually compares it against `getTime`.

| Template.Choice | Deadline Field | Compared Against `getTime`? | Comparison Relation | Enforced? |
|-----------------|----------------|------------------------------|---------------------|-----------|
| `{T.C}` | `{deadline}` | YES/NO | `< / <= / >` | `[DML-EI-N]` if deadline never enforced |

**Check for** (`[ELEVATE:DEADLINE_UNENFORCED]`):
- A `deadline`/`maturity`/`expiry` field stored but never read in any choice's guard → the time gate is decorative.
- A comparison against a caller-supplied time argument instead of `getTime` (ledger time) — the caller chooses "now".
- Off-by-one relation (`>=` vs `>`) letting an action happen exactly at/after expiry when it should not.

## Finding Template

```markdown
**ID**: [DML-EI-N]
**Severity**: [High if invalid state corrupts value/cap, Medium if liveness brick or unenforced deadline; Int/Decimal overflow is a LIVENESS finding, NOT auto-downgraded as silent-wrap]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R10:✓/✗, R12:✓/✗, R14:✓/✗]
**Location**: {Module}.daml:LineN (template X)
**Title**: Missing/weak ensure / unenforced deadline on {Template} allows {invalid contract / reachable abort}
**Description**: [The missing precondition or unenforced gate, the boundary value that breaks it, and the downstream choice that trusts the broken invariant]
**Impact**: [Invalid contract enters ACS / arithmetic abort bricks a user path / deadline bypass / cap unenforced]
**PoC steer**: boundary-value Scripts — `boundaryMin/boundaryNeg/boundaryMax : Script ()` calling a shared helper; assert create-invalid SUCCEEDS (ensure gap) or the choice aborts (ArithmeticError, liveness) or the past-deadline action SUCCEEDS (unenforced).
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Ensure-Clause Inventory | YES | ✓/✗/? | Every template's ensure vs its invariants |
| 2. Boundary Substitution | YES | ✓/✗/? | 0 / 1 / -1 / max / empty-list per field |
| 3. Cross-Create Consistency | IF template created by 2+ choices | ✓/✗(N/A)/? | All creation paths same invariant |
| 4. Deadline / Temporal-Gate Enforcement | IF deadline/expiry field present | ✓/✗(N/A)/? | Compared against getTime, correct relation |
