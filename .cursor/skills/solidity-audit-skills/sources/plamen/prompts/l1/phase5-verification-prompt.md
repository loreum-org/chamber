# Phase 5: L1 Verification Prompt

> **Usage**: Orchestrator reads this file and spawns L1 verifier agents with these prompts.
> **Differences from smart-contract verification**: The smart-contract verifier in `rules/phase5-poc-execution.md` assumes Foundry/Anchor/cargo-test harnesses and produces `[POC-PASS]` as the primary mechanical evidence tag. L1 mode introduces additional evidence tags and a hypothesis-type-based routing strategy because consensus bugs have no Foundry equivalent.

## Evidence Tags (L1 mode)

| Tag | Meaning | Weight | Applies to |
|---|---|---|---|
| `[POC-PASS]` | Native test harness test passes (cargo test, go test) | 1.0 (mechanical) | single-function bugs with unit-test scope |
| `[DIFF-PASS]` | Differential test between fork and upstream produced different output for same input | 1.0 (mechanical) | fork audits, semantic drift |
| `[DIFF-SAME]` | Differential test produced same output → refutes drift claim | 0.0 | fork audits |
| `[CONFORMANCE-PASS]` | Spec conformance test (Hive, execution-spec-tests, ICS-23 vectors) reports failure | 1.0 | spec-defined behavior |
| `[NON-DET-PASS]` | Ran implementation 2× with same input, got different output → confirms non-determinism | 1.0 | consensus / state transitions |
| `[FUZZ-PASS]` | Fuzzer (libfuzzer, go-fuzz, proptest, D2PFuzz) produced counterexample | 1.0 | mechanically fuzzable surfaces |
| `[LSP-TRACE]` | Manual trace performed using SCIP/LSP type info and call hierarchy | 0.7 | when mechanical proof is infeasible |
| `[CODE-TRACE]` | Manual trace with concrete values, no LSP assistance (last resort) | 0.6 | fallback only |

**Scoring rule**: `[CODE-TRACE]`-only evidence caps the finding verdict at CONTESTED. `[LSP-TRACE]` supports CONFIRMED at Medium severity or below; Critical / High findings require at least one mechanical-evidence tag (POC, DIFF, CONFORMANCE, NON-DET, FUZZ, or MEDUSA).

## Verification Flow Per Hypothesis Type

Each hypothesis is routed based on its bug class (from the skill that produced it):

### Fork-diff findings (bug class: cross-environment-semantic-drift, cross-client divergence)
Preferred verification: **`[DIFF-PASS]`** via differential test harness.

Workflow:
1. Clone parent upstream at the reference tag
2. Identify the specific function / opcode / precompile that diverges
3. Construct a test input that exercises the divergent path
4. Run the input against both implementations (target fork + upstream)
5. Compare outputs
6. If outputs differ → `[DIFF-PASS]` + CONFIRMED
7. If outputs match → `[DIFF-SAME]` + REFUTED

Falls back to `[LSP-TRACE]` if the upstream cannot be built on the audit machine.

### Non-determinism findings (bug class: non-determinism, consensus-safety-invariants Section 1)
Preferred verification: **`[NON-DET-PASS]`** via repeated execution.

Workflow:
1. Isolate the suspect function
2. Construct an input that reaches the non-deterministic code path (map iteration, time source, etc.)
3. Call the function 100 times with identical input
4. Hash the outputs; check if all 100 hashes match
5. If any two differ → `[NON-DET-PASS]` + CONFIRMED
6. If all match → `[NON-DET-SAME]` + test the next input class

Note: the test must run in a realistic environment (multiple goroutines, realistic map size). A single-threaded single-entry map may happen to iterate deterministically by chance.

### Consensus invariant findings (bug class: consensus-safety, fork-choice, validator-lifecycle)
Preferred verification: **`[CONFORMANCE-PASS]`** against published spec tests.

Workflow:
1. Identify the protocol spec (Ethereum beacon chain, CometBFT ABCI, etc.)
2. Locate the published conformance test suite (ethereum/consensus-spec-tests, execution-spec-tests, Hive, cosmos/ibc-test)
3. Run the relevant test category against the target
4. If a test fails where the spec requires it to pass → `[CONFORMANCE-PASS]` + CONFIRMED

