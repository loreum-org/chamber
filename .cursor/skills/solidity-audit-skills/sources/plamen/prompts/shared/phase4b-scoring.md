---
description: "Phase 4b Step 2: Confidence Scoring after depth iteration 1"
---

# Phase 4b: Confidence Scoring (Post-Iteration 1)

> **Efficiency**: This is a mechanical formula-application task. Prioritize responding quickly rather than thinking deeply. Apply the scoring formulas directly without extensive reasoning.
> **Mode gate**: Light mode skips scoring entirely. Core uses 2-axis. Thorough uses 4-axis.
> **Reference**: Full scoring model, formulas, and routing thresholds are in `~/.claude/rules/phase4-confidence-scoring.md`.

This step runs after ALL depth iteration 1 agents (depth, scanners, validation sweep, niche) have completed. It scores every finding to determine which need further depth analysis.

---

## Pre-Step: Build Consensus Map (Orchestrator Inline)

Before spawning the scoring agent, the orchestrator builds `{SCRATCHPAD}/consensus_map.md`:

For each finding in `{SCRATCHPAD}/findings_inventory.md`:
1. Identify which agents' domains cover the finding's location
2. Count how many of those agents flagged the same root cause
3. Compute: `consensus = flagging_agents / covering_agents` (if only 1 agent covers -> 1.0 if found)
4. Apply specialized agent bonus: +0.2 when found by a Required skill template agent (cap at 1.0)

Write the consensus map to `{SCRATCHPAD}/consensus_map.md`.

---

## Scoring Agent

**Model**: sonnet (formula application with per-finding differentiation)

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are the Confidence Scoring Agent. You apply a mechanical formula to score every finding.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md (all findings with verdicts and evidence tags)
- {SCRATCHPAD}/depth_*_findings.md (depth agent outputs -- for Depth Evidence tag counts)
- {SCRATCHPAD}/blind_spot_*_findings.md or scanner_*_findings.md (scanner outputs)
- {SCRATCHPAD}/validation_sweep_findings.md or scanner_validation_findings.md
- {SCRATCHPAD}/niche_*_findings.md (if any exist)
- {SCRATCHPAD}/consensus_map.md (pre-computed consensus scores)
- ~/.claude/rules/phase4-confidence-scoring.md (full scoring model reference)

## Scoring Formula

### Mode: {MODE}

**If Core (2-axis)**:
```
composite = Evidence * 0.5 + Analysis_Quality * 0.5
```

**If Thorough (4-axis)**:
```
composite = Evidence * 0.25 + Consensus * 0.25 + Analysis_Quality * 0.3 + RAG_Match * 0.2
```
NOTE: RAG_Match defaults to 0.3 (floor) until Phase 4b.5 RAG Sweep runs. The final composite with real RAG scores is computed in a separate re-scoring step after the RAG Sweep.

### Axis Scoring Rules

**Evidence axis**: Best evidence tag determines score:
- [PROD-ONCHAIN]=1.0, [PROD-SOURCE]=0.9, [PROD-FORK]=0.9, [MEDUSA-PASS]=1.0
- [CODE]=0.8, [DOC]=0.4, [MOCK]=0.2, [EXT-UNV]=0.1

**Analysis Quality axis (dual-mode)**:
- **Mode A** (depth agent findings, including [DST-*]): Count Depth Evidence tags: 0=0.1, 1=0.4, 2=0.7, 3+=1.0
- **Mode B** (all other findings): (steps marked checkmark) / (total applicable steps). Steps with valid skip reason count as checkmark.

**Consensus axis** (Thorough only): Read from consensus_map.md.

**RAG Match axis** (Thorough only): Default 0.3 for now. Updated after Phase 4b.5.

### Routing Thresholds
- >= 0.7: CONFIDENT (no more depth needed)
- 0.4-0.7: UNCERTAIN (targeted depth in iteration 2)
- < 0.4: LOW_CONFIDENCE (targeted depth + production verification + RAG deep search)

### Per-Finding Differentiation (MANDATORY)
Each finding's composite MUST be computed from its individual evidence tags, consensus map entry, and analysis quality indicators. If two findings have different evidence profiles, their composites MUST differ. Identical composites for 4+ consecutive findings indicates formulaic stub scoring — re-read each finding's actual data before continuing.

## Output

Write to {SCRATCHPAD}/confidence_scores.md:

| Finding ID | Evidence | Consensus | Quality | RAG | Composite | Classification |
|------------|----------|-----------|---------|-----|-----------|----------------|

Write your output directly to {SCRATCHPAD}/confidence_scores.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {N} findings scored -- {C} CONFIDENT, {U} UNCERTAIN, {L} LOW_CONFIDENCE'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/confidence_scores.md` exists on disk.

Write `{SCRATCHPAD}/confidence_scores.md` and stop.
