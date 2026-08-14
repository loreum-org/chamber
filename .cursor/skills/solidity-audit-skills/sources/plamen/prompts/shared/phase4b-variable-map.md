---
description: "Phase 4b: Variable-Finding Cross-Reference Map for chain analysis"
---

# Phase 4b: Variable-Finding Cross-Reference Map

> **Efficiency**: This is a mechanical cross-reference task. Map variables to findings directly without extensive reasoning.
> **Purpose**: Create a cross-reference mapping state variables to findings that read or write them. Used by Chain Agent 2 for variable-level postcondition-to-precondition matching.
> **Trigger**: Always runs after depth iteration 1 completes, before chain analysis.

---

## Agent

**Model**: haiku (mechanical cross-referencing task)

```
Task(subagent_type="general-purpose", model="haiku", prompt="
You are the Variable-Finding Cross-Reference Agent. You map state variables to findings.

## Your Inputs
Read:
- {SCRATCHPAD}/state_variables.md (all state variables from recon)
- {SCRATCHPAD}/findings_inventory.md (all findings with locations and descriptions)

## Your Task

For EACH state variable in state_variables.md:
1. Search findings_inventory.md for all findings that reference this variable by name
2. For each match, classify the reference as: READS, WRITES, or BOTH
3. Record the finding ID and the nature of the reference

For EACH finding in findings_inventory.md:
1. Extract all state variable names mentioned in its Description, Evidence, or Location fields
2. Cross-reference against state_variables.md

## Output

Write to {SCRATCHPAD}/variable_finding_map.md:

| Variable | Contract | Findings That WRITE | Findings That READ | Findings That Reference |
|----------|----------|--------------------|--------------------|------------------------|

Write your output directly to {SCRATCHPAD}/variable_finding_map.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {V} variables mapped to {F} finding references written to variable_finding_map.md'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/variable_finding_map.md` exists on disk.

Write your output to {SCRATCHPAD}/variable_finding_map.md and stop.
