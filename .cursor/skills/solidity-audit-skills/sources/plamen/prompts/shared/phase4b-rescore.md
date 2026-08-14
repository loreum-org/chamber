---
description: "Phase 4b: Re-Scoring after iteration 2 with new-evidence-only rule (AD-5)"
---

# Phase 4b: Post-Iteration-2 Re-Scoring

> **Efficiency**: This is a mechanical re-scoring task. Apply the new-evidence-only rule (AD-5) directly. Prioritize responding quickly.
> **Mode gate**: Thorough mode only (iteration 2 only runs in Thorough).
> **Trigger**: After all Devil's Advocate iteration 2 agents complete.
> **Key rule**: Confidence can only increase or stay flat. New evidence required for any score increase (AD-5).

---

## Agent

**Model**: sonnet (formula application with per-finding differentiation)

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Re-Scoring Agent (Post-Iteration 2). You update confidence scores using new evidence from Devil's Advocate agents.

## Your Inputs
Read:
- {SCRATCHPAD}/confidence_scores.md (iteration 1 scores -- these are the BASELINE)
- {SCRATCHPAD}/depth_da_*_findings.md (all DA agent outputs from iteration 2)
- {SCRATCHPAD}/consensus_map.md (unchanged from iteration 1)

## Scoring Rules

### AD-5: New-Evidence-Only Re-Scoring
A finding's score may ONLY increase if the DA agent produced NEW evidence -- defined as:
- A new code reference not in the iteration 1 output
- A new tool output (static analyzer, RAG match)
- A new production verification result

Merely restating the same analysis with different words = ZERO confidence change.

### Monotonic Confidence
Confidence can only INCREASE or STAY FLAT between iterations. Evidence from prior iterations is preserved.

### No Self-Referential Scoring
Score based on evidence artifacts in scratchpad files, not on the DA agent's self-reported confidence.

### Formula (same as iteration 1)
```
composite = Evidence * 0.25 + Consensus * 0.25 + Analysis_Quality * 0.3 + RAG_Match * 0.2
```

RAG_Match remains at 0.3 (floor) until Phase 4b.5 RAG Sweep updates it.

### Re-evaluate Analysis Quality
For findings re-analyzed by DA agents, recount Depth Evidence tags including new ones from iteration 2.

### Loop Dynamics Detection
After re-scoring, classify the iteration dynamics:
- CONTRACTIVE: scores are converging (most findings moved toward CONFIDENT)
- OSCILLATORY: >50% of score changes are reversals -> force all uncertain to CONTESTED, exit loop
- EXPLORATORY: new findings or evidence paths discovered -> iteration 3 may be warranted

## Output

Update {SCRATCHPAD}/confidence_scores.md with new scores. Preserve iteration 1 scores in a history column.

Add a summary section:
```
## Re-Scoring Summary (Iteration 2)
- Findings re-scored: {N}
- Score increases: {U} (with new evidence)
- No change: {S} (no new evidence)
- Loop dynamics: {CONTRACTIVE/OSCILLATORY/EXPLORATORY}
- Remaining UNCERTAIN (Medium+): {count}
- Remaining LOW_CONFIDENCE: {count}
```

Write your output directly to {SCRATCHPAD}/confidence_scores.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {N} re-scored, {U} upgraded, dynamics={TYPE}, {R} still uncertain'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/confidence_scores.md` has been updated (contains "Re-Scoring Summary" section).

Write your output to {SCRATCHPAD}/confidence_scores.md and stop.
