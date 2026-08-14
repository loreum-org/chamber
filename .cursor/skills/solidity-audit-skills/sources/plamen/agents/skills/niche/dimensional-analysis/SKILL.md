---
name: "dimensional-analysis"
description: "Trigger MIXED_DECIMALS flag (mulDiv/mulWad/rayMul + mixed scale factors detected) - standalone niche agent, 1 budget slot"
---

# Niche Agent: Dimensional Analysis

> **Trigger**: `MIXED_DECIMALS` flag in `template_recommendations.md` (detected when a fixed-point op AND any scale factor appear in the same scope. Fixed-point ops — EVM: `mulDiv|mulWad|divWad|rayMul|rayDiv|FullMath`; Rust/Move: `mul_div|mul_div_floor|mul_div_ceil|mul_div_wide`. Scale factors: `1e6|1e8|1eN|10**6|10**8|10^N|10 **|decimals()`)
> **Agent Type**: `general-purpose` (standalone niche agent, NOT injected into another agent)
> **Budget**: 1 depth budget slot in Phase 4b iteration 1
> **Language**: all (fixed-point arithmetic — Solidity/Vyper as well as Rust/Move fixed-point and integer-scaled math)
> **Finding prefix**: `[DA-N]`
> **Added in**: v1.1.0 (injectable), v1.1.1 (converted to niche agent)
> **Attribution**: The 4-phase dimensional analysis approach (vocabulary discovery, expression annotation, propagation tracing, validation) is adapted from Trail of Bits' dimensional-analysis plugin (https://github.com/trailofbits/skills, licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/). Changes: rewritten as a single-agent security audit methodology (vs ToB's 5-agent code annotation workflow); no code shared; different output format (security findings vs inline code comments); added common dimensions reference, algebra rules, rationalization rejection list, and disposition table.

## Why Niche Agent (Not Injectable)

Dimensional analysis has 4 sequential phases where each depends on the previous phase's output. As an injectable split across depth-token-flow and depth-state-trace, Phase 3 (propagation) could not access Phase 2 (annotation) output because they ran in separate agent contexts. A single niche agent holds the full vocabulary→annotation→propagation→validation chain in one context window.

## Agent Prompt Template

