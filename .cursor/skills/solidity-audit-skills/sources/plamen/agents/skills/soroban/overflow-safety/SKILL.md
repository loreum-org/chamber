---
name: "overflow-safety"
description: "Trigger Pattern Always required for Soroban audits - Inject Into Breadth agents, depth-edge-case"
---

# OVERFLOW_SAFETY Skill (Soroban)

> **Trigger Pattern**: Always required for Soroban audits
> **Inject Into**: Breadth agents, depth-edge-case
> **Finding prefix**: `[OF-N]`
> **Rules referenced**: R10, R14

Soroban contracts are compiled Rust. Rust's overflow behavior depends on the build profile: in debug builds, overflows panic; in release builds (used for deployment), overflows silently wrap by default unless `overflow-checks = true` is set. Silent wrapping in financial arithmetic is a critical vulnerability.

## 1. Profile Check

Before tracing any arithmetic, inspect `Cargo.toml` for the release profile overflow setting:

| File | `[profile.release]` Present? | `overflow-checks` Setting | Safe? |
|------|------------------------------|--------------------------|-------|
| `Cargo.toml` | YES/NO | `true` / `false` / MISSING | Only if `true` |

**Interpretation**:
- `overflow-checks = true` → all integer arithmetic panics on overflow in release builds. The codebase is safe from silent wrapping.
- `overflow-checks = false` or missing → overflows silently wrap in release. **Proceed to Section 2.**
- If the file does not exist or does not contain `[profile.release]`: treat as `false` (Rust default for release).

**Finding threshold**: If `overflow-checks` is not `true`, the entire overflow safety of the contract depends on manual use of checked/saturating arithmetic. This is a configuration-level finding regardless of whether Section 2 finds specific overflow sites.

## 2. Arithmetic Trace (if `overflow-checks` is false/missing)

If the profile check from Section 1 found that overflow protection is NOT enabled, trace ALL arithmetic operations in financial paths:

| Location | Expression | Operand Types | Max Realistic Value | Overflow Possible? | Impact if Wrapped |
|----------|-----------|--------------|--------------------|--------------------|------------------|
| `{file:line}` | `{a + b}` | `u64 / i128 / u32` | `{estimate}` | YES/NO | `{balance wraps to 0, share inflates, etc.}` |

**Financial paths to prioritize**:
- Token balance calculations (`balance + amount`, `total_supply + mint_amount`)
- Share/ratio calculations (`shares * price / precision`)
- Fee calculations (`amount * fee_bps / 10000`)
- Interest accrual (`principal * rate * time`)
- Reward distributions (`rewards_per_token * user_balance`)

**Wrapping arithmetic consequences**:
- `u128` overflows near `2^128 ≈ 3.4 × 10^38` — practically unreachable for balances
- `i128` overflows near `2^127 ≈ 1.7 × 10^38` — practically unreachable for balances
- `u64` overflows near `1.8 × 10^19` — reachable with large token amounts in 6-decimal tokens
- `u32` overflows near `4.3 × 10^9` — reachable in ledger numbers, timestamps, counts

## 3. Checked Arithmetic Patterns

Identify all financial arithmetic and classify whether safe arithmetic methods are used:

| Location | Operation | Method Used | Safe? |
|----------|-----------|-------------|-------|
| `{file:line}` | `{description}` | `+` / `checked_add` / `saturating_add` / `wrapping_add` | Only `checked_*` or `saturating_*` |

**Safe methods**:
- `checked_add(b)` → returns `Option<T>`, panics or propagates None on overflow
- `checked_mul(b)` → returns `Option<T>`
- `saturating_add(b)` → clamps at MAX (safe for balances where MAX means "very rich")
- `checked_div(b)` → also catches division by zero

**Unsafe methods**:
- `+`, `-`, `*` without `overflow-checks = true` → silent wrapping in release
- `wrapping_add`, `wrapping_sub`, `wrapping_mul` → explicitly wraps (intentionally unsafe for most contexts)
- `/` → panics on divide-by-zero regardless of overflow-checks (covered in Section 5)