Falls back to `[LSP-TRACE]` if no spec test exists for the specific invariant.

### Network DoS / pre-auth findings (bug class: p2p-dos-and-eclipse, mempool-asymmetric-dos)
Preferred verification: **`[FUZZ-PASS]`** via D2PFuzz, proptest, or a hand-written fuzz harness.

Workflow:
1. Identify the entry point function
2. Write a libfuzzer / go-fuzz / proptest harness that feeds random bytes to the function
3. Run for 5 minutes or 1M iterations, whichever comes first
4. If the harness crashes, times out, or OOMs → `[FUZZ-PASS]` + CONFIRMED
5. Record the crashing input for the finding report

For pre-auth panic findings specifically: a single crashing input is sufficient proof. No need to run longer.

### Light-client proof findings (bug class: light-client-proof-verification)
Preferred verification: **`[CONFORMANCE-PASS]`** against ICS-23 / SSZ test vectors + manual construction of a forgery.

Workflow:
1. Use the proof spec's test vectors to confirm the baseline works
2. Hand-construct an invalid proof that exercises the specific bypass
3. Feed it to the target verifier
4. If accepted → `[CONFORMANCE-PASS]` on the forgery + CONFIRMED
5. If rejected → the specific bypass does not exist; re-verify the finding's claim

### RPC / execution findings (bug class: rpc-surface-audit, execution-client-hardening)
Preferred verification: **`[POC-PASS]`** via the target client's native test harness.

Workflow:
1. Write a `go test` / `cargo test` that spins up the RPC server or VM
2. Feed the crafted input
3. Assert the claimed impact (panic, wrong output, unbounded allocation)
4. Mechanical test passes → `[POC-PASS]` + CONFIRMED

### BLS / crypto findings
Preferred verification: **`[CONFORMANCE-PASS]`** against published BLS test vectors from the IETF BLS draft + differential against a reference (py_ecc).

## Fallback protocol

If no mechanical verification is feasible for a hypothesis (no spec tests, no harness, no reference implementation):

1. Use SCIP `find_definition` + `find_references` to trace every call path
2. Document each step of the trace with file:line
3. Tag as `[LSP-TRACE]`
4. **Cap severity at HIGH** — Critical findings cannot rest on LSP-TRACE alone. Escalate Critical LSP-TRACE findings to CONTESTED and flag for human review.


## Force-by-Default Skip Justification (MANDATORY)

`STRUCTURAL_NO_EXECUTABLE_HARM_ASSERTION` is NOT a valid skip for a finding with a
concrete Material Harm (fund/state/privilege/liveness/accounting/consensus-safety
delta). The default is to FORCE a proof in the form the bug class supports — a
`unit`/`property` PoC where the harm is a single-node assertion, else the class's
own harness (`[DIFF-PASS]` differential, `[NON-DET-PASS]` non-determinism,
`[FUZZ-PASS]` fuzz, `[CONFORMANCE-PASS]` spec-conformance). A skip requires citing
a SPECIFIC blocker from the closed taxonomy in
`~/.claude/rules/phase5-poc-execution.md` § "Force-by-Default Skip Justification" —
`FULLY_TRUSTED_DESIGN`, `DEPLOY_OR_TX_ORDERING`, `EXTERNAL_DEP_NO_FORK`,
`LIVE_ARTIFACT_REQUIRED`, `SPEC_DOCS_NO_STATE_DELTA`, or a `REFUTED` verdict — with
a code-grounded justification. A forced attempt that genuinely cannot assert the
harm records `[CODE-TRACE]` plus the named blocker, NOT `[POC-FAIL]`. (L1 note: a
harm that genuinely needs a 2nd client or a live testnet — not runnable here —
records `[CODE-TRACE]` + `EXTERNAL_DEP_NO_FORK`/`LIVE_ARTIFACT_REQUIRED`, never a
generic structural dodge.)

## PoC Attempt Protocol (Thorough/Core — MANDATORY for poc_class: unit|property)

> **v2.4.0**: Testability classification is computed mechanically by the Python driver.
> Each queue row now includes a `PoC Class` column: `unit`, `property`, `integration`, or `structural`.
> This protocol is MANDATORY for `unit` and `property` class findings in Thorough mode,
> and for Critical/High `unit` findings in Core mode.

