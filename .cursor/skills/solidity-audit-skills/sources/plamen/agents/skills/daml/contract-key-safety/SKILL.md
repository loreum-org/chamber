---
name: "contract-key-safety"
description: "Trigger Pattern Always required for DAML audits (self-skips if no template defines a key) - Inject Into Breadth agents, depth-state-trace"
---

# CONTRACT_KEY_SAFETY Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits — self-skip if no template defines a `key`
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[DML-CK-N]`
> **Rules referenced**: R8, R12

A DAML contract `key` is a uniqueness handle plus a `maintainer` set. The single most dangerous DAML key bug is the `lookupByKey` **false-None**: a `None` result means "no contract with this key is visible to the reading parties" — NOT "no such contract exists". A choice that treats `None` as "absent" and creates fresh state can mint duplicates. Additionally, `maintainer` parties MUST be signatories of the keyed contract; a maintainer/signatory gap breaks key authority. If no template in scope defines a `key`, this skill self-skips (every section `✗(N/A — no keyed templates)`).

## 1. Key + Maintainer Inventory

For every template that defines a `key`:

| Template | Key Type/Expr | Maintainer Expr | Maintainers ⊆ Signatories? | Key Globally Unique? | Finding? |
|----------|---------------|-----------------|----------------------------|----------------------|----------|
| `{T}` | `key (owner, id) : (Party, Text)` | `maintainer key._1` | YES/NO | YES/NO | `[DML-CK-N]` if maintainer not signatory |

**Critical patterns to flag**:
- A `maintainer` party that is NOT in the template's `signatory` set — DAML requires maintainers be signatories; if the code attempts otherwise it will not compile, but a refactor that drops a signatory while keeping the maintainer is a latent break. Verify the binding holds.
- A key whose maintainer set is a single party where the keyed value represents joint state (one party can unilaterally re-key).

**DAML note**: A negative `lookupByKey` (the `None` branch) requires the **maintainers'** authority to assert non-existence. If the reading party is not a maintainer, they cannot get an authoritative `None`.

## 2. lookupByKey False-None Audit

For every `lookupByKey`/`visibleByKey` call, determine what the `None` branch does and whether `None` is correctly interpreted:

| Choice | lookupByKey Target | None Branch Action | Reader Is Maintainer? | False-None Risk? |
|--------|--------------------|--------------------|-----------------------|------------------|
| `{T.C}` | `{key}` | creates fresh / treats as absent / errors | YES/NO | `[DML-CK-N]` if None→create and reader not maintainer |

**Attack**: A choice does `lookupByKey @T k` and, on `None`, creates a new `T`. If the exercising party is not a maintainer of `T`, `None` only means "not visible to me" — a contract with key `k` may already exist, signed by other parties. The caller mints a duplicate, breaking the uniqueness invariant (`[ELEVATE:LOOKUP_FALSE_NONE]`).

**Check for**:
- `None`-branch creates that are reachable by a party who is not a maintainer of the looked-up key.
- `None`-branch that grants access / resets a counter / re-initializes config assuming the key was never set.

## 3. exerciseByKey / fetchByKey Authority

`exerciseByKey`/`fetchByKey` require the maintainers' authority to resolve the key. Verify the exercising context actually has it:

| Choice | Uses exerciseByKey/fetchByKey? | Target Key | Maintainer Authority Present In Context? | Finding? |
|--------|-------------------------------|-----------|------------------------------------------|----------|
| `{T.C}` | YES/NO | `{key}` | YES/NO | `[DML-CK-N]` if authority gap |

**Check for**:
- A choice that `exerciseByKey`es a contract whose maintainers are not authorizers of the current transaction — it will fail at runtime (liveness brick) OR, if the maintainer happens to be a controller, may resolve a contract the caller should not reach.
- Authority assumed via the one-hop propagation rule that does not actually hold for the keyed target.

## 4. Stale-Key / Cleanup

A keyed contract that is archived without its key being freed (or recreated under a stale value) leaves dangling-key risk.

| Template | Archived By | Key Freed / Recreated Correctly? | Stale-Key Reachable? | Finding? |
|----------|-------------|----------------------------------|----------------------|----------|
| `{T}` | `{choice}` | YES/NO | YES/NO | `[DML-CK-N]` if stale |

**Check for**:
- A lifecycle where the keyed contract is archived but a consumer still `exerciseByKey`s the old key → `NO_SUCH_KEY` brick.
- A re-create that reuses an old key with stale field values, so a `lookupByKey` returns outdated state a later choice trusts.

## Finding Template

```markdown
**ID**: [DML-CK-N]
**Severity**: [Critical if duplicate mint / uniqueness break, High if liveness brick, Medium if stale read]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R8:✓/✗, R12:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: lookupByKey false-None / maintainer-authority gap in {Choice} allows {duplicate / brick / stale read}
**Description**: [The key, the None-branch action or maintainer gap, and why the reader's visibility ≠ existence]
**Impact**: [Duplicate keyed contract minted / uniqueness invariant broken / choice bricks / stale state trusted]
**PoC steer**: allocate a party that genuinely cannot see the keyed contract (not a maintainer/stakeholder), exercise the None-branch, assert a duplicate exists via a maintainer's `query@T`.
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Key + Maintainer Inventory | IF keyed templates present | ✓/✗(N/A)/? | Every template with a `key` |
| 2. lookupByKey False-None Audit | IF lookupByKey used | ✓/✗(N/A)/? | Every None branch |
| 3. exerciseByKey / fetchByKey Authority | IF exerciseByKey/fetchByKey used | ✓/✗(N/A)/? | Maintainer authority in context |
| 4. Stale-Key / Cleanup | IF keyed templates archived | ✓/✗(N/A)/? | Archive-then-lookup lifecycles |
