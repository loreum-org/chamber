# Phase 4b Medusa Stateful Fuzz Campaign (EVM, Thorough)

You are the Medusa Fuzz Campaign Agent. You derive protocol-specific invariants and run Medusa stateful fuzzing.
Execute the instructions below directly and stop. Do not spawn subagents.

> **Mode gate**: EVM + Thorough + Foundry-usable (the build root has a
> `foundry.toml` or `forge` can compile it). Medusa ALWAYS runs on EVM
> when Foundry can be set up — there is no silent skip and no
> `MEDUSA_AVAILABLE` pre-gate. Emit the degrade-continue status line if
> and only if medusa truly cannot be installed/run AND the build root is
> not Foundry-usable. When the project ships no harness, BUILD one from
> scratch (STEP 1).
> **Budget**: Zero depth budget cost. Runs in parallel with the Foundry
> invariant fuzz agent.
> **Timeout**: 10 minutes (`medusa fuzz --timeout 600`). Reduced from 15
> minutes when we made the campaign continue past the first violation
> (`stopOnFailedTest: false`). Net coverage improves — campaigns that
> historically halted at the first failure in <1 second can now run the
> full budget across all invariants — while total wall time stays under
> the prior 15-minute ceiling.
> **Reference (not load-bearing)**: Full Adaptive Depth Loop pseudocode
> is in `~/.claude/prompts/evm/phase4b-loop.md`. This file contains only
> the Medusa campaign directive.

---

## Your Inputs — read ALL (each contributes different invariant types)

- `{SCRATCHPAD}/design_context.md` (protocol purpose, key invariants — PRIMARY for economic properties)
- `{SCRATCHPAD}/findings_inventory.md` (Medium+ findings → fuzz targets)
- `{SCRATCHPAD}/semantic_invariants.md` (structural properties)
- `{SCRATCHPAD}/state_variables.md` (variable types)
- `{SCRATCHPAD}/function_list.md` (action targets)
- `{SCRATCHPAD}/contract_inventory.md` (contracts in scope)
- `{SCRATCHPAD}/constraint_variables.md` (realistic value ranges)
- Source files in scope

---

## STEP 0: Probe & Provision (ALWAYS — no silent skip)

Before generating anything, establish that medusa and a compilable build root
are available. Each sub-step is best-effort and never halts the phase:

1. **Probe medusa**: run `medusa --version`. If it succeeds, medusa is
   available — proceed. If it is absent, attempt the documented install path
   ONCE (the medusa binary is distributed by Crytic; install via the project's
   documented method, e.g. the released binary or `go install` per the medusa
   README). Re-run `medusa --version` to confirm. Do not loop on install
   failure — one attempt, then record the outcome.
2. **Confirm the build root compiles**: from the resolved build root (the
   directory containing `foundry.toml`, or a Hardhat project), run `forge build`
   (or `npx hardhat compile` for a Hardhat-only project). If neither compiler
   can be set up, the build root is not Foundry-usable.
3. **Detect a shipped harness (generic)**: scan the build root and its test
   directories for an EXISTING medusa harness — a `medusa.json` / `medusa.yaml`
   config, a `.medusa-tests/` (or similarly-named medusa harness) directory, or
   test contracts that already expose `fuzz_`-prefixed boolean property
   functions wired for medusa. If a shipped harness exists AND compiles, USE IT
   (skip the scaffolding in STEP 1) — point medusa at its config and run the
   campaign.

**Decision after STEP 0:**
- medusa available + build root compiles + shipped harness compiles → use it.
- medusa available + build root compiles + no usable shipped harness → scaffold
  from scratch (STEP 1).
- medusa NOT installable AND build root NOT Foundry-usable → genuine
  impossibility: write the `TOOL_UNAVAILABLE` degrade-continue artifact and
  stop.

---

## STEP 1: Use-or-Scaffold Harness

If STEP 0 found a usable shipped harness, USE IT and skip to STEP 2.

Otherwise, **scaffold a harness from scratch**. This is pure methodology — the
project ships nothing usable, so you build a standalone harness against the
in-scope contracts:

1. **Enumerate in-scope targets**: read `contract_inventory.md` and
   `function_list.md` to list every in-scope contract and its externally
   callable state-changing functions.
