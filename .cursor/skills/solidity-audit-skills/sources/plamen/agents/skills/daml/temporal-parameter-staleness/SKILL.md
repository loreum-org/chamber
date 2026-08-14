---
name: "temporal-parameter-staleness"
description: "Trigger Pattern interval|period|duration|delay|cooldown|lock_period|timelock|deadline|maturity|expiry|getTime - Inject Into Breadth agents, depth-state-trace"
---

# TEMPORAL_PARAMETER_STALENESS Skill (DAML)

> **Trigger Pattern**: `interval|period|duration|delay|cooldown|lock_period|timelock|deadline|maturity|expiry|valid_until|getTime`
> **Inject Into**: Breadth agents, depth-state-trace
> **Finding prefix**: `[DML-TPS-N]`
> **Rules referenced**: R2, R8, R10, R13, R14

Cached parameters in multi-step (multi-transaction) operations become stale when an authority changes the source between steps. On DAML, time is read with `getTime : Update Time` inside a choice, returning **ledger time** (a record time the submitter does NOT choose; it is bounded by the transaction's ledger-time window). A deadline/duration is a template **field** (`Time` or a `RelTime`/`Int` of seconds); a value is "cached" when a choice copies a config field into a successor contract at Step 1, and Step N reads the cached copy instead of re-fetching the live config. There are no slots/epochs/blocks — time is the ledger `Time` value. This skill is the staleness/cross-transaction lens; ENSURE_INVARIANTS §4 is the single-choice deadline-enforcement boundary lens — cross-reference, do not duplicate.

---

## Step 1: Enumerate Multi-Step (Multi-Transaction) Operations

Find all operations that span multiple transactions, typically a Propose/Accept or initiate/complete pattern:

| Operation | Step 1 (Initiate) | Wait Condition | Step N (Complete) | Time Source |
|-----------|-------------------|----------------|-------------------|-------------|
| {op_name} | {Propose choice / create} | {deadline / cooldown} | {Accept / Complete choice} | `getTime` (ledger time) |

For each multi-step operation:
- What parameters/fields are read and copied into a successor contract at Step 1?
- What fields are re-fetched from the live config at Step N?
- What fields are USED at Step N but NOT re-fetched (cached, possibly stale)?
- **Is time read via `getTime` (ledger time) or taken from a caller-supplied `Time` argument?** A caller-supplied time lets the caller choose "now" — always a finding.

### DAML Time Semantics

| Source | Type | Who Controls | Notes |
|--------|------|--------------|-------|
| `getTime` | `Time` (in `Update`/`Script`) | Ledger (record time, within the tx ledger-time window) | The ONLY trustworthy "now" inside a choice |
| Caller-supplied `Time`/`RelTime` argument | choice argument | The submitting party | NOT trustworthy as "now" — the caller picks it |
| A `deadline : Time` field on a contract | template field | Whoever authorized the `create` | Only enforced if a choice compares it to `getTime` |

**Critical property**: within a single transaction (one choice and its consequences), all `getTime` calls return the same `Time` — there is no intra-transaction time variation. Multi-step time attacks require separate transactions.

---

## Step 2: Identify Cached Parameters

For each parameter used across steps:

| Parameter (field) | Source Contract | Copied Into (Step 1 successor) | Cached? | Authority-Changeable? (which choice) | Re-Fetched at Step N? |
|--------------------|-----------------|--------------------------------|---------|--------------------------------------|------------------------|

**DAML caching patterns**:
- **Snapshot into successor**: a Propose choice copies `config.feeRate`/`config.deadline` into the Proposal contract; Accept reads the Proposal's copy, not the live config.
- **Cached deadline**: a Proposal stores `deadline = addRelTime now period` computed at Step 1; if `period` later changes in config, the Proposal's deadline is stale.
- **Re-fetch pattern**: Step N does `cfg <- fetchByKey @Config ...` and reads live values — no staleness for those fields.

**Red flags**: a field is copied into the Step-1 successor AND an authority can change the source config AND Step N does NOT re-fetch the source.

---

## Step 3: Model Staleness Impact

For each cached parameter that can become stale:

```
Scenario A: Parameter INCREASES between steps
1. Party initiates at Step 1 — successor contract stores param = X
2. Authority exercises a setter choice: config param = X + delta
3. Party completes at Step N — uses cached X from the successor
4. Impact: {what happens with stale X when live config is X + delta}

Scenario B: Parameter DECREASES between steps
1. Party initiates at Step 1 — successor stores param = X
2. Authority setter: config param = X - delta
3. Party completes at Step N — uses cached X
4. Impact: {what happens with stale X when live config is X - delta}
```

**BOTH directions are mandatory** — increase and decrease often differ.

### DAML-Specific Staleness Vectors

| Vector | Description | Severity Modifier |
|--------|-------------|-------------------|
| **Stale snapshot in successor** | Proposal/initiate contract holds a copied config field; Accept never re-fetches the live config. | HIGH if it governs value movement; MEDIUM otherwise |
| **Cached absolute deadline** | `deadline` computed at Step 1 from a `period` that later changes; the Proposal's deadline no longer matches policy. | Medium if the deadline is safety-critical |
| **Caller-supplied time** | A choice compares against a `Time` passed as an argument instead of `getTime`. | High — the caller chooses "now", defeating the gate |
| **Config archived mid-operation** | The config contract a Step-N choice `fetch`es/`fetchByKey`es is archived between steps. | High — Step N aborts CONTRACT_NOT_FOUND / NO_SUCH_KEY (liveness brick) |
| **Retroactive rate-at-complete** | Step N reads the LIVE config rate (not the Step-1 snapshot), so an authority change retroactively alters all pending operations. | Medium–High depending on who is harmed |

---

## Step 3b: Update-Source Audit

For each parameter updated from another contract (a price/rate feed contract fetched in a choice):
- Is the source the correct representation of what this parameter tracks?
- **Is the source contract's identity validated?** Can a forged config/feed `ContractId` be substituted via a caller-supplied argument (cross-reference CID_CAPABILITY_SAFETY)?
- Should the parameter be fixed for a period (per epoch) rather than re-read every completion?
- Which choice updates it, who controls that choice, and what is the protocol state if it is never exercised (no refresh)?

---

## Step 4: Retroactive Application Analysis

For fee/rate/deadline fields that apply to existing in-flight state:

| Parameter (field) | Set By (choice) | Applies To | Retroactive? | Impact |
|-------------------|-----------------|-----------|--------------|--------|

**DAML retroactive patterns**:
- **Config setter**: an authority archives+recreates the config with a new `feeRate`. All pending completions that re-fetch the live config now use the new rate — retroactively changes returns for parties who initiated under the old rate.
- **Cooldown/period setter**: changing `cooldownPeriod` in config makes parties who already initiated wait longer/shorter — retroactive on in-flight Proposals (if Step N recomputes from live `period`).
- **Rate-at-complete pattern**: if Step N reads the live config field (not the Step-1 snapshot), any authority change between steps applies retroactively.

**Rule 2 direction check**: can the authority's change make a party-facing choice behave unexpectedly (e.g. setting `cooldownPeriod = 0` removes a withdrawal-delay protection; setting `maxWithdrawal = 0` blocks all withdrawals)? Does the change retroactively affect parties in active operations?

---

## Step 5: Assess Severity

For each staleness issue:
- **Who is affected?** (one party, all parties with pending operations, the protocol)
- **Is the impact bounded?** (capped by a field range, an `ensure`, a max delay)
- **Can it be exploited intentionally?** (authority times a setter to a specific ledger to harm a pending operation)
- **Is there a recovery path?** (cancel + re-initiate; an authority override choice)
- **Ledger precision**: how precisely can an attacker time exploitation relative to the deadline?

### Severity Assessment (Rule 10 — Worst-State)

Use worst realistic operational state:
```
Severity assessed at: pending_ops=MAX, rate_delta=MAX_RATE-MIN_RATE, value=$XX
Rationale: protocol designed for up to {N} concurrent pending operations per documentation
```

---

## Key Questions (must answer all)

1. What multi-step (multi-transaction) operations exist? (Propose/Accept, initiate/complete)
2. For each cached field: can an authority change the source between steps?
3. What happens if a delay DECREASES after initiation? (parties complete too early relative to new policy)
4. What happens if a delay INCREASES after initiation? (parties locked longer than expected)
5. Are fees/rates applied retroactively to in-flight operations, or only to new ones?
6. Is there a max field range bounding the staleness impact (an `ensure`)?
7. **DAML-specific**: does any time comparison use `getTime` (ledger time) or a caller-supplied `Time`?
8. **DAML-specific**: can the config contract a Step-N choice fetches be archived between steps (CONTRACT_NOT_FOUND / NO_SUCH_KEY brick)?
9. **DAML-specific**: is there a refresh/update choice for an external feed? What if it is never exercised?
10. **DAML-specific**: does a Step-1 snapshot vs Step-N re-fetch decision change which value (stale-cached vs retroactive-live) governs the outcome?

---

## Common False Positives

- **Immutable config**: if the config has no setter choice (or the setter's controller is revoked/governance), no staleness
- **Bounded ranges**: if an `ensure` limits the change magnitude, impact may be Low
- **Cancellable operations**: if parties can archive a pending Proposal and re-initiate, reduced severity
- **Two-step authority change**: if config changes themselves require a Propose/Accept delay, parties have time to react
- **Same-transaction operations**: choices completing in one transaction cannot have time staleness between steps
- **Re-fetch at completion**: if Step N re-fetches the live config (not a Step-1 snapshot), no staleness for that field

---

## Instantiation Parameters

```
{TEMPLATES}        - Templates to analyze
{MULTI_STEP_OPS}   - Identified multi-step (Propose/Accept) operations
{CACHED_PARAMS}    - Fields snapshotted into Step-1 successors
{AUTHORITY_PARAMS} - Authority-changeable config fields
{DELAY_PARAMS}     - Deadline/cooldown fields (Time / RelTime / seconds)
{FEE_PARAMS}       - Fee/rate fields that may apply retroactively
{TIME_SOURCE}      - getTime (ledger time) vs caller-supplied Time argument
```

---

## Output Schema

| Field | Required | Description |
|-------|----------|-------------|
| multi_step_ops | yes | Multi-transaction operations found |
| cached_params | yes | Fields snapshotted across steps (into which successor) |
| staleness_vectors | yes | How cached fields can become stale |
| retroactive_fees | yes | Fees/rates applied retroactively |
| time_source_audit | yes | getTime vs caller-supplied, and whether appropriate |
| config_archival_risks | yes | Config contracts that could be archived mid-operation |
| finding | yes | CONFIRMED / REFUTED / CONTESTED |
| evidence | yes | Code locations with line numbers |
| step_execution | yes | Status for each step |

---

## Finding Template

```markdown
**ID**: [DML-TPS-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: ✓1,2,3,3b,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R2:___, R8:___, R10:___, R13:___, R14:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {stale cached field / caller-supplied time / retroactive rate / config-archival brick}
**Description**: {which field is cached at Step 1, which authority changes it, why Step N is stale}
**Impact**: {quantified at worst-state — who is harmed by the stale/retroactive value}
**PoC steer**: multi-transaction Script — initiate (snapshot field), authority `submit` changes config, complete and assert the stale value governs (or the live value retroactively applies); for caller-supplied time, `submit` a past/future Time and show the gate passes; `passTime`/`setTime` for deadline windows.
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Enumerate Multi-Step Operations | YES | | |
| 2. Identify Cached Parameters | YES | | |
| 3. Model Staleness Impact (both directions) | YES | | |
| 3b. Update-Source Audit | YES | | |
| 4. Retroactive Application Analysis | YES | | |
| 5. Assess Severity | YES | | |

### Cross-Reference Markers

**After Step 2**: if cached fields are authority-changeable → MUST complete Step 3 with BOTH increase and decrease scenarios.
**After Step 3**: if any time comparison uses a caller-supplied `Time` instead of `getTime` → FLAG (the caller chooses "now").
**After Step 3b**: if the source config/feed is referenced by a caller-supplied `ContractId` → cross-reference CID_CAPABILITY_SAFETY.
**After Step 4**: cross-reference SEMI_TRUSTED_ROLES for the authority choices that change these fields, and ENSURE_INVARIANTS §4 for single-choice deadline enforcement.
