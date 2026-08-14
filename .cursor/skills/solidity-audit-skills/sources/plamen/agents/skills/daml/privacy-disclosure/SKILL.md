---
name: "privacy-disclosure"
description: "Trigger Pattern Always required for DAML audits - Inject Into Breadth agents, depth-edge-case"
---

# PRIVACY_DISCLOSURE Skill (DAML)

> **Trigger Pattern**: Always required for DAML audits
> **Inject Into**: Breadth agents, depth-edge-case
> **Finding prefix**: `[DML-PD-N]`
> **Rules referenced**: R10, R13

DAML enforces sub-transaction privacy: a contract is visible only to its **stakeholders** (signatories + observers), plus parties to whom it is **divulged** (incidentally disclosed when they participate in a transaction that `fetch`es it). An over-broad `observer`, divulgence through a shared transaction, or an interface `view` that exposes too much, all leak confidential state to parties who should not see it. STRICT GATE: a privacy finding is reportable ONLY with a party-scoped `query@T outsider` PoC steer that returns a non-empty result for a party who should see nothing. Disclosure-design prose without a `query@T` steer is NOT a finding — drop it.

## 1. Stakeholder-Set Inventory

For every template, enumerate exactly who can see each instance:

| Template | Signatories | Observers | Observer Source | Confidential Fields | Over-Broad? |
|----------|-------------|-----------|-----------------|---------------------|-------------|
| `{T}` | `{parties}` | `{parties}` | fixed / `arg.X` / list field | `{amount, counterparty, terms}` | `[DML-PD-N]` if observer sees secrets |

**Critical patterns to flag**:
- An `observer` set derived from a choice argument or a caller-supplied list → a party can add themselves as an observer of a contract carrying confidential terms (`[ELEVATE:OBSERVER_BROAD]`).
- An observer added "for convenience" (e.g., a market operator) who thereby sees per-party amounts/positions that should remain bilateral.

**DAML note**: `controller p` auto-adds `p` as an observer for the duration the choice is exercisable. A nonconsuming choice with a broad controller persistently discloses the contract to all those parties.

## 2. Divulgence-via-Fetch

Divulgence is incidental: when party X participates in a transaction that `fetch`es contract C, X learns C's contents even if X is not a stakeholder of C.

| Choice | Fetches Confidential Contract? | Transaction Participants | Non-Stakeholder Participant Sees It? | Finding? |
|--------|--------------------------------|--------------------------|--------------------------------------|----------|
| `{T.C}` | `{C}` | `{parties to the tx}` | YES/NO | `[DML-PD-N]` if non-stakeholder learns secrets |

**Attack**: A choice exercised by party A fetches a confidential `Position`/`Quote` belonging to B and includes A as a participant in the same transaction. A is divulged B's confidential contract even though A is not a stakeholder. Verify confidential contracts are not fetched into transactions involving parties who should not learn them (`[ELEVATE:DIVULGENCE]`).

**Note**: divulgence is transient (the divulged party learns the contents but does not gain authority), but the disclosure itself is the harm for confidential financial terms. Distinguish from persistent observer disclosure.

## 3. Interface View Over-Exposure

An interface `view` is computed from the underlying contract and visible to every party who can see the contract through the interface.

| Interface | view Fields Exposed | Underlying Confidential? | Viewer Set | Over-Exposure? |
|-----------|---------------------|--------------------------|------------|----------------|
| `{I}` | `{fields}` | YES/NO | `{parties}` | `[DML-PD-N]` if confidential field in view |

**Check for**:
- A `view` that surfaces a confidential field (amount, counterparty, internal id) to interface viewers who were not stakeholders of the underlying template.
- A view used as a "public summary" that leaks more than intended.

## 4. Choice-Observer Leakage

A choice's controllers/observers and the contracts it discloses in consequences can leak relationships.

| Template.Choice | Discloses (via create/observer) | To Whom | Should They See It? | Finding? |
|-----------------|---------------------------------|---------|---------------------|----------|
| `{T.C}` | `{child contract / disclosed field}` | `{parties}` | YES/NO | `[DML-PD-N]` if leak |

**Check for**:
- A choice that creates a child contract with an observer set wider than the parent's stakeholders, broadening disclosure each step.
- A consequence that discloses one party's existence/terms to another through shared observers.

## Finding Template

```markdown
**ID**: [DML-PD-N]
**Severity**: [High if confidential financial terms leak to a competitor/counterparty, Medium otherwise; cap per impact — NOT auto-downgraded as on-chain-only]
**Step Execution**: ✓1,2,3,4 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R10:✓/✗, R13:✓/✗]
**Location**: {Module}.daml:LineN (template X, choice/observer Y)
**Title**: Over-broad observer / divulgence-via-fetch / interface view exposes {confidential field} to {party}
**Description**: [The disclosure mechanism (observer source, fetch-in-shared-tx, or view field) and which party learns what they should not]
**Impact**: [Counterparty/competitor learns confidential amount, position, or relationship]
**PoC steer (MANDATORY)**: `outsider <- allocateParty "Outsider"; cids <- query @T outsider; assert (not (null cids))` — the outsider, who should see nothing, sees the confidential contract. For divulgence, query AFTER the divulging transaction.
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Stakeholder-Set Inventory | YES | ✓/✗/? | Every template's signatories + observers |
| 2. Divulgence-via-Fetch | IF fetch of another party's contract present | ✓/✗(N/A)/? | Every shared-tx fetch of confidential state |
| 3. Interface View Over-Exposure | IF interfaces with views present | ✓/✗(N/A)/? | Every view field vs underlying confidentiality |
| 4. Choice-Observer Leakage | YES | ✓/✗/? | Disclosure broadening across consequences |