2. **Create a `.medusa-tests/` directory** in the resolved build root.
3. **Write a standalone harness contract** that:
   - Imports each in-scope target contract.
   - Deploys each target in the harness constructor using safe constructor
     defaults (zero/minimal addresses, neutral parameter values; where a
     constructor needs a collaborator contract, deploy a minimal local
     stand-in). The goal is a compilable, reachable deployment, not a
     production configuration.
   - Adds **lifecycle action wrappers** — public functions that medusa can call
     to drive multi-step sequences (deposit→withdraw, open→close, lock→unlock),
     each forwarding to the target with bounded inputs.
   > **External-dependency mock tier.** The deploy bullet above assumes each
   > in-scope contract deploys with a minimal local stand-in. When the
   > highest-value fuzzable surface — the in-scope accounting/escrow/state-machine
   > contract — CANNOT be constructed standalone because its constructor args /
   > immutables / interface imports require a LIVE external dependency (an AMM
   > pool manager, oracle, router, vault, bridge endpoint, etc.; identify it from
   > those signatures), do NOT fall straight back to code-trace. Build a MINIMAL
   > behavioral mock of ONLY the interface subset the in-scope contract actually
   > calls on that dependency (the methods exercised by the in-scope value paths,
   > not the full external interface), with the simplest *faithful* behavior
   > (e.g. an AMM pool manager mock that conserves value via constant-product /
   > pass-through swaps; an oracle mock returning a settable price; Uniswap-V4
   > `PoolManager` is one illustrative example), so the accounting state machine
   > deploys and is fuzzed directly.
   > **RECALL-SAFETY (mandatory — no fabricated coverage):** the mock MUST be
   > faithful to the dependency's value-relevant contract. If a faithful minimal
   > mock is NOT achievable in bounded effort (the dependency's behavior is itself
   > security-relevant and non-trivial to reproduce), DO NOT ship a guessed mock —
   > a wrong mock yields false PASS/FAIL. Fall back to the existing code-trace
   > path and record the gap as an explicit coverage limitation (no silent cap),
   > emitting `[CODE-TRACE]` for the affected properties rather than
   > `[MEDUSA-PASS]`.
   > **Mock fidelity receipt (mandatory):** in `medusa_fuzz_findings.md`, write
   > one line naming which dependency was mocked and which methods, so a reviewer
   > can judge fidelity, e.g.
   > `Mock fidelity: mocked <Dependency> methods [<method1>, <method2>] with <faithful behavior>`
   > OR `Mock fidelity: <Dependency> NOT mocked (faithful minimal mock infeasible: <reason>) — code-trace fallback`.
4. **Derive `fuzz_`-prefixed boolean property functions** (NO CAP — medusa
   execution is zero token cost, test ALL meaningful invariants) from:
   `design_context.md` (economic properties), `findings_inventory.md` (bug
   targets), `semantic_invariants.md` (structural properties),
   `constraint_variables.md` (bounds/value ranges).
5. **Generate `medusa.json`** with:
   - Compilation settings matching the resolved build root (the same compiler
     and remappings the build root uses, so the harness compiles).
   - `"timeout": 600` in the `fuzzing` block.
   - A corpus directory under `.medusa-tests/corpus/`.
   - `"stopOnFailedTest": false` (see note below).

Use realistic value bounds from `constraint_variables.md`.

> **`stopOnFailedTest` note**: without `"stopOnFailedTest": false` Medusa halts
> at the first invariant violation (default behavior) and never explores
> deep-state sequences for the remaining invariants. Documented at
> secure-contracts.com (Crytic), confirmed default is `true`. Production audits
> set it `false` to surface every violation.

### STEP 1.5: Negative-Case Reachability (SOFT CHECK)

Before writing the harness, walk every `fuzz_` property and ask: *"What
concrete call sequence would cause this property to RETURN FALSE?"*

If the answer is "I can't construct one because the harness setup makes
the failing state unreachable" — the invariant is malformed. The most
common failure modes:

1. **Authorization tautology**: the property tests "unauthorized caller
   X cannot do Y" but the Medusa harness contract IS in the authorized
   set (registered as bot/owner/operator). Medusa fires calls from the
   harness address by default; every such call passes the check
   trivially and the property never returns false. → Fix: in the
   property, use a hardcoded non-authorized synthetic address as the
   caller (e.g. `address(uint160(0xC0FFEE))`) or assert
   `!authorized[msg.sender]` as part of the property to filter Medusa
   into the negative case.

2. **Branch tautology**: the property asserts a state-A invariant but
   the harness setup only ever drives state B. The precondition is never
   satisfied so Medusa cannot witness a failure. → Fix: confirm the
   harness can actually reach the state the property targets, OR rewrite
   the property to test the branch the harness DOES reach.

**Output requirement** (in your `MedusaFuzzV*.sol` harness comments):
for each `fuzz_` function, leave a one-line comment:
`// negative case: <call sequence that would falsify this>` OR
`// negative case: UNREACHABLE because <reason> — REWRITTEN as <new approach>`

