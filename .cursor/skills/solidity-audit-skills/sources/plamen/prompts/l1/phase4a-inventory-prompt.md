# L1 Phase 4A Inventory Prompt

This base-path prompt is intentionally a thin compatibility port.

The Plamen V2 L1 pipeline uses the canonical V2 inventory prompt at:

`prompts/l1/v2/phase4a-inventory-prompt.md`

If this file is loaded by a role, command, or legacy prompt reference, follow
the V2 file verbatim. Do not infer a separate L1 inventory methodology from
older SC prompts.

Runtime contract:
- Read only the Phase 4A prerequisites named by the V2 prompt.
- Write only the inventory artifacts named by the driver for the current phase.
- Preserve L1 mode semantics: no Phase 4C chain analysis is run.
- Do not proceed to verification or reporting.

SCOPE: Compatibility pointer only. Resolve this file to
`prompts/l1/v2/phase4a-inventory-prompt.md`, follow that methodology, then stop.
