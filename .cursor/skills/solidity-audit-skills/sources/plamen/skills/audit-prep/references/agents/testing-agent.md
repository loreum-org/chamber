# Testing Agent — Phases 1 & 2

Read your bundle for: framework, project_dir, test file list, in-scope source file list.

## Phase 1: Test Coverage (15%)

### Step 1: Run coverage
- Foundry: `forge coverage 2>&1` (timeout 300s)
- Hardhat: `npx hardhat coverage 2>&1` (timeout 300s)

If successful, extract **per-contract** line and branch coverage percentages.
Report each in-scope contract as a separate FAIL or PASS line with its coverage numbers.
If it fails (missing deps, compile error, timeout), estimate from test file matching and note "estimated".

### Step 2: Match test files to source
Compare in-scope source files against test files. A source contract has coverage if a test file exists that imports or references it.

### Step 3: Compiler health
- Foundry: `forge build 2>&1 | grep -ci warning`
- Hardhat: `npx hardhat compile 2>&1 | grep -ci warning`

### Scoring
- Base score = average branch coverage % (or estimated coverage)
- If estimated: apply -10 confidence penalty
- Compiler warnings: -10 each (cap -30) — these MUST be fixed before audit
- Untested contracts (no matching test file): -15 each (cap -45)

### Coverage threshold
After computing score, check: if branch coverage < 90%, emit this FAIL:
```
FAIL | below_threshold | -0 | n/a
desc: Branch coverage XX% — audit requires minimum 90%
fix: Add tests to reach 90%+ branch coverage before scheduling audit
```
This is informational (no extra deduction — the low base score already penalizes) but signals the project is NOT audit-ready.

### Output:
Report each contract individually, then a total line:
```
PHASE 1 | Test Coverage | SCORE: 70/100

FAIL | below_threshold | -0 | n/a
desc: Branch coverage 70% — audit requires minimum 90%
fix: Add tests to reach 90%+ branch coverage before scheduling audit

FAIL | contract_coverage | -0 | src/core/Vault.sol
desc: Vault.sol — 45% line, 32% branch
fix: Add tests for deposit(), withdraw(), and edge cases

FAIL | no_coverage | -15 | src/libs/MathLib.sol
desc: No test file for MathLib (5 functions)
fix: Create test/MathLib.t.sol with unit tests

PASS | contract_coverage | src/core/Token.sol
note: Token.sol — 98% line, 95% branch

PASS | contract_coverage | src/core/Oracle.sol
note: Oracle.sol — 100% line, 100% branch

FAIL | compiler_warning | -10 | src/Token.sol:42
desc: Compiler warning: unused variable — must fix before audit
fix: Remove or use the declared variable

PASS | total_coverage
note: Overall: 70% line, 65% branch across 8 contracts

END PHASE 1
```

## Phase 2: Test Quality (15%)

Use Grep on test files. Do NOT read full test files into context.

### Grep checks (run in parallel):

| Check | Pattern | Path |
|-------|---------|------|
| Test count | `function test\|it\(["']` | test/ |
| Assertions | `assert\|expect\(\|vm.expectRevert\|vm.expectEmit` | test/ |
| Edge cases | `address\(0\)\|ZeroAddress\|type\(uint256\).max\|MaxUint256` | test/ |
| Negative tests | `revertedWith\|reverted\|vm.expectRevert\|should revert` | test/ |
| Integration | files matching `*Integration*\|*E2E*\|*Fork*` | test/ |
| Fuzz/invariant | `testFuzz_\|test_Fuzz\|invariant_\|fuzz` | test/ |

Compute: assertion_density = assertion_count / test_count.
Compute: negative_pct = negative_test_count / test_count * 100.

### Scoring
| Check | Condition | Deduction |
|-------|-----------|-----------|
| Edge cases | None found | -25 |
| Assertion density | < 2.0/test | -15 |
| Assertion density | < 1.0/test (replaces above) | -30 |
| Negative tests | < 20% of tests | -15 |
| Integration | None found, 3+ source contracts | -10 |
| Fuzz/invariant present | Found | +5 (cap 100) |

Fuzz/invariant tests are a bonus only — do NOT deduct points if absent. Many projects outsource fuzzing to auditors.

### Output:
```
PHASE 2 | Test Quality | SCORE: 60/100

FAIL | no_fuzz | -15 | n/a
desc: No fuzz/invariant tests — protocol has math-heavy DeFi logic
fix: Add testFuzz_ and invariant_ tests for math and state transitions

FAIL | assertion_density | -15 | n/a
desc: 1.4 assertions/test (157/112) — below 2.0 threshold
fix: Add more assert/expect to tests under 2 assertions

PASS | edge_cases
note: 23 edge case checks (address(0), max values)

PASS | negative_tests
note: 35% revert checks (39/112 tests)

END PHASE 2
```

## Constraints
- Use Bash and Grep only
- Do NOT read source .sol files
- Do NOT perform security analysis
- Structured output only — no prose or tables
