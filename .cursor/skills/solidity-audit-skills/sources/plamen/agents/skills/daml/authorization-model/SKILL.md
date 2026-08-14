---
name: "authorization-model"
description: "Trigger Pattern Always required for DAML audits - Inject Into Breadth agents, depth-state-trace, depth-external"
---

# AUTHORIZATION_MODEL Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits
> **Inject Into**: Breadth agents, depth-state-trace, depth-external
> **Finding prefix**: `[DML-AM-N]`
> **Rules referenced**: R4, R6, R12, R13

DAML's authorization model has no `msg.sender`. Authority flows through the transaction tree: the required authorizers of every node MUST be a subset of the parties who authorized the submission. A `create` requires the new contract's `signatory` parties; an `exercise`/`fetch` requires the choice's `controller` parties; an `archive` requires the signatories. Signatory authority propagates exactly ONE hop into a choice's consequences. The most common critical bug class is a choice whose controller is derived from a choice *argument* (privilege injection), or a choice that performs a privileged action with only one authorizer where joint authorization is required.

## 1. Choice-Authority Inventory

For EVERY choice in each template, record who must authorize it and what it does:

| Template.Choice | Consume-Mode | Controller Expr | Controller Source | Privileged Action? | Co-Auth Required? |
|-----------------|--------------|-----------------|-------------------|--------------------|-------------------|
| `{T.C}` | consuming/nonconsuming/pre/postconsuming | `{controller expr}` | FIXED-SIGNATORY / ARG-DERIVED / FETCHED | YES/NO | YES/NO |

**Critical patterns to flag**:
- A choice that moves value, changes ownership, or updates config but lists only ONE controller where the action affects multiple parties (single-where-joint → `[ELEVATE:MISSING_COAUTH]`).
- A `controller` expression that reads a field of the *choice argument* rather than a template signatory/fixed party (privilege injection → `[ELEVATE:PARAM_CONTROLLER]`, ALWAYS flag).

**DAML note**: `controller p` makes `p` the required authorizer AND an automatic observer. A controller derived from `arg.someParty` lets the caller name themselves as the authorizer — there is no `msg.sender` to constrain it.

## 2. Controller-Source Trace (privilege injection)

For each choice whose controller is NOT a fixed template signatory, trace where the controlling party comes from:

| Template.Choice | Controller Party Origin | Bound to Template Signatory? | Attacker Can Set It? | Finding? |
|-----------------|-------------------------|------------------------------|----------------------|----------|
| `{T.C}` | `arg.X` / `this.field` / `fetch(...).field` | YES/NO | YES/NO | `[DML-AM-N]` if attacker-settable |

**Attack**: If `controller` resolves from a value the caller supplies (choice argument, or a field of a contract the caller created), the caller authorizes their own privileged action. Compare against the intended authority from the AUTHORIZATION MATRIX in `attack_surface.md`.

**ARG-DERIVED controller is ALWAYS a finding candidate** — it must be proven safe (the arg is itself constrained by a prior signatory check) before it is dismissed.

## 3. In-Body Validation Enumeration

A correct controller does NOT replace in-body checks. Enumerate the validation each choice performs against its controller:

| Template.Choice | Controller | In-Body Check Present? | Check Expr | Sufficient? |
|-----------------|------------|------------------------|-----------|-------------|
| `{T.C}` | `{party}` | YES/NO | `assertMsg "..." (owner == ctl)` / NONE | YES/NO |

**Check for**:
- A choice that lets ANY party be the controller but then acts on `this.owner` without asserting `owner == controllingParty` (missing `owner == party`).
- A choice that updates a per-party balance/position but does not bind the controller to the affected party.
- Reliance on the controller alone where the choice consequences touch parties the controller should not be able to affect.

## 4. Guard / Whitelist / Flag Bypass

Enumerate every conditional that gates a privileged path:

| Template.Choice | Guard Expr | Guard Source | Bypassable? | Finding? |
|-----------------|-----------|--------------|-------------|----------|
| `{T.C}` | `when (paused == False)` / `elem p whitelist` | template field / arg / fetched | YES/NO | `[DML-AM-N]` if bypass |

**Patterns**:
- A flag (`paused`, `frozen`, `active`) read from a contract the caller can re-create with a forged value.
- A whitelist membership test against a list supplied as a choice argument rather than a signed template field.
- A guard short-circuited by an alternative choice on the same template that reaches the same consequence without the guard.

## 5. Fetch-Based Auth Bypass

A `fetch`/`fetchByKey` returns a contract that the choice may branch on for an authorization decision. If the fetched contract is not bound to a trusted signatory, the caller can forge it.

| Template.Choice | Fetched Template | Auth Decision On Fetched Field? | Fetched Contract Signed By Trusted Party? | Finding? |
|-----------------|------------------|----------------------------------|-------------------------------------------|----------|
| `{T.C}` | `{T2}` | YES/NO | YES/NO | `[DML-AM-N]` if unbound |

**Attack**: A choice fetches a `Config`/`Role`/`Approval` contract and grants access based on a field, but the caller can create that contract themselves (they are a signatory of it). The auth decision rests on attacker-controlled state. Verify the fetched contract's signatories include the party whose authority the decision relies on (`[ELEVATE:FETCH_AUTH]`).

## Finding Template

```markdown
**ID**: [DML-AM-N]
**Severity**: [Critical if value/ownership, High if config/co-auth, Medium if view-privileged]
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R4:✓/✗, R6:✓/✗, R12:✓/✗, R13:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {Choice} controller derived from argument / missing co-authorization allows unauthorized {action}
**Description**: [Specific authority gap with the controller expr, what the tx tree requires, and why the caller can satisfy it alone]
**Impact**: [What the unauthorized party achieves: takes a contract, moves value, becomes admin, bypasses a guard]
**PoC steer**: `submit attacker (exerciseCmd cid Choice with ...)` SUCCEEDS + harm assertion; a passing `submitMustFail` instead proves SAFETY (refutes).
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Choice-Authority Inventory | YES | ✓/✗/? | Every choice in every template |
| 2. Controller-Source Trace | YES | ✓/✗/? | Every ARG-DERIVED / fetched controller |
| 3. In-Body Validation Enumeration | YES | ✓/✗/? | owner==party and per-party binding |
| 4. Guard / Whitelist / Flag Bypass | IF guards present | ✓/✗(N/A)/? | Every privileged conditional |
| 5. Fetch-Based Auth Bypass | IF auth decision on fetched contract | ✓/✗(N/A)/? | Verify fetched signatory binding |
