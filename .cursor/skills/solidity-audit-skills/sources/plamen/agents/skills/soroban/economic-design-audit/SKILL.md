---
name: "economic-design-audit"
description: "Trigger Pattern MONETARY_PARAMETER flag (fee, rate, emission, cap, bps values) - Inject Into Breadth agents (merged via M4 hierarchy)"
---

# ECONOMIC_DESIGN_AUDIT Skill (Soroban)

> **Trigger Pattern**: MONETARY_PARAMETER flag (required)
> **Inject Into**: Breadth agents (merged via M4 hierarchy)
> **Finding prefix**: `[EDA-N]`
> **Rules referenced**: R2, R10, R13, R14

```
rate|rebase|supply|burn|emission|inflation|peg|price_cap|price_floor|
fee|reward_rate|basis_points|bps|fee_bps|spread
```

**Soroban arithmetic context**: All numeric values use `i128` (signed 128-bit). No floating-point. Fee/rate formulas use integer multiply-then-divide. Overflow panics unless `checked_*` used; unchecked release-mode `i128` wraps silently. Division truncates toward zero.

---

## 1. Parameter Boundary Analysis

For every monetary parameter setter (rate, fee, reward rate, emission, cap, floor, BPS values):

| Parameter | Setter Function | Min Value | Max Value | Enforced? | Impact at Min | Impact at Max |
|-----------|----------------|-----------|-----------|-----------|---------------|---------------|

For each: substitute min and max into ALL consuming functions.
Tag: `[BOUNDARY:param=val -> outcome]`

**Soroban-specific boundary checks**:
- Does MAX cause `i128` overflow in multiply-then-divide? (`amount * rate_bps` overflows before division if both are large; check for `checked_mul`)
- Does 0 cause division-by-zero? (panic aborts entire transaction — verify `.checked_div()` or explicit guard)
- Does 10_000 BPS (100%) cause user to receive 0 tokens or go negative with fees-on-fees?
- Does a negative `i128` value cause unexpected behavior? (signed type allows negative rates if not bounds-checked)

---

## 2. Economic Invariant Identification

List all economic invariants the protocol must maintain:

| Invariant | Parameters Involved | Can Admin Break It? | Functions That Assume It |
|-----------|--------------------|-----------------------|--------------------------|

For each setter: can changing this parameter break an invariant that user-facing functions depend on? If yes → finding.

**Soroban-specific invariants**:
- **i128 conservation**: Total tracked must equal sum of individual claims. Verify no rounding loss accumulates across many users.
- **No negative balances**: `i128` allows negative values — if subtraction underflows without checked math, balance can go negative silently.
- **TTL-gated invariants**: If a key expires and returns `None`, `unwrap()` panics; `unwrap_or(0)` may silently break the invariant.

---

## 3. Rate/Supply Interaction Matrix

For protocols with multiple monetary parameters that interact:

| Parameter A | Parameter B | Interaction | Can A x B Produce Extreme Output? |
|-------------|-----------|-------------|----------------------------------|

Check: can two independently-valid settings combine to create an extreme economic state? (Rule 14 constraint coherence)

---

## 4. Fee Formula Verification at Normal Values

### 4a. Concrete Example Computation

Pick 3 representative fee rates and trace through the actual code formula:

| Fee Param | Value | Formula | Input Amount (i128) | Expected Output | Actual Output | Match? |
|-----------|-------|---------|---------------------|----------------|---------------|--------|

Tag: `[BOUNDARY:fee_bps={val} -> effective_rate={computed_rate}]`

**Note**: XLM uses 7 decimal places (1 XLM = 10_000_000 stroops). Verify formulas account for correct denomination.

**Red flags**:
- Gross-up formulas: `amount * MAX / (MAX - fee)` charges higher effective rate than `fee/MAX`
- Fee-on-fee: fee A's output feeds fee B's input — combined rate is not A + B
- Rounding direction: `i128` division truncates toward zero — verify intended direction
- Division order: `amount * rate / MAX` vs `amount / MAX * rate` — second loses precision for small amounts

### 4d. Fee-Base Consistency

