---
name: "economic-design-audit"
description: "Trigger Pattern MONETARY_PARAMETER flag (fee, rate, emission, cap, bps as template fields) - Inject Into Breadth agents (merged via M4 hierarchy)"
---

# ECONOMIC_DESIGN_AUDIT Skill (DAML)

> **Trigger Pattern**: MONETARY_PARAMETER flag (required)
> **Inject Into**: Breadth agents (merged via M4 hierarchy)
> **Finding prefix**: `[DML-EDA-N]`
> **Rules referenced**: R2, R10, R13, R14

```
rate|fee|reward_rate|emission|inflation|cap|limit|max_amount|basis_points|bps|fee_bps|spread|price|amount
```

**DAML arithmetic context**: monetary values are template **fields** typed `Int` or `Decimal` (`Decimal` = fixed-point, 10 fractional digits). There is no floating-point. A "setter" is a choice that archives a config/parameter contract and creates a successor with a changed field; a "consumer" is any choice/`ensure` that reads that field and branches. **Critical DAML difference: `Int`/`Decimal` THROW on overflow — they do not wrap.** So an economic boundary that overflows is a **liveness/brick** bug (the choice aborts, the path becomes un-exercisable), never a silent-value bug. Division truncates toward zero.

---

## 1. Parameter Boundary Analysis

For every monetary parameter (a config/parameter template field set by a choice — rate, fee, reward rate, emission, cap, floor, BPS):

| Parameter (Template.field) | Setting Choice | Min Value | Max Value | `ensure`-Enforced? | Impact at Min | Impact at Max |
|----------------------------|----------------|-----------|-----------|--------------------|---------------|---------------|

For each: substitute min and max into ALL consuming choices.
Tag: `[BOUNDARY:param=val -> outcome]`

**DAML-specific boundary checks**:
- Does MAX cause an `Int`/`Decimal` overflow in `amount * rate` BEFORE the division? An overflow ABORTS the choice → liveness brick (`[ELEVATE:ENSURE_GAP]`/boundary), not a wrap.
- Does 0 cause a division-by-zero? In DAML that ABORTS the transaction → verify a guard or `ensure` blocks zero.
- Does 10000 bps (100%) make the holder receive 0 (truncated) or, with fees-on-fees, push a successor's `ensure` to fail (`PreconditionFailed`)?
- Does a negative field value slip past a missing `ensure`? (`Int`/`Decimal` are signed; `ensure amount > 0.0` is the only guard.)

---

## 2. Economic Invariant Identification

List all economic invariants the protocol must maintain, and whether a setter choice can break them:

| Invariant | Parameters Involved | Can a Setter Choice Break It? | Choices That Assume It |
|-----------|---------------------|-------------------------------|------------------------|

For each setter: can creating a successor with a changed field break an invariant a consuming choice depends on? If yes → finding.

**DAML-specific invariants**:
- **Value conservation across split/merge/transfer**: total carried by all child contracts must equal the parent. Verify no rounding loss accumulates across many split operations (`Decimal` truncation).
- **No negative amounts**: only an `ensure amount >= 0.0` prevents a negative-amount contract entering the ACS; without it the create succeeds and every downstream choice trusts a broken invariant.
- **Accumulator/cap honored across transactions**: see Section 3 — this is the highest-yield DAML economic class.

---

## 3. Accumulator / Cap Coherence Across Transactions (R14 — PRIMARY DAML LANE)

DAML has no global mutable counter; a cap/total is itself a contract whose field is updated by a choice. The recurring bug: a value-creating choice does NOT update the accumulator contract, so the cap is never enforced across transactions.

| Cap/Total (Template.field) | Updated By (choices) | Read/Enforced By (choices) | Every Value-Creating Path Updates It? | Finding? |
|----------------------------|----------------------|----------------------------|---------------------------------------|----------|

