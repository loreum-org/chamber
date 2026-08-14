# Phase 6e: Material-Harm Body Floor

> **Loaded by**: The V2 driver's Phase 6e dispatch.
> **Execution model**: PYTHON-NATIVE. The driver invokes
> `scripts/plamen_mechanical.py::apply_material_harm_floor` directly. No LLM
> subprocess runs for this phase. This prompt file exists only so that
> `build_phase_prompt` returns a non-error placeholder when the phase is
> queried — it is **never** sent to a model.
>
> **critical=False (LOAD-BEARING)**: a crash, missing input, or malformed
> `disposition.md` MUST NOT halt the run or corrupt the delivered report. On any
> problem the driver degrades (warning) and the original `AUDIT_REPORT.md`
> stands. This is the FINAL report mutation.

## What the Python phase does

After `report_disposition` writes `disposition.md` (BODY / APPENDIX per finding,
LLM primary; the driver writes a keyword-classifier fallback when the LLM phase
produced nothing usable), this phase:

1. Reads `disposition.md` + the final deduped `AUDIT_REPORT.md`.
2. Relocates every APPENDIX-dispositioned `### [X-NN]` body section into
   `## Appendix C: Quality & Hardening Observations` (one row each — never
   dropped; recall-safe).
3. Decrements the `## Summary` counts table so the delivered report's summary
   matches its remaining body sections.

Idempotent and haltless: a no-op when `disposition.md` is absent / empty, when
no APPENDIX id has a body section, or on any exception.

## No further instructions

This phase has no LLM-visible instructions. The Python module is the single
source of truth. If you are an LLM reading this file, you should not be —
return immediately.
