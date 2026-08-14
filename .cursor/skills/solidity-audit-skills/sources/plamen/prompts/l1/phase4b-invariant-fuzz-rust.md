# L1 (Rust) cargo-fuzz Skeleton

> **Status**: template-registration only (A3). This file documents the
> harness shape the language-toolchain registry's `l1_rust.fuzz_engines[0]`
> entry points at. The mechanical re-run of this command is a **deferred**
> item — it is NOT wired into `mechanical_verify.py`'s execution loop yet.

Use this template only when the finding's evidence path is a fuzz campaign
(`[FUZZ-PASS]` per `prompts/l1/v2/phase5-verification-prompt.md`) and the
target module is Rust. `cargo-fuzz` (libFuzzer via `libfuzzer-sys`) is the
preferred engine and requires nightly Rust plus a fuzz target under
`fuzz/fuzz_targets/`. When nightly is unavailable, fall back to the
`proptest`-based property harness registered as the `proptest` fuzz engine
(stable Rust, no nightly requirement).

## Inputs

- `semantic_invariants.md` / `findings_inventory.md` (the invariant or crash
  hypothesis under test)
- The crate/module(s) cited by the finding
- Existing `#[test]` functions in the same crate for realistic seed values

## Method (cargo-fuzz, preferred)

1. Identify the smallest function whose input space reaches the hypothesized
   defect — a decoder, deserializer, state-transition step, or validator.
2. If `fuzz/` does not exist yet: `cargo fuzz init` from the crate root.
3. Add a new fuzz target file under `fuzz/fuzz_targets/` (one per
   finding/hypothesis) using `libfuzzer_sys::fuzz_target!`, deriving
   `Arbitrary` for structured inputs where the target takes more than raw
   bytes.
4. Inside the fuzz body: call the target, then assert the invariant directly
   — a panic, an unexpected `Result::Err`, or a violated postcondition. Do
   NOT only assert "did not crash"; assert the SPECIFIC harm the finding
   claims. NEVER use `panic!()` for expected-error paths — only for the
   asserted violation itself.

## Skeleton (cargo-fuzz / libfuzzer-sys)

```rust
// fuzz/fuzz_targets/fuzz_target_name.rs
// Rename `fuzz_target_name` to the concrete finding under test, e.g.
// fuzz_decode_message. One fuzz target file per finding/hypothesis.
#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // 1. Call the target function/method under test with `data`
    //    (use `arbitrary::Arbitrary` to derive structured inputs instead of
    //    raw bytes when the target takes a typed argument).
    // let result = target_crate::decode(data);

    // 2. Assert the CLAIMED HARM, not merely "no panic". Examples:
    //    - decode/encode round-trip must be lossless
    //    - a bounds check must reject out-of-range input instead of
    //      wrapping/truncating silently
    //    - a state transition must not violate a documented invariant
    //
    // if let Ok(value) = result {
    //     assert!(invariant_holds(&value), "invariant violated for {:?}", data);
    // }
});
```

## Campaign command (preferred)

```
cargo +nightly fuzz run fuzz_target_name
```

## Fallback skeleton (proptest, stable Rust)

```rust
// tests/proptest_target_name.rs (or an in-crate #[cfg(test)] module)
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_prop_target_name(input in any::<Vec<u8>>()) {
        // Call the target and assert the same invariant as the cargo-fuzz
        // skeleton above — this is a bounded-iteration substitute, not a
        // different methodology.
        // let result = target_crate::decode(&input);
        // prop_assert!(result.is_err() || invariant_holds(&result.unwrap()));
    }
}
```

## Fallback command

```
cargo test test_prop_target_name -- --nocapture
```

(Both command forms match `prompts/l1/v2/phase5-verification-prompt.md`'s
Rust command table: cargo-fuzz preferred, proptest fallback.)

## Output

Write ONLY `cargo_fuzz_findings.md` when cargo-fuzz runs. If using the
fallback, write ONLY `proptest_findings.md`. Include: the exact command run,
whether a failing input/case was found (and if so, the crash artifact path
or the shrunk proptest case), and the invariant violated. If neither engine
is available (no nightly, no proptest dependency), write a short
unavailability note to the assigned output file and stop — do not fall back
to inventing a result.
