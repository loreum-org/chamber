---
name: "semi-trusted-roles"
description: "Trigger Pattern operator/admin/manager parties listed as signatory or controller, authority-gated choices - Inject Into Breadth agents, depth-state-trace"
---

# SEMI_TRUSTED_ROLES Skill (DAML)

> **Trigger Pattern**: operator/admin/manager/registrar party as `signatory` or `controller`, authority-gated choices beyond pure parameter-setting
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[DML-STR-N]`
> **Rules referenced**: R2, R6, R10, R13

```
operator|admin|manager|registrar|issuer|guardian|custodian|controller|signatory|authority
```

**DAML role context**: there are no role modifiers. A "role" is a `Party` that appears as a `signatory` and/or as a `controller` of privileged choices. Authority is held by holding that party's submission rights; a choice's required authorizers are its `controller` parties (AND-joined), a `create`/`archive` requires the contract's `signatory` parties. An operator/admin party is therefore SEMI_TRUSTED: trusted to act within its choices, but its key may be compromised and its actions must be analyzed bidirectionally (R6) — what it can do TO users, and what users can do to exploit/grief it.

---

## Step 1: Inventory Role Permissions

In `{TEMPLATES}`, find every choice whose `controller` includes `{ROLE_PARTY}` (operator/admin/etc.), and every template where `{ROLE_PARTY}` is a `signatory`. For each:
- Which `(Template, field)` does the choice's consequence `create`/`archive` (i.e. what state does it write)?
- Does the choice `exercise` another template's choice (one-hop authority propagation)?
- Parameters accepted from the caller (especially a caller-supplied `ContractId` or party)?
- Consume-mode (`consuming`/`nonconsuming`/`pre`/`postconsuming`)?

| Choice (Template.Choice) | Controller | Consume-Mode | (Template,field) Written | Exercises Other Templates | Caller Params |
|--------------------------|-----------|--------------|--------------------------|---------------------------|---------------|

**Auth patterns**: `controller operator`, `controller issuer, operator` (joint), `signatory operator` (operator co-signs every successor), choice that re-`fetch`es a contract and branches on a field the operator controls.

---

## Step 2: Analyze Within-Scope Abuse (Direction 1 — role harms users)

For each permitted action, ask:

**Timing Abuse** (ledger-time ordered, no public mempool):
- Can the role exercise a choice at a harmful time (before a user's `query`-driven action, just before a deadline)?
- Can the role DELAY a choice (skip a settlement/registration crank) to harm users?

**Parameter Abuse**:
- Can the role pass a harmful value (inflated amount, wrong `newOwner`, attacker-controlled `ContractId`)?
- Are caller parameters validated in the choice body (`assertMsg`, `ensure` on the successor), or trusted implicitly?
- Can the role supply a forged config/whitelist `ContractId` the choice does not bind to a trusted issuer?

**Sequence / Omission Abuse**:
- Can the role exercise choices out of order (accept before propose, settle before finalize)?
- Can the role harm users by NOT exercising (never registering, never unlocking, never distributing)? Is there a recovery path if the role stops?

---

## Step 3: Model Attack Scenarios

```
Scenario A: Authority-Timing Attack
1. {ROLE_PARTY} observes a user's pending action via on-chain ACS state
2. {ROLE_PARTY} submits role_choice() to land in a prior/same ledger
3. ACS changes before the user's transaction commits
4. Impact: {TIMING_IMPACT}
Note: no public mempool; ordering is ledger-time / submission based.

Scenario B: Parameter / Forged-CID Attack
1. {ROLE_PARTY} exercises {ROLE_CHOICE} with {MALICIOUS_PARAMS} (amount, recipient, or a lookalike ContractId)
2. Choice body does not validate against {EXPECTED_CONSTRAINTS} / does not bind the CID to the trusted issuer
3. Impact: {PARAM_IMPACT}

Scenario C: Key Compromise
1. {ROLE_PARTY}'s submission key is compromised
2. Attacker can exercise: {ROLE_CHOICES} and co-sign as signatory on: {SIGNATORY_TEMPLATES}
3. Maximum extractable / corruptible state: {MAX_DAMAGE}
4. Recovery: is there a choice to rotate/replace {ROLE_PARTY}? If the role is a hardcoded signatory, rotation may be impossible.
```

---

## Step 4: Assess Mitigations

- Is the role action gated by a propose/accept two-step (multi-transaction) flow rather than a single unilateral choice?
- Is `{ROLE_PARTY}` a single party or a joint `controller` (AND of multiple parties, the DAML analog of multisig)?
- **Does a rotation/replacement choice EXIST?** If the role is a `signatory` baked into live contracts, replacing it may require re-creating every contract. If NO rotation path → FINDING: authority irrevocable. Min Medium if the role can mutate user-held contracts.
- Rate limits / caps tracked across transactions (accumulator template)?
- If the role is also a maintainer of a `key`, note: maintainers MUST be signatories — compromise of the maintainer party affects key uniqueness too.

**DAML patterns**: Propose→Accept (`OperatorProposal` create + `Accept` choice), joint `controller a, b`, an `Admin` contract whose `signatory` is a governance party.

---

## Step 5: Model User-Side Exploitation (Direction 2 — R6, MANDATORY)

**Predictability Analysis**:
- Is the role's behavior predictable (a published schedule, a state-triggered crank, a queue)?
- Can users observe via the ACS when the role will act?
- Can users submit to land before the role in ledger order?

```
Scenario D: User Exploits Role Timing
1. User observes {ROLE_PARTY} exercises {ROLE_CHOICE} when {CONDITION} holds in the ACS
2. User submits a transaction to land before the role's
3. User benefits from the known impending state change. Impact: {USER_EXPLOIT_IMPACT}

