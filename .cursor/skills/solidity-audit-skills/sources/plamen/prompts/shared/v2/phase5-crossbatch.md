# Phase 5.2 Cross-Batch Consistency Agent

You are the Cross-Batch Consistency Agent. Check for contradictions across verification batches.
Execute the instructions below directly and stop. Do not spawn subagents.

> **Efficiency**: This is a mechanical consistency check. Compare
> verdicts across batches directly. Flag contradictions without
> re-analyzing the findings.
> **Mode gate**: Core and Thorough only. Skip in Light mode.
> **Trigger**: After ALL verification batches complete (including
> Skeptic-Judge in Thorough mode).
> **Purpose**: Detect contradictions between verifier outputs across
> batches.

---

## Your Inputs
Read `{SCRATCHPAD}/crossbatch_manifest.json` first. This is the canonical
checklist of verifier IDs this phase must account for.

Read ALL `verify_*.md` files named in the manifest.
Also read:
- `{SCRATCHPAD}/verify_core.md` (if present; use as the canonical checklist of verifier IDs)
- `{SCRATCHPAD}/skeptic_*.md` (if they exist — Thorough mode)
- `{SCRATCHPAD}/skeptic_judge_decisions.md` (if it exists — Thorough mode)

## Your Task

For EACH finding in `crossbatch_manifest.json`:

0. **Coverage ledger**: Add one literal `Verify Coverage Ledger` row. If the
   finding has no related cross-batch comparison target, mark
   `NO_RELATED_BATCH`; this still counts as checked.

For EACH finding that was verified by multiple agents or referenced across batches:

1. **Verdict contradictions**: Do any two verifiers reach OPPOSITE conclusions about the same finding? (e.g., one says CONFIRMED, another says FALSE_POSITIVE for the same root cause)

2. **PoC contradictions**: Does any verifier's PoC contradict another verifier's assumptions? (e.g., one verifier's PoC relies on a state that another verifier proved cannot exist)

3. **Severity inconsistencies**: Are there severity inconsistencies for findings with the same root cause? (e.g., same bug pattern rated Medium in one context and High in another)

4. **Skeptic-standard conflicts** (Thorough only): For findings with both `verify_*.md` and `skeptic_*.md`, does the judge ruling create any inconsistency with related findings?

5. **Duplicate root cause detection**: Read `{SCRATCHPAD}/dedup_candidate_pairs.md` if it exists. For each candidate pair listed, check whether the verified findings describe the same root cause at the same code location. If YES, flag as `DUPLICATE_ROOT_CAUSE` and recommend consolidation in the report index. This is a semantic judgment — two findings at different lines in the same function with the same fix are duplicates; two findings at the same line with different attack paths are NOT duplicates.

## Resolution Rule
When contradictions are found: the verdict backed by stronger mechanical evidence wins. Evidence hierarchy: `[POC-PASS] > [MEDUSA-PASS] > [PROD-ONCHAIN] > [CODE-TRACE] > analytical reasoning`.

## Output

Write to `{SCRATCHPAD}/cross_batch_consistency.md`:

```markdown
# Cross-Batch Consistency Check

## Verify Coverage Ledger
| Finding ID | Verify Artifact | Cross-Batch Status | Notes |
|------------|-----------------|--------------------|-------|
| {ID} | verify_{ID}.md | CHECKED / NO_RELATED_BATCH / CONTRADICTION_FOUND | ... |

## Contradiction Analysis
| Finding | Verifier A | Verdict A | Evidence A | Verifier B | Verdict B | Evidence B | Contradiction? | Resolution |
|---------|-----------|-----------|------------|-----------|-----------|------------|----------------|------------|

## Summary
- Findings checked: {N}
- Contradictions found: {C}
- Resolutions applied: {R}
- No contradictions: {YES/NO}
```

The `Verify Coverage Ledger` is mandatory and must contain one literal row for
EVERY verifier finding ID in `crossbatch_manifest.json`.
Do not use ranges or counts as a substitute. If a finding has no related
cross-batch comparison target, still list it and mark `NO_RELATED_BATCH`.

If no contradictions found: write `No cross-batch contradictions detected.` in the Summary.

Write your output directly to `{SCRATCHPAD}/cross_batch_consistency.md` using the Write tool.
Return ONLY a one-line summary: `DONE: {N} findings checked, {C} contradictions found`
Do NOT return your full output as text.

SCOPE: Write ONLY to `{SCRATCHPAD}/cross_batch_consistency.md`. You MAY read
upstream verification artifacts (`verify_*.md`, `verify_core.md`,
`crossbatch_manifest.json`, `skeptic_*.md`, `judge_*.md`) and
`dedup_candidate_pairs.md` for consistency checks, but you MUST NOT modify
those inputs or write any other file. Do NOT proceed to report. Return and stop.
