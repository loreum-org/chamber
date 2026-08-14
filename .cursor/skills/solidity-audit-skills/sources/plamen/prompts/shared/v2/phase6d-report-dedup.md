# Phase 6d: Cross-Tier Report Dedup

> **Loaded by**: The V2 driver's Phase 6d dispatch.
> **Execution model**: PYTHON-NATIVE. The driver invokes
> `scripts/plamen_mechanical.py::_dedup_report_python` directly. No LLM
> subprocess runs for this phase. This prompt file exists only so that
> `build_phase_prompt` returns a non-error placeholder when the phase is
> queried — it is **never** sent to a model.
>
> **critical=False (LOAD-BEARING)**: A crash, timeout, or data-loss veto in
> this phase MUST NOT halt the run or corrupt the delivered report. On any
> problem the driver degrades (warning) and the original `AUDIT_REPORT.md`
> stands as delivered.

## What the Python phase does

`report_index` STEP-1.5 forbids merging hypotheses across severity tiers, so a
single bug that surfaced at two severities (e.g. `C-01` + `H-12`) is never a
consolidation candidate before the report exists. This phase runs AFTER
severities are final (post `report_assemble`) and looks for cross-tier
duplicates in the assembled `AUDIT_REPORT.md`.

1. Parse `AUDIT_REPORT.md` into per-finding records.
2. Back-join each report ID to its internal hypothesis + source-ID set via
   `report_index.md` Master Finding Index and `finding_mapping.md` (recovers the
   source-ID dimension the client report lacks).
3. Detect CANDIDATE PAIRS only (never auto-merge): cross-tier source-ID subset
   [primary], shared location token, shared PoC test-fn, title Jaccard ≥ 0.5,
   and same-fix-cross-tier (shared location OR shared anchor identifier + a
   high-overlap Recommendation). Aggregate-source-ID suppression avoids class-D
   false merges.
4. Mechanically MERGE on two signals: (1) the primary source-ID-subset signal,
   and (2) the same-fix-cross-tier signal, which is gated by a strict same-fix
   precision check — the two Recommendation texts must share content terms at
   Jaccard ≥ 0.5 with NO antonym (opposite-direction) conflict and no thin/empty
   fix text. This recovers true cross-tier duplicates that different agents
   found (so they carry different source IDs and the subset signal misses them),
   WITHOUT merging related-but-distinct findings that share a variable/site but
   require opposite fixes (e.g. inflow-vs-outflow accounting) — a false merge
   HIDES a real finding and is worse than a duplicate. All OTHER weak signals
   (bare location/poc/title) still default KEEP_SEPARATE (a duplicate is
   cosmetic; a dropped finding is recall loss). Decisions are written to
   `report_dedup_mapping.md`.

## SNAPSHOT-BOTH + DATA-LOSS GATE (invariant #1)

This phase NEVER loses report content. It ALWAYS snapshots the untouched
original to `AUDIT_REPORT.pre-dedup.md`, writes the candidate output to
`AUDIT_REPORT.deduped.md`, and runs a MECHANICAL DATA-LOSS GATE (every original
Location string, Impact bullet, and PoC test-id must still appear). The deduped
output is promoted to `AUDIT_REPORT.md` ONLY if the gate passes. On ANY detected
loss the original is KEPT as the delivered report and the deduped file is left
as a side artifact for human review. Running on an already-deduped report (no
candidate pairs) is a no-op.

## No further instructions

This phase has no LLM-visible instructions. The Python module is the single
source of truth. If you are an LLM reading this file, you should not be —
return immediately.