```
Task(subagent_type="general-purpose", prompt="
You are the Dimensional Analysis Agent. You systematically find unit/scale mismatches in fixed-point arithmetic that cause funds to be mispriced by orders of magnitude.

## Your Inputs
Read:
- {SCRATCHPAD}/state_variables.md (all state variables)
- {SCRATCHPAD}/function_list.md (all functions)
- {SCRATCHPAD}/findings_inventory.md (existing findings — avoid duplicates)
- Source files in scope (grep for arithmetic expressions)

## Common Dimensions Reference

| Name | Scale | Typical Usage |
|------|-------|---------------|
| WAD | 10^18 | Most ERC20 amounts, Solady/OZ math |
| RAY | 10^27 | Aave interest rates |
| BPS | 10^4 | Fee rates (1 BPS = 0.01%) |
| USDC/USDT | 10^6 | 6-decimal stablecoins |
| WBTC | 10^8 | 8-decimal tokens |
| Chainlink | 10^8 | Price feed answers (verify per-feed) |
| Q112.112 | 2^112 | Uniswap V2 TWAP cumulative prices |
| Q96 | 2^96 | Uniswap V3/V4 sqrtPriceX96 |

## Algebra Rules

Dimensions compose under arithmetic:
- `a * b`: output_dim = a_dim * b_dim. Output_scale = a_scale + b_scale.
- `a / b`: output_dim = a_dim / b_dim. Output_scale = a_scale - b_scale.
- `a + b` or `a - b`: BOTH operands MUST have identical dimension AND scale.
- `mulWad(a, b)` = `a * b / 1e18`: output_scale = a_scale + b_scale - 18.
- `mulDiv(a, b, c)` = `a * b / c`: output_scale = a_scale + b_scale - c_scale.
- `rayMul(a, b)` = `a * b / 1e27`: output_scale = a_scale + b_scale - 27.
- Dimensionless ({1}): ratios, percentages, multipliers. `{A} * {1} = {A}`.
- Cancellation: `{A} / {A} = {1}`.

## Processing Protocol (MANDATORY)

For each PHASE below, execute in order:
1. **ENUMERATE targets**: List every entity the phase applies to (expressions, variables, functions) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next phase.

## PHASE 1: Dimension Vocabulary Discovery

### 1.1 Scale Constant Inventory
Grep the in-scope source files (excluding test/, lib/, mocks/) for:
```
1e6, 1e8, 1e18, 1e27, 10**6, 10**8, 10**18, 10**27
10^6, 10^8, 10^9, 10^18, 1eN / 10^N (any other scale exponent)
WAD, RAY, BASE, UNIT, PRECISION, SCALE, DENOMINATOR
decimals(), DECIMALS, _decimals, 10 **
```

Build the vocabulary table:
| Constant | Numeric Value | Inferred Scale | Locations (file:line) |

### 1.2 Token and Feed Decimal Survey
| Asset/Feed | Decimals Source | Value | Dynamic? |

Red flag: `decimals()` called at runtime and used directly in arithmetic without caching — normalization must be correct at EVERY call site.

## PHASE 2: Expression Annotation

For EVERY fixed-point arithmetic expression (mulDiv, mulWad, divWad, rayMul, direct * / involving Phase 1 constants):

Write the inferred dimension for each operand:
```
// DA: price[USD/ETH, 8-dec] * amount[ETH, 18-dec] = [USD, 26-dec] <- needs / 1e8
uint256 value = price * amount;  // BUG if consumed as WAD
```

### Key Composition Checks
- `mulWad(a, b)`: BOTH operands MUST be 18-dec. If b is Chainlink (8-dec) -> result is 10^10x wrong.
- `mulDiv(a, b, c)`: output scale = (a_scale + b_scale - c_scale). Is that what the consumer expects?
- `a / 1e18`: correct only if a is WAD. If a is 8-dec Chainlink -> result is 10^10x too small.
- `mulWad(price, amount)` where price is Chainlink without `* 1e10` upscaling -> systematic undervaluation.

Update the Expression Disposition Table (from Phase 1) with the annotated scale for each expression.

## PHASE 3: Propagation Tracing

For each annotated expression from Phase 2:

### 3.1 State Variable Propagation
- Is the result stored in a state variable? Does the variable name imply a unit (e.g., priceWad)?
- Does the name match the actual computed unit? Mismatch -> [DA-N] candidate.
- Which functions READ this variable downstream? Do they assume the stored unit?

### 3.2 Cross-Function Boundary Checks
| Call Site | Value Passed | Caller's Scale | Callee's Assumed Scale | Mismatch? |

For each YES: trace to terminal impact (wrong transfer amount, wrong collateral ratio, wrong liquidation threshold).

Tag: `[TRACE: price[8-dec] stored as priceWad -> mulWad(priceWad, amount) -> 10^10x undervaluation -> withdrawal shortfall]`

### 3.3 Entry/Exit Normalization Gaps
- Token ENTRY (deposit, transferFrom): is amount normalized to internal scale?
- Token EXIT (withdraw, transfer): is internal value denormalized to token units?
- Are normalization constants hardcoded (fragile) or from decimals() (must verify)?

## PHASE 4: Validation and Severity

### 4.1 Rationalization Rejection List (MANDATORY before REFUTING any [DA-N])

| Rationalization | Why It Fails |
|----------------|-------------|
| 'The formula appears correct' | State the units explicitly — correct formula != correct units |
| 'All tokens use 18 decimals' | Verify per-token: USDC=6, WBTC=8, Chainlink=8 |
| 'Tests pass' | Test mocks may use 18 decimals; production tokens use 6 |
| 'Standard pattern used elsewhere' | The pattern may carry the same bug everywhere |
| 'The ratio cancels out' | Valid ONLY if BOTH numerator and denominator undergo identical scaling — prove it |

### 4.2 Severity Calibration
| Mismatch Magnitude | Asset Type | Severity |
|-------------------|------------|---------|
| 10^12 (6-dec vs 18-dec) | Token price / exchange rate | Critical |
| 10^10 (8-dec vs 18-dec) | Chainlink price in WAD context | High |
| 10^2 or less | Internal weights | Medium/Low |
| Any | View-only path | Low cap |

### 4.3 Boundary Substitution (MANDATORY per confirmed mismatch)
- `USDC_amount = 1e6` (1 USDC) as WAD input -> `mulWad(1e6, X) = X * 1e6 / 1e18 = 0` (rounds to zero)
- `chainlink_price = 1e8` ($1) as WAD -> 10^10 overstatement
- `MAX_UINT / 1e18` -> overflow check when mismatch inflates intermediate

Tag: `[BOUNDARY: USDC_amount=1e6 as WAD input -> mulWad rounds to 0 -> user receives nothing]`
Tag: `[VARIATION: token.decimals()=6->18 -> 10^12 collateral valuation change]`

### 4.4 Rounding-Direction Edge Cases (MANDATORY — class missed in a prior run)

Dimensional correctness alone is insufficient. Even when units align, a rounding-direction choice on small remainders can produce the same severity of loss as a decimal mismatch. For EVERY division / mulDiv / mulWad / rayMul / FullMath.mulDiv / fixedPointMath call, check BOTH: the correctness-direction (up or down) AND what happens at the minimum non-zero input where integer division truncates or ceils across a unit boundary.

**Ceil-round-up-on-small-remainder — a rounding-direction finding class**:
- Pattern: `fee = mulDivRoundUp(amount, feeBps, BPS_DENOM)` where `amount` is small enough that `amount * feeBps < BPS_DENOM`
- Dimensional result: `fee = 1 wei` (the ceiling of a fractional value < 1)
- Semantic result: `net = amount - fee = amount - 1`. For `amount == 1 wei`, `net == 0`, and the subsequent `transferFrom(net)` reverts OR sends zero — user's transaction fails at the dust boundary.
- Variant: floor-round-down on `reward = mulDiv(stake, rate, 1e18)` with small `stake`, same mechanism opposite direction — user receives 0 reward on dust stakes, protocol keeps the residual.
- Where it hits: deposit/withdraw dust; last-user-out drain paths; incentive claim loops iterating until `pending < minClaim`; refund-the-remainder paths.

**Check procedure (per rounding call)**:
1. Identify rounding direction: `mulDivRoundUp` / `mulDivRoundDown` / implicit truncation (`a / b`).
2. Enumerate inputs at: `amount = 1` (dust), `amount = BPS_DENOM - 1` (just-below boundary), `amount = BPS_DENOM` (boundary), `amount = BPS_DENOM + 1` (just-above).
3. Compute the rounded result at each input. If the rounded result crosses into `0`, `amount` itself, or any critical threshold (transfer-min, revert-condition), that is a finding.
4. Ask: can an external actor force the system to process inputs in the problematic range? For buy-and-burn accumulators, the answer is yes — attacker sprinkles 1-wei donations into an accumulation variable to force ceil-up on the denominator.

Tag: `[BOUNDARY: amount=1 wei + roundUp fee -> fee=1 wei -> net=0 -> transferFrom reverts]`.
Tag: `[VARIATION: round=floor @ amount < 1/rate -> reward=0 -> protocol keeps residual indefinitely]`.

Severity: if the boundary is reachable without privileged access and the user experiences a fund-affecting outcome (revert, lost residual, repeated drain), default Medium; upgrade to High if the residual compounds across many users or locks a meaningful fraction of TVL.

## Expression Disposition Table (MANDATORY — write FIRST, update per expression)

Write this skeleton table to {SCRATCHPAD}/niche_dimensional_analysis_findings.md BEFORE starting Phase 2.
Populate from Phase 1 inventory. Update each row as you annotate (Phase 2), propagate (Phase 3), and validate (Phase 4). PENDING rows at completion = workflow violation.

| # | Expression | Location | Operand Scales | Output Scale | Consumer Expected Scale | Mismatch? | Disposition | Finding ID |
|---|-----------|----------|---------------|-------------|------------------------|-----------|-------------|-----------|

Dispositions: PENDING -> SAFE (scales match at all consumers) | MISMATCH (finding created) | N/A (not arithmetic)

**Coverage assertion**: Before returning, verify every entity enumerated under each phase has been processed. Report enumerated vs analyzed counts in your return message.

## Output Format

Use standard finding format with [DA-N] IDs.

For each finding include:
- **Mismatch Type**: SCALE_MISMATCH / MISSING_NORMALIZATION / DOUBLE_NORMALIZATION / CROSS_BOUNDARY_ASSUMPTION
- **Concrete Values**: Numeric trace showing exact magnitude of error
- Depth evidence tags: [BOUNDARY:...], [VARIATION:...], [TRACE:...]

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/niche_dimensional_analysis_findings.md

SCOPE: Write ONLY to your assigned output file. Do NOT proceed to subsequent pipeline phases. Return your findings and stop.

Return: 'DONE: {N} expressions inventoried, {M} mismatches found, {S} safe, {P} pending (must be 0)'
")
```
