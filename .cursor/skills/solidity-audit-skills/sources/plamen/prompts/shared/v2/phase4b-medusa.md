# Phase 4b Medusa Fuzz Campaign — MOVED

> **This prompt has been folded into the canonical EVM Medusa worker prompt.**
> Use `prompts/evm/v2/phase4b-medusa-fuzz.md` instead.

In V2 the Medusa stateful-fuzz campaign runs as a driver-scheduled depth fuzz
sidecar worker (Thorough + `MEDUSA_AVAILABLE`). The driver points the worker at
`prompts/evm/v2/phase4b-medusa-fuzz.md`, which is the single canonical Medusa
methodology (worker-shaped, `stopOnFailedTest: false`, `medusa --timeout 600`,
dedup directive). Do not spawn a Medusa agent from any coordinator prompt.
