# L1 (Go) Native Fuzz Skeleton

> **Status**: template-registration only (A3). This file documents the
> harness shape the language-toolchain registry's `l1_go.fuzz_engines[0]`
> entry points at. The mechanical re-run of this command is a **deferred**
> item — it is NOT wired into `mechanical_verify.py`'s execution loop yet.

Use this template only when the finding's evidence path is a fuzz campaign
(`[FUZZ-PASS]` per `prompts/l1/v2/phase5-verification-prompt.md`) and the
target module is Go. Go's native fuzzing (`go test -fuzz`, stdlib since
Go 1.18) requires no external fuzz-crate dependency, unlike Soroban/Solana's
`cargo-fuzz`.

## Inputs

- `semantic_invariants.md` / `findings_inventory.md` (the invariant or crash
  hypothesis under test)
- The Go package(s) cited by the finding
- Existing `_test.go` files in the same package for realistic seed corpus
  values (arguments, byte layouts, boundary constants already used by the
  package's own unit tests)

## Method

1. Identify the smallest exported (or same-package, if unexported is fine)
   function whose input space reaches the hypothesized defect — a parser,
   decoder, state-transition step, or validator.
2. Write a `FuzzXxx` function in the SAME package as the target (or an
   `_test` package with access to it), seeded via `f.Add(...)` with at least
   one realistic corpus entry drawn from an existing test.
3. Inside the fuzz body: call the target, then assert the invariant directly
   — a panic, an unexpected error, or a violated postcondition. Do NOT only
   assert "did not crash"; assert the SPECIFIC harm the finding claims.
4. Run locally first with `go test -run FuzzXxx -v ./...` (exercises only the
   seed corpus, fast smoke test), then the real campaign command below.

## Skeleton

```go
package pkg // match the target package

import "testing"

// FuzzTargetName — rename to the concrete finding under test, e.g.
// FuzzDecodeMessage. One FuzzXxx function per finding/hypothesis.
func FuzzTargetName(f *testing.F) {
	// Seed corpus: at least one realistic input drawn from an existing
	// _test.go in this package (boundary values, known-valid payloads).
	f.Add([]byte{0x00})

	f.Fuzz(func(t *testing.T, in []byte) {
		// 1. Call the target function/method under test with `in`.
		// result, err := TargetFunction(in)

		// 2. Assert the CLAIMED HARM, not merely "no panic". Examples:
		//    - decode/encode round-trip must be lossless
		//    - a bounds check must reject out-of-range input instead of
		//      wrapping/truncating silently
		//    - a state transition must not violate a documented invariant
		//
		// if err == nil && !invariantHolds(result) {
		// 	t.Fatalf("invariant violated for input %x: %+v", in, result)
		// }
	})
}
```

## Campaign command

```
go test -fuzz FuzzTargetName -fuzztime 5m ./...
```

(Matches the authoritative command in
`prompts/l1/v2/phase5-verification-prompt.md`'s Go command table.) `-fuzztime`
is ops-adjustable; 5 minutes is the documented default budget for a single
finding's campaign.

## Output

Write ONLY `go_fuzz_findings.md`. Include: the exact command run, elapsed
fuzz time, whether a failing input was found (and if so, the `testdata/fuzz/`
corpus entry and reproduction command `go test -run FuzzTargetName/<seed>`),
and the invariant violated. If Go's fuzzing engine cannot run (build failure,
platform without a working corpus dir), write a short unavailability note to
the assigned output file and stop — do not fall back to inventing a result.
