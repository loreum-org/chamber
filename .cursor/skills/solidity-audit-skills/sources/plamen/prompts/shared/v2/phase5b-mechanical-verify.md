# Phase 5b: Mechanical PoC Verification

> **Loaded by**: The V2 driver's Phase 5b dispatch.
> **Execution model**: PYTHON-NATIVE. The driver invokes
> `scripts/mechanical_verify.py::run_phase5b_mechanical_verify` directly. No
> LLM subprocess runs for this phase. This prompt file exists only so that
> `build_phase_prompt` returns a non-error placeholder when the phase is
> queried — it is **never** sent to a model.
>
> **Default**: ON. Opt-out via `MECHANICAL_VERIFY=false` env var or
> `config["mechanical_verify"]=False`. There is no LLM cost — the phase is
> pure Python subprocess invocation of the existing PoC tests the verifier
> already wrote.
>
> **Failure mode**: DEGRADED (warning), never HALT. When the language
> toolchain (`forge`, `cargo`, `aptos`, `sui`, `go`, `stellar`) is missing
> from PATH, the phase short-circuits cleanly and preserves the LLM-assigned
> Evidence Tags. Downstream phases (skeptic, crossbatch, report) continue.

## What the Python phase does

For every `verify_*.md` in the scratchpad (excluding aggregate files
`verify_core.md`, `verify_aggregate.md`):

1. Parse the `Test File:` and `Command:` fields.
2. Look up the per-ecosystem test command from
   `~/.plamen/rules/language-toolchain-registry.json`. L1 entries
   (`l1_go`, `l1_rust`) are injected as overlay at module load.
3. Resolve the test path under the project root (tries `test/`, `tests/`,
   `sources/tests/`, `trident-tests/`, project root).
4. Execute the test runner with `subprocess.run`, capturing stdout/stderr.
5. Classify the outcome:
   `PASS | FAIL | COMPILE_FAIL | TIMEOUT | NO_TEST_MATCH | NO_TEST_FILE |
    TOOLCHAIN_UNAVAILABLE | BUILD_FAILED | EXEC_ERROR | SKIPPED`.
6. Append a `Mechanical-Verified:` line to the verify file. Append-only;
   the LLM body is never destroyed. When PASS/FAIL, also emit a
   `Mechanical-Tag:` line that downstream phases read as the canonical
   evidence tag.
7. Write `mechanical_verify_manifest.md` (human-readable) and
   `mechanical_verify_manifest.json` (programmatic) summarizing all
   per-finding outcomes.

## Why this exists

Prior audits had the LLM verifier write the PoC, run it locally, and
self-tag the evidence. The integrity validator then downgraded most
`[POC-PASS]` claims because its assertion regex didn't speak Solidity. Net
result on a prior benchmark: 0 verified findings in the final report
despite 11/12 mechanically-passing PoCs sitting on disk. This phase
replaces the LLM as the oracle and stamps mechanical truth into the
verify files BEFORE skeptic/crossbatch/report_index consume them.

## No further instructions

This phase has no LLM-visible instructions. The Python module is the
single source of truth. If you are an LLM reading this file, you should
not be — return immediately.
