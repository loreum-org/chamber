---
name: "choice-semantics"
description: "Trigger Pattern Always required for DAML audits - Inject Into Breadth agents, depth-state-trace, depth-edge-case"
---

# CHOICE_SEMANTICS Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits
> **Inject Into**: Breadth agents, depth-state-trace, depth-edge-case
> **Finding prefix**: `[DML-CHS-N]`
> **Rules referenced**: R8, R10, R12, R14

In DAML a "write" is a choice that archives a contract and creates a successor. The consume-mode of a choice determines whether the contract survives the exercise: a `consuming` choice (the default) archives the contract on the first exercise; a `nonconsuming` choice leaves it active. Misusing consume-mode is the DAML analog of double-spend: a value-moving choice marked `nonconsuming` can be exercised repeatedly on the same contract. Pre/postconsuming ordering bugs (self-`fetch` after archive), value-conservation gaps across split/merge/transfer, accumulator/cap drift across transactions, and cancel/abort paths that leave consequences un-unwound round out this class.

## 1. Consume-Mode Inventory

For EVERY choice, record its consume-mode and whether the action should be one-shot:

| Template.Choice | Consume-Mode | Moves Value / Mutates State? | Should Be One-Shot? | Mismatch? |
|-----------------|--------------|------------------------------|---------------------|-----------|
| `{T.C}` | consuming/nonconsuming/preconsuming/postconsuming | YES/NO | YES/NO | `[DML-CHS-N]` if nonconsuming + should-be-one-shot |

**Critical patterns to flag**:
- A `nonconsuming` choice that transfers, mints, splits, or withdraws value → exercisable repeatedly on the same active contract (`[ELEVATE:NONCONSUMING_REPLAY]`, double-spend).
- A `consuming` choice intended to be repeatable that archives the contract and strands its peers.

**DAML note**: A `consuming` choice archives the contract; a SECOND `exerciseCmd` on the same `ContractId` MUST fail with `CONTRACT_NOT_FOUND`. That failure REFUTES a double-spend claim for a consuming choice. Double-spend is only reachable when the value-mover is `nonconsuming` (or recreates an equivalent contract).

## 2. Pre/Postconsuming Ordering Trace

`preconsuming` archives BEFORE the body runs; `postconsuming` archives AFTER. A body that `fetch`es `self` (or `this` via key) behaves differently across the two.

| Template.Choice | Consume-Mode | Body Self-Fetch / Self-Exercise? | Reads Pre-Archive State? | Finding? |
|-----------------|--------------|----------------------------------|--------------------------|----------|
| `{T.C}` | pre/postconsuming | YES/NO | YES/NO | `[DML-CHS-N]` if ordering-dependent |

**Attack**: A `preconsuming` choice that fetches its own contract by key in the body gets `NO_SUCH_KEY`/`CONTRACT_NOT_FOUND` because the archive already happened — either a brick (liveness) or, if guarded by a `lookupByKey`, a silent wrong branch. A `postconsuming` choice that re-exercises a sibling assuming `self` is gone may double-act.

## 3. Successor-State Completeness

Each value-moving choice should produce successor contracts that conserve value and carry forward every invariant field.

| Template.Choice | Inputs (contracts/amounts) | Outputs Created | Conservation Check | Fields Carried Forward | Gap? |
|-----------------|----------------------------|-----------------|--------------------|------------------------|------|
| `{T.C}` | `{in}` | `{out}` | `out1.amt + out2.amt == in.amt`? | owner/lock/maintainer | `[DML-CHS-N]` if value created/destroyed or field dropped |

**Check for**:
- Split/merge where the sum of outputs ≠ input (value created or burned; rounding direction favors the caller) — R14 cross-variable conservation.
- A successor that drops a `locked`, `owner`, or `maintainer` field present in the predecessor (metadata/lock erase).
- An accumulator/cap field (`totalIssued`, `mintedSoFar`) that is NOT updated on the create path, so the cap is never enforced across transactions (`[ELEVATE:VALUE_CONSERVATION]`, R14).

## 4. Cancel / Abort Unwind

A choice that allocates or locks resources must unwind them on the cancel/abort/reject path.

| Template.Choice | Allocates/Locks On Success | Cancel/Reject Choice Exists? | Unwinds Allocation? | Finding? |
|-----------------|----------------------------|------------------------------|---------------------|----------|
| `{T.C}` | `{child created / asset locked}` | YES/NO | YES/NO | `[DML-CHS-N]` if no unwind |

**Attack**: A `Propose`/`Reserve` choice creates a child contract or locks an asset; the `Cancel`/`Reject` choice archives the proposal but leaves the child/locked asset active. The reserved value is stranded or double-counted. Verify the cancel path `archive`s every contract the success path created.

## Finding Template

```markdown
**ID**: [DML-CHS-N]
**Severity**: [Critical if double-spend/value-creation, High if conservation/lock-erase, Medium if liveness-only]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R8:✓/✗, R10:✓/✗, R12:✓/✗, R14:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {Choice} nonconsuming value-mover / value-conservation gap allows {double-spend / value inflation}
**Description**: [Consume-mode or conservation gap with the exact in/out amounts and the field or successor that breaks]
**Impact**: [Repeated exercise on same contract / value created or destroyed / stranded locked asset / cap unenforced]
**PoC steer**: exercise the same `ContractId` twice (nonconsuming double-spend), or assert `out1.amt + out2.amt /= in.amt`, or `query@T` a stranded child after cancel.
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Consume-Mode Inventory | YES | ✓/✗/? | Every choice, value-movers especially |
| 2. Pre/Postconsuming Ordering Trace | IF pre/postconsuming present | ✓/✗(N/A)/? | Every self-fetch/self-exercise |
| 3. Successor-State Completeness | YES | ✓/✗/? | Every split/merge/transfer + accumulator |
| 4. Cancel / Abort Unwind | IF allocate/lock-then-cancel pattern | ✓/✗(N/A)/? | Every reserve/propose with a cancel path |