### Available Test Infrastructure

Read `{SCRATCHPAD}/test_infrastructure.md` for this project's:
- Working build/test commands
- Test constructors (mock builders with signatures)
- Representative test patterns to crib from
- Dev-dependencies (proptest, fuzzing tools)

If `test_infrastructure.md` does not exist, fall back to grepping for `#[test]` / `_test.go` patterns in the source tree. Do NOT skip the PoC attempt solely because the infrastructure file is missing.

### For poc_class: unit (panics, unwraps, arithmetic, validation)

1. Write a `#[test]` or `#[should_panic]` function targeting the specific bug
2. Use test constructors from `test_infrastructure.md` for setup (avoid building state from scratch)
3. Compile: `cargo test -p {CRATE} --no-run 2>&1 | tail -20` (or `go test -c ./... 2>&1`)
4. Execute: `cargo test -p {CRATE} test_{FINDING_ID} -- --nocapture 2>&1 | head -50`
5. If PASS → `[POC-PASS]`, paste output
6. If COMPILE ERROR → read error, fix once, retry. After 2 compile failures → document error, fall back to `[CODE-TRACE]`
7. If TEST FAILS (assertion wrong) → **enter Assertion Retry Protocol** (see below)

### For poc_class: property (non-determinism, state corruption, invariant)

1. Write a proptest or 100-iteration loop test targeting the invariant
2. Use test constructors for state setup
3. Compile and run: `cargo test -p {CRATE} test_prop_{FINDING_ID} -- --nocapture`
4. If counterexample found → `[NON-DET-PASS]` or `[POC-PASS]`
5. If no counterexample in 100 iterations → `[CODE-TRACE]` with documented attempt
6. If assertion fails (invariant holds when you expected violation) → **enter Assertion Retry Protocol**

### Assertion Retry Protocol (MANDATORY for unit/property on assertion failure)

> **Purpose**: Distinguish "test setup was wrong" from "bug doesn't exist" with ONE retry.
> This prevents both false `[POC-FAIL]` (real bug, bad test) AND false `[POC-PASS]` (forced pass via weakened assertion).

When your test's assertion FAILS (the system behaves correctly, contradicting the finding):

**Step 1: Self-diagnosis (no code yet)**

Ask yourself:
- Did I test the EXACT function at the EXACT location from the finding?
- Did my setup create the EXACT preconditions described in the finding? (Not a simplified version)
- Is my assertion testing the CLAIMED HARM (e.g., "user loses funds"), not just a mechanism step?
- Did I use realistic values from the codebase (not made-up constants)?

If ANY answer is "no" → proceed to Step 2A (fix setup).
If ALL answers are "yes" → proceed to Step 2B (accept failure).

**Step 2A: Fix Setup (one retry)**