**Check (R14 cross-variable + constraint coherence + setter regression)**:
- Is there a value-creating choice (mint/issue/Propose-Accept) that creates an asset contract but does NOT archive+recreate the cap/total contract to reflect it? → cap unenforced → unbounded issuance (`[ELEVATE:VALUE_CONSERVATION]`).
- Are two interacting limits (per-tx cap and global cap) settable by independent choices without a coherence check between them?
- Can a setter choice lower the cap field BELOW the already-accumulated total? What does the consuming `ensure`/guard do then (abort? lock out all holders?) — setter regression.
- Permissionless issuance: if the issuing choice's `controller` is non-privileged or argument-derived, a holder can inflate issuance past the cap (cross-reference AUTHORIZATION_MODEL).

---

## 4. Fee / Rate Formula Verification at Normal Values

### 4a. Concrete Example Computation

Pick 3 representative rate values and trace through the actual choice-body formula:

| Fee Param | Value | Formula | Input Amount | Expected Output | Actual Output | Match? |
|-----------|-------|---------|--------------|-----------------|---------------|--------|

Tag: `[BOUNDARY:fee_bps={val} -> effective_rate={computed}]`

**Note**: `Decimal` is fixed-point (10 fractional digits); verify the formula's scale matches the field's declared type.

**Red flags**:
- Gross-up: `amount * MAX / (MAX - fee)` charges a higher effective rate than `fee/MAX`.
- Fee-on-fee: one fee's output feeds another's input across chained choices — combined rate is not the sum.
- Rounding direction: `Decimal`/`Int` division truncates toward zero — verify the intended direction and that it does not let the protocol keep dust on every operation.
- Division order: `amount * rate / MAX` vs `amount / MAX * rate` — the second loses precision for small amounts.

### 4b. Fee-Base Consistency

For every fee computation, trace the base amount through ALL subsequent choice consequences:

| Fee Site (Template.Choice) | Base Field | Reduced After Fee? | How | Fee Recomputed? | Overcharge? |
|----------------------------|-----------|--------------------|-----|-----------------|-------------|

**Methodology**: identify the fee base field → trace FORWARD through the successor `create` → if the base is reduced (capped, adjusted) AFTER the fee is computed → fee charged on a larger base than processed.

### 4c. Fee Impact on Conservation

If a fee is taken during split/transfer: does `child1.amount + child2.amount + fee == parent.amount`? With `Decimal` truncation, does deposit-vs-withdraw rounding consistently favor one party? Cross-reference SHARE_ALLOCATION_FAIRNESS.

---

## 5. Emission / Inflation Sustainability

For protocols with emission/reward distribution via choices:

- Maximum amount mintable per transaction / per ledger-time period?
- Can cumulative emissions exceed a reward-pool contract's tracked balance (CONTRACT abort on transfer, or silent over-issuance if unchecked)?
- Is there a supply-cap contract? Can a choice bypass it (Section 3)?
- What happens when a reward-pool contract is exhausted — does the distribute choice abort (PreconditionFailed / NO_SUCH_KEY)?

| Emission Param | Max per Tx | Pool Balance Required | Txns to Depletion at Max | Cap Contract Exists? |
|----------------|-----------|------------------------|--------------------------|----------------------|

---

## Finding Template

```markdown
**ID**: [DML-EDA-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R2:___, R10:___, R13:___, R14:___]
**Severity**: Critical/High/Medium/Low/Info (Int/Decimal overflow is a LIVENESS finding, NOT auto-downgraded as silent-wrap)
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {parameter boundary / invariant break / cap-not-tracked / fee miscalculation}
**Description**: {specific issue with code reference and a numerical Decimal/Int example}
**Impact**: {quantified at worst-state operational parameters — Rule 10}
**PoC steer**: boundary-value Scripts (set field to 0 / max / negative and trace the consuming choice), or a multi-transaction Script that issues past a cap because the accumulator contract was not updated; assert conservation/cap violated, or the consuming choice aborts (liveness).
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Parameter Boundary Analysis | YES | | |
| 2. Economic Invariant Identification | YES | | |
| 3. Accumulator / Cap Coherence Across Transactions | YES | | R14 — primary DAML lane, never skip |
| 4. Fee / Rate Formula Verification | IF fee/rate parameters detected | | |
| 5. Emission / Inflation Sustainability | IF emission/reward detected | | |

If any step skipped, document a valid reason (N/A, single parameter, no fees, no emissions, no cap).