**Flag any unchecked arithmetic where**:
- Operands are user-controlled (amounts, durations, counts)
- The result feeds into a balance, share count, or reward calculation

## 4. i128 Boundary Analysis

Soroban's native token and SEP-41 tokens frequently use `i128` for amounts. Check operations near the boundaries:

| Location | Operation | Uses `i128`? | Near-Boundary Risk | Checked? |
|----------|-----------|-------------|-------------------|---------|
| `{file:line}` | `{expression}` | YES/NO | YES/NO | YES/NO |

**Specific checks**:
- Share calculations: `shares = (amount * total_shares) / total_assets` — if `total_shares` is near `i128::MAX`, multiplication overflows before division
- Cumulative reward trackers: `reward_per_token_stored += rewards * PRECISION / total_supply` — accumulation can overflow over time
- Negative balance checks: `i128` allows negative values; verify contracts reject negative amount parameters via explicit `require!(amount > 0)`
- Cast safety: `u128 as i128` silently truncates if the `u128` value exceeds `i128::MAX`

## 5. Division Precision

Soroban has no floating-point arithmetic. All division truncates toward zero (integer division). Incorrect division ordering causes precision loss or incorrect results:

| Location | Expression | Division-Before-Multiplication? | Precision Loss Estimate | Impact |
|----------|-----------|--------------------------------|------------------------|--------|
| `{file:line}` | `{a / b * c}` | YES → FLAG | `{up to b-1 units lost}` | `{financial impact}` |

**Anti-pattern** (division before multiplication):
```rust
// BAD: (amount / total_supply) loses precision before multiplying by rewards
let user_share = (user_balance / total_supply) * total_rewards;
```

**Correct pattern** (multiplication before division):
```rust
// GOOD: multiply first to preserve precision
let user_share = (user_balance * total_rewards) / total_supply;
```

**Additional checks**:
- Division by zero: verify all divisors are checked for zero before use. `require!(total_supply > 0)` before `x / total_supply`
- Rounding direction: does truncation favor the protocol (rounding down on user withdrawals) or systematically favor attackers?
- Precision constants: verify `PRECISION` / `SCALAR` constants match the token decimals being used
- Intermediate type precision: if the protocol routes values through a fixed-point intermediate (e.g., FixedI128 with DENOMINATOR=10^N), verify N >= max(token_decimals) for all supported tokens. Double decimal conversion (token A decimals → intermediate → token B decimals) truncates at each step; if the intermediate has fewer precision digits than either token, significant value is silently lost

## Finding Template

```markdown
**ID**: [OF-N]
**Severity**: [Critical if balance wrapping, High if unchecked overflow in financial path, Medium if precision loss, Low if config-only]
**Step Execution**: ✓1,2,3,4,5 | ✗(reasons) | ?(uncertain)
**Rules Applied**: [R10:✓/✗, R14:✓/✗]
**Location**: src/{contract}.rs:LineN (or Cargo.toml for Section 1)
**Title**: {Overflow / Precision loss} in {fn_name} — {impact}
**Description**: [Specific arithmetic expression, operand types, worst-case values, and wrapping consequence]
**Impact**: [Balance wraps to near-zero / share inflation / reward theft / incorrect accounting]
```

---

## Step Execution Checklist (MANDATORY)

| Section | Required | Completed? | Notes |
|---------|----------|------------|-------|
| 1. Profile Check | YES | ✓/✗/? | Read Cargo.toml `[profile.release]` |
| 2. Arithmetic Trace | IF overflow-checks not true | ✓/✗(N/A)/? | All financial paths |
| 3. Checked Arithmetic Patterns | YES | ✓/✗/? | All arithmetic in financial paths |
| 4. i128 Boundary Analysis | YES | ✓/✗/? | Wherever i128 used for amounts/shares |
| 5. Division Precision | YES | ✓/✗/? | All division operations in financial paths |
