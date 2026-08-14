---
name: "consensus-math-correctness"
description: "L1 trigger - audits consensus arithmetic for truncation, unused bounds, EMA direction, and threshold edge errors."
---

# Injectable Skill: Consensus Math Correctness

> **L1 trigger**: `CONSENSUS` flag AND (`adjust_difficulty` OR `difficulty_adjust` OR `ema` OR `moving_average` OR `reward_curve` OR `target_time` detected)
> **Inject Into**: `depth-consensus-invariant` or `depth-edge-case`
> **Language**: Go and Rust
> **Finding prefix**: `[CM-N]`

Consensus math bugs are small, deterministic, and load-bearing. They rarely need
fancy exploit chains: one wrong operator, one dead bound, or one flipped EMA
direction can permanently skew the chain.

## 1. Division-before-multiplication

For every expression of the form `(A / B) * C`, test whether `A < B` is
possible. If so, the intermediate division truncates to zero before the
multiplication and the protocol silently loses precision.

Questions:
1. Can `A < B` happen at runtime?
2. Is the intended formula mathematically `(A * C) / B`?
3. If multiplication moves first, is there an overflow guard on the wider
   intermediate?

Tag: `[CONSENSUS-MATH:DIV-FIRST]`

## 2. Declared-but-unapplied bounds

Consensus configs often declare bounds that never influence runtime math.

Questions:
1. Which config fields look like bounds or caps? Example names:
   `max_difficulty_adjustment_factor`, `min_reward`, `max_step_count`.
2. Is each field used only during config parsing, or also in the live
   computation?
3. If a field is declared but never applied at runtime, what unbounded state
   transition does that permit?

Tag: `[CONSENSUS-MATH:UNUSED-BOUND]`

## 3. EMA / moving-average direction

For each moving-average implementation, identify the prior sample, current
sample, and smoothing factor.

Questions:
1. Does the code use the same sample ordering as the design doc or comments?
2. Is the "previous" state actually previous, or has the implementation swapped
   current and prior inputs?
3. If the direction is flipped, does the chain overreact instead of smoothing?

Tag: `[CONSENSUS-MATH:EMA-DIRECTION]`

## 4. Threshold operators

Consensus edge cases often live at `threshold-1`, `threshold`, and
`threshold+1`.

Questions:
1. For every `>` / `>=` / `<` / `<=` gate in consensus math, what does the
   protocol text say should happen exactly at the threshold?
2. Does the implementation match that boundary?
3. What happens at `threshold-1`, `threshold`, and `threshold+1`?

Tag: `[CONSENSUS-MATH:BOUNDARY-OP]`

## 5. Ratio / fixed-point edge vectors

Difficulty and reward math often expresses "increase/decrease by X%" using
integer ratios or fixed-point factors. Enumerate the exact vectors:

| Input | Expected | Observed |
|---|---|---|
| no change | factor = 1.0 | |
| minimum decrease | factor just below 1.0 | |
| maximum decrease | e.g. 50% decrease | |
| maximum increase | configured cap | |
| denominator near zero | reject / clamp | |

Mandatory checks:

1. If a config field is named `max_*_adjustment_factor`, prove it clamps both
   upward and downward movement at runtime.
2. Test the exact human-readable boundary from docs/comments, not only random
   samples. If docs say "up to 50% decrease," test exactly 50%.
3. Check whether integer truncation prevents the boundary from ever being
   reached.
4. Check `>` vs `>=` at every clamp boundary.

Tag: `[CONSENSUS-MATH:RATIO-EDGE]`

## 6. Consensus floating point / platform dependence

If consensus math uses `f32`, `f64`, `log`, `log10`, `pow`, platform C math,
SIMD, CUDA, or FFI:

1. Determine whether the result affects any value that other nodes must agree
   on.
2. Check cross-platform determinism: Linux vs Windows, CPU vs GPU, feature
   flags, and architecture word size.
3. If a floating-point result is cast back into integer consensus state, emit a
   finding unless the implementation proves deterministic rounding.

Tag: `[CONSENSUS-MATH:NONDET-FP]`

## Output guidance

- Preferred evidence tags: `[CONFORMANCE-PASS]` > `[NON-DET-PASS]` >
  `[LSP-TRACE]` > `[CODE-TRACE]`
- Severity baseline: Medium, upgrade when the math directly affects consensus
  safety, liveness, or issuance economics

## Known class references

1. Consensus clients and SDKs have repeatedly removed floating-point or
   precision-sensitive arithmetic from state-machine code after divergence
   incidents.
2. Difficulty-adjustment and reward-curve bugs are historically dominated by
   truncation, unused bounds, and edge-threshold mistakes rather than complex
   exploit logic.