For every fee computation, trace the base amount through ALL subsequent code paths:

| Fee Site | Base Amount Variable | Modified After Fee? | Modified How | Fee Recomputed? | Overcharge? |
|----------|---------------------|--------------------:|-------------|-----------------|-------------|

**Methodology**: Identify fee base variable → trace FORWARD → if variable reduced (capped, slippage-adjusted) AFTER fee computed → fee charged on larger base than processed.

### 4b. Fee Interaction Matrix

For protocols with multiple fee types:

| Fee A | Fee B | A Output Feeds B Input? | Combined Effective Rate | Independent Rate Sum | Discrepancy? |
|-------|-------|------------------------|------------------------|---------------------|-------------|

### 4c. Fee Impact on Share Price

If share-based accounting: does fee deduction change share price? Does it create deposit-vs-immediate-withdrawal spread? With `i128` rounding, does deposit vs withdraw favor one direction consistently?

---

## 5. Emission/Inflation Sustainability

For protocols with emission/inflation/reward distribution:

- Maximum emission rate over 1 ledger / 1 day / 1 year?
- Can emissions exceed reward vault's token balance?
- Supply cap? Can admin bypass it?
- What happens when reward vault depleted? (panic on `transfer`? zero rewards? proportional reduction?)

| Emission Parameter | Max Rate | Vault Balance Required | Ledgers to Depletion at Max | Cap Exists? |
|-------------------|----------|----------------------|---------------------------|-------------|

---

## 6. Resource Metering and Cost Economics

Soroban meters resources across CPU instructions, memory (bytes), and ledger I/O (entries read + written) — all per-transaction budgeted and network-configurable.

For batch operations (mass distributions, multi-user updates, bulk settlements):

| Operation | Ledger Entries Read | Ledger Entries Written | Memory Growth | Scales With N? | DoS via Large N? |
|-----------|--------------------|-----------------------|--------------|----------------|-----------------|

**Key cost considerations**:
- Persistent storage reads cost more than Instance — avoid iterating Persistent keys in hot paths
- Writing new ledger entries increases fees; if protocol absorbs cost, check for griefing
- TTL extension fees: `size_bytes * fee_rate * extension_ledgers` — unbounded extensions can drain operational budget
- Loops over Vec in Instance storage consume proportional CPU/memory — check for unbounded iteration

---

## 7. TTL Cost Economics (Soroban-Specific)

| Storage Entry | Storage Type | Current TTL Strategy | Who Pays to Extend | Risk if Expired |
|--------------|-------------|---------------------|-------------------|----------------|

**Checks**:
- Instance storage expiry → ALL `instance().get()` with `unwrap()` panic — contract unusable
- User's Persistent entry expires → position data archived; who pays restoration fee?
- Temporary storage (allowances, nonces) expiry → DoS on normal operations?
- Admin function for bulk TTL extension? Resource cost at max user count?
- Can attacker let entries expire to avoid obligations (debt, locked collateral)?

---

## Finding Template

```markdown
**ID**: [EDA-N]
**Verdict**: CONFIRMED / PARTIAL / REFUTED / CONTESTED
**Step Execution**: (see checklist below)
**Rules Applied**: [R2:___, R10:___, R13:___, R14:___]
**Severity**: Critical/High/Medium/Low/Info
**Location**: src/{file}.rs:LineN
**Title**: {parameter boundary violation / invariant break / economic unsustainability / TTL expiry DoS}
**Description**: {specific issue with code reference and numerical example using i128 values}
**Impact**: {quantified at worst-state operational parameters — Rule 10}
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Parameter Boundary Analysis | YES | | |
| 2. Economic Invariant Identification | YES | | |
| 3. Rate/Supply Interaction Matrix | IF >1 monetary param | | |
| 4. Fee Formula Verification at Normal Values | IF fee parameters detected | | |
| 5. Emission/Inflation Sustainability | IF emission/reward detected | | |
| 6. Resource Metering and Cost Economics | YES | | |
| 7. TTL Cost Economics | YES | | Soroban-specific — never skip |

If any step skipped, document valid reason (N/A, single parameter, no emissions, no TTL-sensitive keys).
