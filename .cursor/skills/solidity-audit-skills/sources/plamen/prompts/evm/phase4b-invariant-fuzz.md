# Phase 4b: Invariant Fuzz Generator (EVM) — MOVED

> **This legacy V1 prompt (Task()-wrapped coordinator spawn) is superseded.**
> Use the canonical worker-shaped prompt `prompts/evm/v2/phase4b-invariant-fuzz.md`.

In V2 the Foundry invariant fuzz campaign runs as a driver-scheduled depth fuzz
sidecar worker (Thorough + `foundry.toml`). The driver points the worker at
`prompts/evm/v2/phase4b-invariant-fuzz.md`, which is the single canonical EVM
invariant-fuzz methodology (worker-shaped: derive invariants, build the handler,
run `forge test --match-contract InvariantFuzz`, report `[FUZZ-N]` violations).
Do not spawn an invariant-fuzz agent from any coordinator prompt.