Scenario E: User Griefs Role Preconditions
1. {ROLE_CHOICE} requires ACS state: {PRECONDITION} (a contract present, a key resolvable, an ensure satisfiable)
2. User archives/alters a contract the role's choice fetches, or creates a key-collision the role's lookupByKey trips on
3. Role's choice aborts (CONTRACT_NOT_FOUND / PreconditionFailed); protocol enters a degraded state. Impact: {GRIEF_IMPACT}

Scenario F: User Forces Suboptimal Role Action
1. User shapes ACS state so the honest role's policy chooses a harmful branch
2. Impact: {SUBOPTIMAL_IMPACT}

Scenario G: Stale State via Discrete Role Updates
1. A rate/config contract is only re-created when {ROLE_PARTY} exercises {UPDATE_CHOICE}
2. User acts at the stale rate, role updates, user exits. Impact: {RATE_ARBIT_IMPACT}
```

---

## Step 6: Precondition Griefability Check

For each choice controlled by `{ROLE_PARTY}`:

| Choice | Preconditions (fetched contract / resolvable key / ensure) | User Can Manipulate? | Grief Impact |
|--------|-----------------------------------------------------------|----------------------|--------------|

**DAML griefing**: Can a user archive a contract the role's choice `fetch`es (CONTRACT_NOT_FOUND abort)? Can a user create a contract whose `key` collides / makes the role's `lookupByKey` return a stale or false-None result? Can a user inflate an accumulator/queue contract so the role's iterating choice aborts?

---

## Step 6b: Privileged-Choice Griefability (EXHAUSTIVE)

Enumerate ALL authority-gated choices:

| Choice | Authority (controller/signatory) | Preconditions | User Can Manipulate? | Grief Impact |
|--------|----------------------------------|---------------|----------------------|--------------|

**Completeness check**: Total authority-gated choices: {N}, analyzed: {M}. If M < N → analyze the missing ones.

**DAML-specific checks**:
- Can users create contracts that block a role's bulk cleanup/migration (one archive per contract → unbounded)?
- Can in-flight Propose/Accept contracts block a role action (a pending proposal the role must resolve)?
- Can a user archive a precondition contract just before the role's `exercise`, causing CONTRACT_NOT_FOUND?
- Can an unsolicited contract created with the role as `observer`/`signatory` bloat the role's view or force consent?

---

## Common False Positives

- **Pure read / nonconsuming view choices**: no abuse vector
- **Idempotent choices**: timing abuse limited
- **User-initiated dependency**: role acts only after the user proposes first — front-running may not apply
- **Joint controller already present**: a choice already `controller a, b` is not single-where-joint
- **Fully-trusted governance party**: if the project's trust table marks the party FULLY_TRUSTED, apply the −1 trusted-actor tier modifier (do NOT apply it to semi-trusted operator/admin)

---

## Finding Template

```markdown
**ID**: [DML-STR-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see below)
**Rules Applied**: [R2:___, R6:___, R10:___, R13:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {what the role party can do to users / what users can exploit or grief}
**Description**: {specific abuse vector with code reference — which controller/signatory, which unvalidated parameter}
**Impact**: {quantified damage at worst-state parameters — Rule 10}
**PoC steer**: `submit roleParty (exerciseCmd ...)` succeeds with harmful state (Direction 1), or user `submit`/archive griefs the role's precondition so its choice aborts (Direction 2); `submitMustFail` proves a guard holds.
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Inventory Role Permissions | YES | | Controller + signatory choices |
| 2. Analyze Within-Scope Abuse | YES | | |
| 3. Model Attack Scenarios (A, B, C) | YES | | |
| 4. Assess Mitigations | YES | | Rotation/replacement choice exists? |
| 5. Model User-Side Exploitation (D, E, F, G) | **YES** | | **MANDATORY (R6)** — never skip |
| 6. Precondition Griefability Check | **YES** | | **MANDATORY** — never skip |
| 6b. Privileged-Choice Griefability | **YES** | | **MANDATORY** — never skip |

### Cross-Reference Markers

**After Step 4**: DO NOT STOP HERE — Steps 5-6 analyze the reverse (R6) direction.
**After Step 5**: Cross-reference with CHOICE_SEMANTICS for value-bearing role choices and CID_CAPABILITY_SAFETY for role choices accepting a caller-supplied `ContractId`. IF the role's actions are time-predictable → document ledger-ordering vectors.
**After Step 6**: IF any precondition is user-griefable → severity >= MEDIUM. Document the protocol degradation timeline if the role is blocked indefinitely.
**After Step 6b**: IF the role iterates over user-creatable contracts → check for unbounded iteration / abort.

### Output Format for Step Execution
```markdown
**Step Execution**: ✓1,2,3,4,5,6,6b | (no skips for this skill)
```
