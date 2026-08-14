# Soroban Invariant Fuzz Campaign

Use this template only when the language toolchain registry marks Soroban
invariant fuzzing available and `cargo_fuzz_available: true` or equivalent is
present in `build_status.md`.

## Inputs

- `semantic_invariants.md`
- `findings_inventory.md`
- Soroban contract source files cited by the relevant invariant
- Existing `soroban-sdk` test harnesses when present

## Method

1. Select invariants with concrete state transitions, storage lifecycle
   effects, authorization paths, or cross-contract preconditions.
2. Build a `cargo-fuzz` target using `soroban-sdk` testutils and `Env::default()`.
3. Generate arbitrary inputs for addresses, amounts, ledger sequence/time, and
   storage keys relevant to the invariant.
4. Assert the invariant after every generated operation sequence.
5. If nightly or `cargo-fuzz` is unavailable, port the same invariant to
   `proptest` with bounded inputs.

## Output

Write ONLY `cargo_fuzz_findings.md` when cargo-fuzz runs. If using the fallback,
write ONLY `proptest_findings.md`. Include command output, failing seed or case,
and the exact invariant violated. If no fuzz engine is available, write a short
unavailability note to the assigned output file and stop.