A PASS on a property whose negative case is UNREACHABLE is zero coverage,
not confirmation. Do NOT emit `[MEDUSA-PASS]` for those — flag in STEP 3
output as `PASSED*` with the reason for the asterisk.

---

## STEP 2: Run Medusa

Execute:

```
medusa fuzz --config .medusa-tests/medusa.json --timeout 600
```

Parse output for:
- Property violations (counterexamples found)
- Coverage metrics
- Crash/error details

If medusa errors or fails to compile the harness: document the error and exit gracefully. Do NOT retry past the first compilation failure — report the error and proceed to STEP 3 with empty violations.

---

## STEP 3: Report Results

### STEP 3a: Deduplicate violations BEFORE writing findings

With `stopOnFailedTest: false` the campaign typically surfaces the same
root cause from multiple call sequences (e.g. `fuzz_feePercentBounded`
violated at `feePercent=1010`, `4037`, `186226859814786`, ... — same bug,
many witnesses). Each is a distinct Medusa output entry but they should
collapse to ONE `[MEDUSA-N]` finding.

Dedup rule: group violations by `(target_contract, property_function,
violated_assertion)`. Emit one finding per group, listing the smallest
counterexample first and noting "additional N counterexamples elided"
in the Description. Do NOT emit `[MEDUSA-N]` for every raw witness.

### STEP 3b: Per-finding format

For each deduplicated violation, create a finding with:
- Finding ID: `[MEDUSA-N]`
- The smallest counterexample call sequence (verbatim from medusa output)
- Which invariant was violated
- Evidence tag: `[MEDUSA-PASS]` (counterexample = mechanical proof of violation)

Report category coverage:

| Category | Count | Source | Covered? |
|----------|-------|--------|----------|
| Protocol economic | {n} | design_context.md | YES/NO |
| Finding-derived | {n} | findings_inventory.md | YES/NO |
| Lifecycle | {n} | function_list.md | YES/NO |
| Structural | {n} | semantic_invariants.md | YES/NO |
| Boundary | {n} | constraint_variables.md | YES/NO |

If no violations: report coverage summary only.

---

## Degrade-Continue Contract (MANDATORY — silent skip is forbidden)

You MUST ALWAYS write `{SCRATCHPAD}/medusa_fuzz_findings.md`, even on any
failure, and it MUST contain a single line of the form:

`## Result Status: <RAN|TOOL_UNAVAILABLE|COMPILATION_FAILED|TIMEOUT|NOT_APPLICABLE>`

followed by a one-line reason. Choose:
- `RAN` — the campaign executed (against a shipped or scaffolded harness). List
  any violations as `### Finding [MEDUSA-N]` rows with the `[MEDUSA-PASS]`
  evidence tag and the counterexample call sequence. If no violations: state
  "No violations detected" — that is a valid, complete result.
- `TOOL_UNAVAILABLE` — medusa cannot be installed AND the build root is not
  Foundry-usable. This is the ONLY genuine-impossibility case. Contains no
  findings.
- `COMPILATION_FAILED` — even the scaffolded (or shipped) harness will not
  compile after the documented recovery attempts. Include the error tail. No
  findings.
- `TIMEOUT` — medusa exceeded its `--timeout 600` budget. No findings.
- `NOT_APPLICABLE` — the in-scope contracts expose no fuzzable state-changing
  surface. No findings.

A from-scratch harness build that fails does NOT become `TOOL_UNAVAILABLE` — it
is `COMPILATION_FAILED` (or, if the harness simply cannot be expressed,
`NOT_APPLICABLE`). Reserve `TOOL_UNAVAILABLE` for the medusa-not-installable AND
not-Foundry-usable case alone. Never halt depth — a non-RAN status with no
findings is a VALID, complete artifact (the depth gate requires file presence +
the COMPLETE marker, NOT findings).

The output file MUST carry the worker's own `PLAMEN_ARTIFACT` /
`EXPECTED_OUTPUT` header and end with the final `<!-- PLAMEN_STATUS: COMPLETE -->`
marker.

---

## Output

Write to `{SCRATCHPAD}/medusa_fuzz_findings.md`.

Return: `DONE: {N} invariants tested ({categories} categories), {V} violations found, {C}% coverage`

SCOPE: Write ONLY to `{SCRATCHPAD}/medusa_fuzz_findings.md`. Do NOT read or write other agents' output files. Do NOT proceed to depth iteration 2, verification, or report. Return your findings and stop.
