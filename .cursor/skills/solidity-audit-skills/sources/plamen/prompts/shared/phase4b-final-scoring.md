---
description: "Phase 4b: Final Composite Scoring with RAG axis (after Phase 4b.5 RAG Sweep)"
---

# Phase 4b: Final Composite Scoring

> **Efficiency**: This is a mechanical formula-application task. Prioritize responding quickly. Apply scoring formulas directly without extensive reasoning.
> **Mode gate**: Core and Thorough only. Light mode has no scoring.
> **Trigger**: After Phase 4b.5 RAG Validation Sweep completes and `rag_validation.md` exists.
> **Purpose**: Replace the RAG axis floor scores (0.3) with actual RAG validation results and compute final composite scores.

---

## Agent

**Model**: sonnet (formula application with per-finding differentiation)

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Final Scoring Agent. You compute final composite confidence scores using real RAG validation data.

## Your Inputs
Read:
- {SCRATCHPAD}/confidence_scores.md (current scores with RAG at 0.3 floor)
- {SCRATCHPAD}/rag_validation.md (RAG sweep results with per-finding scores)

## Your Task

For EACH finding in confidence_scores.md:

1. Look up the finding's RAG score from rag_validation.md:
   - If `validate_hypothesis` returned a score: use `score / 10`
   - If RAG tool failed for this finding: use 0.3 (floor)
   - If finding not in rag_validation.md: use 0.3 (floor)

2. Recompute the composite score with the real RAG value:

**4-axis formula (Thorough)**:
```
composite = Evidence * 0.25 + Consensus * 0.25 + Analysis_Quality * 0.3 + RAG_Match * 0.2
```

**2-axis formula (Core)**:
```
composite = Evidence * 0.5 + Analysis_Quality * 0.5
```
(Core does not use RAG axis -- this step only updates the RAG column for reference)

3. Reclassify based on updated composite:
   - >= 0.7: CONFIDENT
   - 0.4-0.7: UNCERTAIN
   - < 0.4: LOW_CONFIDENCE

4. Any finding still < 0.4 after all iterations and RAG: force to CONTESTED verdict.

## Output

Update {SCRATCHPAD}/confidence_scores.md with final scores. Add section:

```
## Final Scoring (Post-RAG Sweep)
- Findings updated with RAG data: {N}
- RAG tool failures (floor used): {F}
- Classification changes from RAG: {C}
- Final distribution: {CONFIDENT_count} CONFIDENT, {UNCERTAIN_count} UNCERTAIN, {LOW_count} LOW_CONFIDENCE
- Forced CONTESTED (< 0.4 after all passes): {list of finding IDs}
```

Write your output directly to {SCRATCHPAD}/confidence_scores.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {N} findings finalized -- {C} CONFIDENT, {U} UNCERTAIN, {L} LOW, {F} forced CONTESTED'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/confidence_scores.md` contains "Final Scoring" section.

Write your output to {SCRATCHPAD}/confidence_scores.md and stop.
