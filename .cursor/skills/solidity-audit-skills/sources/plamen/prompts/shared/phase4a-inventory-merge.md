---
description: "Phase 4a: Inventory Merge -- append rescan/per-contract findings to findings_inventory.md"
---

# Phase 4a: Inventory Merge

> **Efficiency**: This is a mechanical merge task. Append new findings to inventory without re-analyzing existing entries. Prioritize responding quickly.
> **Trigger**: Only runs if Phase 3b (rescan) or Phase 3c (per-contract) produced new findings above Info severity.
> **Timing**: After Phase 3b rescan loop AND Phase 3c per-contract analysis both complete, before Phase 4a.5 (semantic invariants) and Phase 4b (depth loop).
> **Purpose**: Ensures new findings from rescan/per-contract passes are included in the inventory before downstream phases consume it.

---

## Agent

**Model**: haiku (lightweight merge task)

```
Task(subagent_type="general-purpose", model="haiku", prompt="
You are the Inventory Merge Agent. You append new findings from breadth re-scan and per-contract analysis to the findings inventory.

## Your Inputs
Read:
- {SCRATCHPAD}/findings_inventory.md (existing inventory from Phase 4a)
- {SCRATCHPAD}/analysis_rescan_*.md (rescan findings -- may not exist if rescan found nothing)
- {SCRATCHPAD}/analysis_percontract_*.md (per-contract findings -- may not exist if per-contract found nothing)

## Your Task

1. Read each analysis_rescan_*.md and analysis_percontract_*.md file that exists
2. For each finding in these files:
   a. Check if it duplicates an existing finding in findings_inventory.md (same location + same root cause = duplicate)
   b. If NOT duplicate: append to findings_inventory.md using the same format as existing entries
   c. If duplicate: skip and note as discarded
3. Preserve ALL existing entries in findings_inventory.md -- only APPEND new ones
4. Assign new finding IDs that do not conflict with existing IDs

## Output

Update {SCRATCHPAD}/findings_inventory.md by appending new entries.

Add a merge summary section at the end:

```markdown
## Inventory Merge (Post-Rescan/Per-Contract)
- Rescan findings reviewed: {N}
- Per-contract findings reviewed: {M}
- New findings appended: {A}
- Duplicates discarded: {D}
- New finding IDs: {list}
```

Write your output directly to {SCRATCHPAD}/findings_inventory.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {A} new findings appended, {D} duplicates discarded'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/findings_inventory.md` contains the "Inventory Merge" section.

Write your output to {SCRATCHPAD}/findings_inventory.md and stop.
