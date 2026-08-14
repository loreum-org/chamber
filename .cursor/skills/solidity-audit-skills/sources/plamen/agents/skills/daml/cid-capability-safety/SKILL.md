---
name: "cid-capability-safety"
description: "Trigger Pattern Always required for DAML audits - Inject Into Breadth agents, depth-external, depth-edge-case"
---

# CID_CAPABILITY_SAFETY Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits
> **Inject Into**: Breadth agents, depth-external, depth-edge-case
> **Finding prefix**: `[DML-CC-N]`
> **Rules referenced**: R4, R8, R12

A `ContractId t` is a DAML-distinctive capability: holding one lets a party `fetch`/`exercise` the referenced contract. When a choice accepts a `ContractId` as an *argument*, that CID is attacker-chosen unless the body re-binds it to the operation. The four high-yield bug shapes: (1) caller-supplied CID not bound to the operation (caller passes a lookalike), (2) a config/whitelist CID that is missing → the choice **fails open**, (3) a hardcoded/stale config CID that has been archived → the choice **bricks**, (4) wrong-CID / type confusion via unchecked `fromInterfaceContractId` coercion.

## 1. Caller-Supplied CID Inventory

For every choice that takes a `ContractId` argument, determine whether the body binds it to the operation:

| Template.Choice | CID Arg | Fetched/Exercised? | Bound To Operation? | Binding Check | Finding? |
|-----------------|---------|--------------------|---------------------|---------------|----------|
| `{T.C}` | `cid : ContractId T2` | YES/NO | YES/NO | `assertMsg ... (fetched.owner == this.owner)` / NONE | `[DML-CC-N]` if unbound |

**Critical patterns to flag**:
- A choice that `fetch cid` and then acts on the fetched contract's fields without asserting the fetched contract relates to `this` (e.g., same owner, same asset, expected template) — caller passes any CID they can see (`[ELEVATE:CID_BINDING]`).
- A choice that exercises a caller-supplied CID to move value, with no check that the CID is the *intended* counterparty contract.

**DAML note**: `fetch cid` succeeds for ANY contract the exercising party is a stakeholder of (or that is divulged). There is no implicit "this is the right contract" guarantee — the body MUST assert the relationship.

## 2. Config / Whitelist CID Fail-Open

A choice that looks up a config or whitelist contract by CID and proceeds when it is absent fails open.

| Template.Choice | Config/Whitelist CID Source | Absent-Handling | Fail-Open? | Finding? |
|-----------------|-----------------------------|-----------------|------------|----------|
| `{T.C}` | arg / template field / key | proceeds / errors / default-permit | YES/NO | `[DML-CC-N]` if fail-open |

**Attack**: A choice intended to enforce a whitelist fetches a `Whitelist` contract and checks membership, but if the whitelist CID is not provided (or `lookupByKey` returns `None`), the code path skips the check and permits the action (`[ELEVATE:FAIL_OPEN]`). Verify the absent/None case DENIES, not permits.

## 3. Hardcoded / Stale Config CID Brick

A CID stored in a template field (or hardcoded) that points to a contract which can be archived creates a brick.

| Template.Field | Holds A CID? | Referenced Contract Archivable? | Update Path For The CID? | Brick Risk? |
|----------------|--------------|----------------------------------|--------------------------|-------------|
| `{T.f}` | YES/NO | YES/NO | YES/NO | `[DML-CC-N]` if no update path |

**Attack**: A long-lived contract stores a `ContractId Config` field. The referenced `Config` is archived/superseded; every choice that `fetch`es the stale CID now gets `CONTRACT_NOT_FOUND` and bricks, with no choice to update the field (`[ELEVATE:CID_BRICK]`). Verify either the referenced contract is non-archivable or there is an authorized update choice.

## 4. Wrong-CID / Type Confusion (interface coercion)

`fromInterfaceContractId` and `coerceContractId` reinterpret a CID as a different template/interface without runtime proof.

| Site | Coercion | Source CID Verified As Target Type? | fetch-after-coerce Guard? | Finding? |
|------|----------|--------------------------------------|---------------------------|----------|
| `{choice:line}` | `fromInterfaceContractId @T cid` | YES/NO | YES/NO | `[DML-CC-N]` if unverified |

**Attack**: A choice coerces an interface CID to a concrete template via `fromInterfaceContractId @T` and immediately acts, but the underlying contract is a *different* template implementing the same interface. The subsequent `fetch` may succeed against an unintended template, or the choice trusts fields that mean something different. Verify a `fetch` after coercion (which fails for the wrong template) OR an explicit type/field assertion guards the coercion.

## Finding Template

```markdown
**ID**: [DML-CC-N]
**Severity**: [Critical if value moved on forged CID, High if fail-open/brick, Medium if type-confusion needs setup]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R4:✓/✗, R8:✓/✗, R12:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: Caller-supplied ContractId unbound / fail-open config CID in {Choice} allows {forged-target / bypass / brick}
**Description**: [The CID argument or config CID, the missing binding/absent-handling, and the contract the attacker substitutes]
**Impact**: [Action against attacker-chosen contract / whitelist bypass / permanent brick / type-confused field read]
**PoC steer**: pass a lookalike CID the attacker created and assert harm; or archive the config contract and assert the brick (CONTRACT_NOT_FOUND); or omit the whitelist CID and assert the gated action still succeeds.
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Caller-Supplied CID Inventory | YES | ✓/✗/? | Every choice taking a ContractId arg |
| 2. Config / Whitelist CID Fail-Open | IF config/whitelist CID lookups present | ✓/✗(N/A)/? | Verify absent → deny |
| 3. Hardcoded / Stale Config CID Brick | IF a template field holds a CID | ✓/✗(N/A)/? | Verify update path exists |
| 4. Wrong-CID / Type Confusion | IF fromInterfaceContractId/coerceContractId used | ✓/✗(N/A)/? | Verify coercion is guarded |