Rewrite ONLY the test setup/inputs. You MUST keep:
- The SAME target function call
- The SAME harm assertion (what you're checking at the end)
- The SAME finding location

You MAY change:
- Constructor arguments, initial state, mock configuration
- Input values (use values from actual constants/configs in the codebase)
- Setup ordering (if you were missing a prerequisite call)

Compile and run. If PASS → `[POC-PASS]`. If FAIL again → proceed to Step 2B.

**Step 2B: Accept failure — the bug does not manifest**

State in 2 sentences:
1. What the finding claims should happen
2. What actually happens (from test output)

Conclude `[POC-FAIL]`. Do NOT:
- Weaken the assertion to force a pass ("well if I check something else...")
- Change what harm you're testing
- Add comments like "might work under different conditions" to avoid concluding FAIL
- Retry more than once (1 retry total, not unbounded)

**Documentation in verify file:**

```markdown
### PoC Attempt
- **Attempt 1**: ASSERTION_FAIL — {1-line error from test output}
- **Self-diagnosis**: {which of the 4 questions was "no", or "all yes"}
- **Attempt 2**: {PASS → [POC-PASS] | ASSERTION_FAIL → [POC-FAIL] | SKIPPED (2B)}
- **Conclusion**: {[POC-PASS] with retry context | [POC-FAIL]: finding claims X, system does Y}
```

**Anti-gaming rules:**
- If Attempt 2 passes but tests a DIFFERENT function than the Location field → `[CODE-TRACE]`, not `[POC-PASS]`
- If Attempt 2 passes but the assertion checks something other than the finding's claimed harm → `[CODE-TRACE]`
- "The bug exists but my test can't reach it" without code evidence = `[CODE-TRACE]`, not `[POC-PASS]`

**Harm-assertion identity enforcement (Attempt 1 vs Attempt 2):**

Before writing Attempt 2, copy the EXACT final assertion line(s) from Attempt 1 into a `## Harm Assertion (locked)` line in your documentation. Attempt 2 MUST contain this same assertion text (or semantic equivalent checking the same variable/outcome). If your Attempt 2 test's final assertion checks a DIFFERENT variable or outcome than Attempt 1, you have violated harm-assertion identity — conclude `[CODE-TRACE]`, not `[POC-PASS]`.

Example of VALID identity preservation:
- Attempt 1: `assert!(balance_after < balance_before - expected_fee);`
- Attempt 2: `assert!(balance_after < balance_before - expected_fee);` (same assertion, different setup)

Example of INVALID goalpost shift:
- Attempt 1: `assert!(balance_after < balance_before - expected_fee);`
- Attempt 2: `assert!(tx_succeeded);` (different harm — now just testing tx execution, not fund loss)

### For poc_class: integration

Attempt ONLY if `test_infrastructure.md` shows the required components have test harnesses (e.g., test RPC server builder, mock network layer).
Otherwise → `[LSP-TRACE]` directly. Do NOT spend tokens on doomed integration setup.

### For poc_class: structural

Skip PoC attempt → `[LSP-TRACE]` or `[CODE-TRACE]` directly. These findings require timing, crash-recovery, or cross-client conditions that cannot be unit-tested.

## ENFORCEMENT: PoC Attempt Documentation

Every `verify_{FINDING_ID}.md` for poc_class `unit` or `property` MUST contain:

```markdown
### PoC Attempt
- **poc_class**: {class from queue manifest}
- **Attempted**: YES / NO
- **Reason if NO**: {must be: poc_class=structural, poc_class=integration-without-harness, or compile-environment-missing}
- **Test file written**: {inline or path}
- **Compile result**: SUCCESS / FAIL ({error summary}) / N/A
- **Attempt 1 result**: PASS / ASSERTION_FAIL ({what happened}) / COMPILE_FAIL / NOT_RUN
- **Attempt 2 result** (only if Attempt 1 = ASSERTION_FAIL): PASS / ASSERTION_FAIL / SKIPPED(2B)
- **Self-diagnosis** (only if retry triggered): {which question failed, or "all yes → 2B"}
- **Evidence tag**: [POC-PASS] / [POC-FAIL] / [DIFF-PASS] / [DIFF-SAME] / [CONFORMANCE-PASS] / [NON-DET-PASS] / [NON-DET-SAME] / [FUZZ-PASS] / [MEDUSA-PASS] / [CODE-TRACE] / [LSP-TRACE]
- **Fallback reason** (if not mechanical pass): {why the PoC did not produce mechanical proof}
```

For `structural` and `integration` class findings, the `### PoC Attempt` section is OPTIONAL but encouraged as documentation.

## Phase 5 orchestration

The orchestrator spawns one verifier agent per hypothesis (batched by budget). Each agent is given:

- The finding / hypothesis ID
- The source skill that produced it
- The preferred verification type (from the table above)
- The target repo path
- Access to the Phase 0.5 SCIP index via `plamen_l1.scip_reader`
- The benchmark ground truth (if this is a benchmark run)

Agents report back with the evidence tag, verdict, and captured output (test log, crashing input, trace dump).

## Return protocol

Return: `VERIFY: {finding_id} - [{evidence_tag}] - {verdict}` (max 1 line).

Verdicts: `CONFIRMED | REFUTED | CONTESTED | INFEASIBLE`.

`INFEASIBLE` is new for L1: it means "the finding is plausible but no mechanical verification path is available on this audit machine." It is treated as CONTESTED for reporting but flagged for human review in the report Appendix.
