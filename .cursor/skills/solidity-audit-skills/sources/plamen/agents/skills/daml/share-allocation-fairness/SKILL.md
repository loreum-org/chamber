---
name: "share-allocation-fairness"
description: "Trigger Pattern SHARE_ALLOCATION flag detected in pattern scan - Inject Into Breadth agents, depth-edge-case"
---

# SHARE_ALLOCATION_FAIRNESS Skill (DAML)

> **Trigger Pattern**: SHARE_ALLOCATION flag detected in pattern scan
> **Inject Into**: Breadth agents, depth-edge-case
> **Finding prefix**: `[DML-SAF-N]`
> **Rules referenced**: R5, R10, R13, R14

```
shares|allocation|distribute|pro_rata|proportional|split|merge|vest|
reward|cumulative|epoch|mint|burn|holding|units
```

## Purpose

Analyze fairness of share/asset allocation mechanisms on DAML where holders receive units proportional to deposits, contributions, or participation — checking for split/merge rounding loss, late-entry advantages, first/last-holder edge cases, and missing time-weighting. Pairs with LOCKING_SEMANTICS (a locked holding that can still be split/merged is both a fairness and a lock-bypass bug).

**DAML arithmetic constraint**: all share math uses `Int` or `Decimal` (fixed-point, 10 fractional digits) on template **fields**. No floating-point. Pro-rata and split/merge use multiply-then-divide integer/decimal patterns; division truncates toward zero. `Int`/`Decimal` THROW on overflow (a liveness brick, never a silent wrap). A "share" is a holding contract; minting = a choice that creates a holding, burning = a consuming choice that archives one.

---

## STEP 1: Classify Allocation Mechanism

Identify which pattern the protocol uses:

| Type | DAML Pattern | Key Risk |
|------|--------------|----------|
| Split / Merge | A consuming choice archives a holding and creates two (Split) or archives two and creates one (Merge) | Rounding loss or gain breaking value conservation; locked holding still splittable |
| Pro-rata snapshot | A holding created at a fixed ratio at deposit time | Late holders dilute earlier holders' accrued value |
| Time-weighted | A holding/per-holder contract tracks a `reward_index`/`accrued` field | Stale index, checkpoint manipulation across choices |
| Epoch-based | Allocation valued per ledger-time epoch field | Cross-epoch timing arbitrage at epoch boundaries |

---

## STEP 2: Split / Merge Value Conservation (PRIMARY DAML LANE)

For each split/merge/transfer choice:

| Choice | In Amount(s) | Out Amount(s) Formula | Conservation: out == in? | Rounding Direction | Finding? |
|--------|--------------|------------------------|--------------------------|--------------------|----------|

**Methodology — substitute and trace**:
- `Split` with `splitAmount`: do the two children sum EXACTLY to the parent (`child.amount + remainder.amount == parent.amount`)? With `Decimal` truncation, a formula like `parent * ratio` for one child and `parent - (parent * ratio)` for the other can drop or duplicate a unit.
- `Merge`: does the merged child equal the sum of inputs, or does a re-normalization lose value?
- **First-holder / zero-state**: split a holding of the minimum unit (1, or smallest `Decimal`). Does one child get 0 (truncation) while the parent is consumed → value destroyed? Does a zero-amount child even create (cross-reference ENSURE_INVARIANTS — is there `ensure amount > 0`)?
- **Last-holder / dust**: repeated splits leaving dust — does dust round to the protocol, to the holder, or get destroyed?
- **Max boundary**: a merge whose sum overflows `Int`/`Decimal` → the choice ABORTS → holders cannot merge → liveness brick.

Tag: `[BOUNDARY:splitAmount=1 -> child=0]`, `[VARIATION:Decimal truncation favors protocol on every split]`.

---

## STEP 3: Late Entry & Cross-Holder Attack Model

For each allocation entry choice:

1. **Identify accrual source**: what generates value for existing holders (fees collected into a pool contract, rewards distributed by a choice)?
2. **Trace timing**: when does accrued value become claimable vs when can a new holding enter? Is there a separate checkpoint choice?
3. **Time-weighting**: does allocation account for HOW LONG a holding was held (a `start_time`/`since` field compared to `getTime`), or only THAT it exists at distribution time?
4. **Model attack**: can a party create a holding AFTER value accrues but BEFORE distribution, capturing value it did not earn?

| Entry Choice | Accrual Source | Time-Weighted? | Late Entry Possible? | Impact |
|--------------|----------------|----------------|----------------------|--------|

**DAML timing**: ledger-time ordered; a timing attack requires landing a transaction in the ledger just before a known distribution choice.

### STEP 3c: Cross-Party Allocation Model

For each entry choice accepting an `owner`/`recipient : Party` that is NOT verified to be a `controller`/`signatory`:

| Entry Choice | Accepts recipient /= caller? | Default Field State for New Holding | Exploitable? | Impact |
|--------------|------------------------------|--------------------------------------|--------------|--------|

**Check**: when a new holding/per-holder contract is created for a recipient party:
- What are the DEFAULT field values (e.g. `reward_index = 0` while the global index is at N)? A new holder whose `reward_index` starts at 0 may be entitled to ALL historical rewards → late-entry variant → FINDING.
- Can `deposit owner amount` where `owner /= caller` create a per-holder contract that captures rewards the owner did not earn?
- Does the choice create a fresh contract (default fields) vs archive+recreate an existing one?

### STEP 3d: Pre-Setter Timing Model

For each admin-settable reward/rate field (a config template field changed by a choice):

| Setting Choice | Holding-Before-Set? | Retroactive Rewards? | Fair? |
|----------------|---------------------|----------------------|-------|

Model the sequence: holder created (with current index) → role sets reward rate → rewards accrue. Does the holder receive retroactive rewards for the period BEFORE the rate was set? Is the global index re-created atomically with the rate change (same transaction), or can a window exist?

---

## STEP 4: Redemption / Burn Symmetry

Check that entry and exit use consistent valuation:

1. **Mint vs burn ratio**: are units created at the same exchange rate they can be burned? Check the formula in both the create-holding choice and the redeem/burn choice.
   - With `Int`/`Decimal` math: does rounding in mint vs burn consistently favor one party? E.g. mint creates `floor(amount * total_units / total_value)` units; burn returns `floor(units * total_value / total_units)` — truncation may always favor the protocol.
2. **Pending claims**: can unclaimed reward holdings dilute active holders' value (rewards owed but still counted in a total)?
3. **Withdrawal ordering**: does redemption order create unfair priority (first to redeem gets full value; later redeemers face a depleted pool contract)?

**Mint-authority risks in DAML**:
- **Issuer over-mint**: if a holding's `signatory` is the issuer, the issuer can create additional holdings outside the deposit logic. Is minting gated to a single controlled choice, or can the issuer freely `createCmd`?
- **Archive/clawback**: can a privileged party archive (claw back) an individual holder's contract, denying redemption? FINDING if archival can target an individual holder without their authorization (cross-reference AUTHORIZATION_MODEL — a consuming/archive choice should require the holder's authority).

### STEP 4b: Aggregate Constraint Coherence (Rule 14)

For independently-settable allocation rates/weights (per-pool weight fields, fee splits, distribution percentages set by separate choices):

| Rate/Weight Setting Choice | Aggregate Constraint | Enforced On-Chain? | What if Sum Exceeds/Falls Short? |
|----------------------------|----------------------|--------------------|----------------------------------|

**DAML-specific**: if each weight is a separate contract field set by its own choice, the setting choice may archive+recreate ONE weight contract without reading and summing ALL of them to validate the aggregate. If the aggregate is not enforced and weights are independently settable → FINDING (Rule 14).

**Also check**: can a choice set a weight to 0 for an active pool? What happens to holders with deposits there (division-by-zero abort / zero allocation)? — Rule 14 setter regression.

---

## Output

For each finding, specify:
- Allocation mechanism type (split/merge, pro-rata, time-weighted, epoch)
- Whether time-weighting is present or missing
- Concrete attack sequence with a numerical `Int`/`Decimal` example
- Who benefits and who is harmed
- Whether the attack requires precise ledger ordering or is achievable with normal timing

---

## Finding Template

```markdown
**ID**: [DML-SAF-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see checklist below)
**Rules Applied**: [R5:___, R10:___, R13:___, R14:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: {Module}.daml:LineN (template X, choice Y)
**Title**: {fairness / conservation / late-entry violation type}
**Description**: {specific issue with an Int/Decimal numerical example}
**Impact**: {quantified at worst-state parameters — who loses how much}
**PoC steer**: split/merge Script asserting `out1 + out2 == parent.amount` (conservation), or a boundary Script splitting the minimum unit to show a 0-value child / destroyed dust, or a late-entry Script where a recipient created after accrual captures historical rewards.
```

---

## Step Execution Checklist (MANDATORY)

| Step | Required | Completed? | Notes |
|------|----------|------------|-------|
| 1. Classify Allocation Mechanism | YES | | |
| 2. Split / Merge Value Conservation | YES | | Primary DAML lane — first/last/dust boundaries |
| 3. Late Entry & Cross-Holder Attack Model | YES | | |
| 3c. Cross-Party Allocation Model | YES | | Check recipient /= caller defaults |
| 3d. Pre-Setter Timing Model | YES | | Model deposit-before-rate-set |
| 4. Redemption / Burn Symmetry | YES | | Include issuer over-mint + archive/clawback check |
| 4b. Aggregate Constraint Coherence | IF multiple settable weights | | Rule 14 enforcement check |

If any step skipped, document a valid reason (N/A, no split/merge, single pool, no settable weights).
