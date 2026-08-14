---
description: "Phase 4a.5 Pass 2: Recursive Semantic Gap Trace (Thorough mode only)"
---

# Phase 4a.5 Pass 2: Recursive Semantic Gap Trace

> **Mode gate**: Thorough only. Core mode runs Pass 1 only.
> **Prerequisite**: `{SCRATCHPAD}/semantic_invariants.md` must exist from Pass 1.
> **Timeout fallback**: If this agent times out, proceed to Phase 4b. Pass 1 data is sufficient for depth agents. Log: "Phase 4a.5 Pass 2 TIMEOUT -- using Pass 1 data only."

This pass reads the SYNC_GAP, ACCUMULATION_EXPOSURE, CONDITIONAL, and CLUSTER_GAP flags from Pass 1 and recursively traces each flagged variable to determine whether the gap is a real vulnerability or a false positive.

---

## Agent Prompt

Spawn a single sonnet agent:

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are Semantic Invariant Agent -- Pass 2 (Recursive Gap Trace).

## Your Task

Pass 1 flagged variables with potential consistency gaps. Your job is to recursively trace each flag to a definitive classification.

## Your Inputs
Read:
- {SCRATCHPAD}/semantic_invariants.md (Pass 1 output -- focus on flagged entries)
- {SCRATCHPAD}/state_variables.md (all state variables)
- {SCRATCHPAD}/function_list.md (all functions)
- Source files referenced in the flagged entries

## Methodology

For EACH flagged entry in semantic_invariants.md (SYNC_GAP, ACCUMULATION_EXPOSURE, CONDITIONAL, CLUSTER_GAP):

### Step 1: Enumerate All Write Sites
List every function that writes to the flagged variable. Include:
- Direct assignments
- Increment/decrement operations
- Delete/reset operations
- Indirect writes through mappings or structs

### Step 2: Trace Consistency Restoration
For each write site, ask: does ANY code path starting from this write eventually restore consistency with the variable's cluster peers?
- If YES in all paths: the gap is RESOLVED
- If YES only under access control: the gap is GUARDED
- If NO path restores consistency: the gap is CONFIRMED

### Step 3: Cross-Reference with Access Control
For GUARDED gaps, identify the access control:
- Is it admin-only? (lower risk, but still reportable as centralization)
- Is it role-based? (check if the role can be externally acquired)
- Is it time-based? (check if timing window is exploitable)

### Step 4: Classify Each Gap

| Classification | Meaning | Action |
|---------------|---------|--------|
| CONFIRMED_GAP | No path restores consistency; exploitable | Flag for depth agents |
| GUARDED_GAP | Access control prevents exploitation | Note the guard; lower severity |
| RESOLVED_GAP | Consistency restored within bounded operations | No further action |
| UNCLEAR | Cannot determine mechanically | Flag for depth agents with investigation question |

## Output

Append a new section to {SCRATCHPAD}/semantic_invariants.md:

```markdown
## Pass 2: Recursive Trace Results

| Variable | Flag | Classification | Guard/Resolution | Investigation Question |
|----------|------|---------------|-----------------|----------------------|

### Summary Flags (for Semantic Gap Investigator niche agent trigger)
- sync_gaps: {count of CONFIRMED_GAP with SYNC_GAP flag}
- accumulation_exposures: {count of CONFIRMED_GAP with ACCUMULATION_EXPOSURE flag}
- conditional_writes: {count of CONFIRMED_GAP with CONDITIONAL flag}
- cluster_gaps: {count of CONFIRMED_GAP with CLUSTER_GAP flag}
```

Return: 'DONE: {N} gaps traced -- {C} confirmed, {G} guarded, {R} resolved, {U} unclear'

SCOPE: Append ONLY to semantic_invariants.md. Do NOT write to other files. Do NOT proceed to subsequent phases. Return your findings and stop.
")
```
