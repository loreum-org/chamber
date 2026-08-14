---
name: "stableswap-compliance"
description: "Trigger STABLESWAP_FORK flag (fork-ancestry detects Curve/StableSwap parent via get_d/get_y/ramp_a/StableSwap patterns) - Agent Type general-purpose (standalone niche agent, 1 budget slot)"
---

# Niche Agent: StableSwap Compliance Audit

> **Trigger**: `STABLESWAP_FORK` flag in `template_recommendations.md` (fork-ancestry detects Curve/StableSwap as parent)
> **Agent Type**: `general-purpose` (standalone niche agent, NOT injected into another agent)
> **Budget**: 1 depth budget slot in Phase 4b iteration 1
> **Finding prefix**: `[SSC-N]`
> **Added in**: v1.1.6
> **Language**: All (Curve forks exist across EVM, Soroban, Solana, Move)

## When This Agent Spawns

Recon Agent 1B (Fork Ancestry) detects Curve/StableSwap as a parent protocol via patterns: `get_d|get_y|get_y_d|ramp_a|stop_ramp_a|StableSwap|stableswap|A_PRECISION|RATE_MULTIPLIER|admin_fee|get_virtual_price|calc_withdraw_one_coin|remove_liquidity_imbalance`.

If detected with confidence MEDIUM or HIGH, recon sets `STABLESWAP_FORK` flag. The orchestrator spawns this agent in Phase 4b iteration 1 alongside standard agents.

## Agent Prompt Template

```
Task(subagent_type="general-purpose", prompt="
You are the StableSwap Compliance Agent. You audit Curve/StableSwap fork correctness against the reference implementation.

## Your Inputs
Read:
- {SCRATCHPAD}/meta_buffer.md (fork ancestry analysis)
- {SCRATCHPAD}/findings_inventory.md (existing findings to avoid duplicates)
- {SCRATCHPAD}/function_list.md
- Source files containing get_d, get_y, get_y_d, ramp_a, deposit, withdraw

## Processing Protocol (MANDATORY)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity as a numbered list.
2. **PROCESS exhaustively**: Analyze each. Mark DONE or N/A(reason).
3. **COVERAGE GATE**: Count enumerated vs processed. Complete all before next CHECK.

## CHECK 1: Iterative Solver Convergence

For EACH function using Newton-Raphson or iterative root-finding (get_d, get_y, get_y_d, or similar):

| Function | Location | Max Iterations | Convergence Check? | Reverts on Non-Convergence? | Finding? |
|----------|----------|---------------|-------------------|---------------------------|---------|

**What to check**:
- Does the function verify the solution converged (difference < threshold)?
- If iteration limit exhausted without convergence, does it REVERT/PANIC or silently return the last (potentially incorrect) approximation?
- Curve reference: `assert converged` after the loop. Many forks drop this assertion.
- **Impact**: A non-converged result produces incorrect D/y values, leading to mispriced swaps, incorrect LP share calculations, or exploitable deposit/withdraw amounts.

Tag: `[BOUNDARY:iterations=MAX → d_prev-d={value}]` to prove non-convergence at specific inputs.

## CHECK 2: Amplification Parameter Encoding

Read the function that computes `ann` or the effective amplification:

| Location | Formula Used | Curve Reference Formula | Match? | Finding? |
|----------|-------------|------------------------|--------|---------|

**What to check**:
- Curve reference: `ann = A * N_COINS` where `A` is stored as `A * A_PRECISION` (i.e., `A * N_COINS^(N_COINS-1)`)
- Common fork bug: storing `A` as the raw amplification factor, then computing `ann = A * N_COINS` which produces a value `N_COINS^(N_COINS-1)` times too small
- Check `initialize()`: how is the `a` parameter stored? Raw value or pre-multiplied?
- Check `A()` / `get_a()`: does it return the stored value directly or divide by `A_PRECISION`?
- Check `ramp_a`: does the ramp target use the same encoding as `initialize`?
- **Impact**: Incorrect A encoding degrades capital efficiency. For N=2, the error is 2x. For N=3, the error is 9x. For N=4, the error is 64x.

Tag: `[VARIATION:A_encoding=raw vs A*N^(N-1) → pricing error={magnitude}]`

## CHECK 3: Reserve Decimal Normalization

For EACH multi-token pool that computes invariants (D, y):

| Pool | Tokens | Decimals per Token | Normalization Applied? | Curve Reference | Finding? |
|------|--------|-------------------|----------------------|----------------|---------|

**What to check**:
- Curve reference: `RATE_MULTIPLIER` or `PRECISION_MUL` normalizes all reserves to a common precision (typically 18 decimals) before invariant calculation
- Common fork bug: assuming all tokens have the same decimals (e.g., 7 on Stellar, 18 on EVM)
- Read the deposit/swap/withdraw functions: are raw token amounts passed to `get_d`/`get_y`, or are they normalized first?
- If no normalization: check if the pool creation validates that all tokens have identical decimals
- **Impact**: Without normalization, a pool with tokens of different decimals computes incorrect invariants. A 7-decimal token paired with an 18-decimal token would treat 1 unit of the 7-decimal token as equivalent to 1 unit of the 18-decimal token — a 10^11 pricing error.

Tag: `[VARIATION:decimals=7,18 → price_error={ratio}]`

## CHECK 4: Fee Application Consistency

For EACH fee-related computation in the StableSwap:

| Operation | Fee Formula | Curve Reference Formula | Match? | Rounding Direction | Finding? |
|-----------|-----------|------------------------|--------|-------------------|---------|

**What to check**:
- `admin_fee` encoding: does it match Curve's definition (fraction of the trading fee, not an absolute percentage)?
- Fee deduction in deposit: applied to the imbalance component, not the entire deposit?
- Fee deduction in withdrawal: symmetric with deposit fee application?
- `withdraw_admin_fees`: computed as `balance - reserves` (Curve pattern) or via internal tracking?
- `donate_admin_fees`: if present, can it be used to manipulate the exchange rate?

## CHECK 5: Known StableSwap-Family Footguns

StableSwap-invariant pools (the Newton-Raphson `D`/`y` design popularized by
Curve and now forked across many chains/languages) share a set of
historically exploited failure classes because they share the same
underlying math and lifecycle. Verify the fork addresses each class against
the canonical StableSwap invariant design, the same way you'd check
conformance against a written standard (e.g. ERC-20):

| Known Issue Class | Canonical Mitigation | Fork Has It? | Finding? |
|------------|---------------------|-------------|---------|
| Read-only reentrancy via a virtual-price / share-price view during an unfinished external call | view function guard or no callback re-entry into the price view | Check |
| Imbalanced-withdrawal fee bypass (`remove_liquidity`-style exits skipping the imbalance fee) | fee charged on deviation from a balanced withdrawal | Check |
| Amplification-ramp manipulation (A changed while positions are open, to move the invariant's price curve) | minimum ramp duration, maximum A change per ramp | Check |
| Admin/protocol fee accumulation causing exchange-rate drift between accounting and real reserves | periodic fee sweep or auto-donation reconciling accounting to reserves | Check |
| First-depositor share inflation via direct token transfer before any deposit | minimum liquidity lock or internal (non-balance-derived) accounting | Check |

## Output
- Maximum 8 findings [SSC-1] through [SSC-8]
- Use standard finding format from ~/.claude/rules/finding-output-format.md

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/niche_stableswap_compliance_findings.md

Return: 'DONE: {N} stableswap compliance findings - Check1: {A} convergence, Check2: {B} A-encoding, Check3: {C} decimals, Check4: {D} fees, Check5: {E} known vulns'
")
```
