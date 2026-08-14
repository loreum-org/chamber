---
description: "Phase 4a.5: Semantic Invariant Pre-Computation (variable write sites, clustering, recursive gap traces)"
---

# Phase 4a.5: Semantic Invariant Pre-Computation

> **Mode gate**: Skip entirely in Light mode. Depth agents read `state_variables.md` directly.
> **Timeout fallback**: If the semantic invariant agent times out or fails, proceed to Phase 4b without `semantic_invariants.md`. Depth agents fall back to reading `state_variables.md` directly. Log: "Phase 4a.5 TIMEOUT -- depth agents using state_variables.md fallback."

This phase runs between Phase 4a (inventory) and Phase 4b (depth loop). It produces semantic invariant data that depth agents use for state consistency analysis.

---

## Pass 1: Variable -> Write Sites + Semantic Clustering

**Model**: sonnet
**Trigger**: Always (Core and Thorough)

Spawn a single agent:

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are Semantic Invariant Agent -- Pass 1. You enumerate write sites, define semantic invariants, and group variables into semantic clusters.

## Your Inputs
Read:
- {SCRATCHPAD}/state_variables.md (all state variables from recon)
- {SCRATCHPAD}/function_list.md (all functions)
- Source files referenced in state_variables.md

## Your Task

For EACH accumulator, snapshot, or total-tracking variable in state_variables.md:

1. **Enumerate write sites**: Use grep to find ALL locations that write to this variable.
2. **State the semantic invariant**: In ONE sentence, what SHOULD this variable represent?
3. **Enumerate value-changing functions**: Find ALL functions that change the UNDERLYING VALUE the variable tracks -- whether or not they update the variable.
4. **Annotate conditional writes**: For each write site, check if the write is inside a conditional block. If YES, annotate as CONDITIONAL(condition_expression).
4a. **Detect asymmetric branches**: For each CONDITIONAL write, check if the SAME function also writes UNCONDITIONALLY to a different tracking variable. If YES, flag as ASYMMETRIC_BRANCH.
5. **Detect mirror variables**: Identify variable PAIRS tracking the same concept in different storage. For each pair, list ALL functions that write to EITHER. If any function writes to one but not the other -> flag as SYNC_GAP.
6. **Flag time-weighted accumulation inputs**: For (value x time_delta) calculations, note controllable inputs and whether time_delta can grow unboundedly. Flag as ACCUMULATION_EXPOSURE if both true.

## Semantic Clustering

Group ALL enumerated variables into semantic clusters -- groups of variables collectively representing a single domain or lifecycle. For each cluster, identify which functions write ALL members (full-write) vs only SOME members (partial-write).

## Output

Write to {SCRATCHPAD}/semantic_invariants.md:

### Main Table
| Variable | Contract/Module | Semantic Invariant | Write Sites (with CONDITIONAL annotations) | Value-Changing Functions | Potential Gaps |

### Mirror Variable Pairs
| Variable A | Variable B | Same Concept | Functions Writing A Only | Functions Writing B Only | Sync Gaps |

### Time-Weighted Accumulators
| Accumulator | Formula Pattern | Controllable Input | Time Source | Unbounded Delta? | Exposure |

### Semantic Clusters
| Cluster Name | Variables | Lifecycle Functions | Full-Write Functions | Partial-Write Functions |

Write your output directly to {SCRATCHPAD}/semantic_invariants.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {N} variables, {M} gaps, {C} conditional, {S} sync_gaps, {A} accumulation, {K} clusters written to semantic_invariants.md'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/semantic_invariants.md` exists on disk.

If `{MODE}` is not `thorough`, stop here. Phase 4a.5 is complete.

---

## Pass 2: Function -> Cluster Coverage + Recursive Gap Trace (Thorough only)

**Model**: sonnet
**Trigger**: Thorough mode only

Spawn after Pass 1 completes:

```
Task(subagent_type="general-purpose", model="sonnet", prompt="
You are Semantic Invariant Agent -- Pass 2. You reverse the analysis direction: for each function, check which clusters it touches incompletely, then recursively trace consequences of stale reads.

## Your Inputs
Read:
- {SCRATCHPAD}/semantic_invariants.md (Pass 1 output)
- {SCRATCHPAD}/function_list.md
- Source files for all Partial-Write Functions from the Semantic Clusters table

## STEP 1: Cluster Coverage Audit

For each Partial-Write Function in the Semantic Clusters table:
1. Which cluster members does it write? Which does it SKIP?
2. For each skipped member: describe in ONE factual sentence WHY it is skipped. This is a FACTUAL ANNOTATION -- do NOT judge whether the skip is safe.
3. Flag ALL skips as CLUSTER_GAP -- no exceptions.

## STEP 2: Recursive Consequence Trace

For each CLUSTER_GAP, SYNC_GAP, and CONDITIONAL where the skip path is reachable:
1. **Level 0**: Identify the stale variable and the function that leaves it stale
2. **Level 1**: Find ALL functions that READ the stale variable. What value do they produce stale vs correct?
3. **Level 2**: For each Level 1 reader that WRITES a different variable using the stale-derived value, find readers of THAT variable.
4. **Level 3**: Repeat one more level. If error still propagates -> flag as DEEP_PROPAGATION.

## STEP 3: Cross-Verify Pass 1 Write Sites

For each function in function_list.md that Pass 1 did NOT list as a write site for ANY variable:
1. Read the function source
2. Check: does it write to ANY state variable from the Main Table?
3. If YES and Pass 1 missed it -> add as MISSED_WRITE_SITE

## STEP 4: Branch Path Completeness

For each function with >=2 branches:
1. List variables written on EACH branch path
2. If any branch writes a variable that another branch does NOT -> flag as BRANCH_ASYMMETRY
3. For each asymmetry: is the missing write a stale-read source for any consumer?

## Output

Append to {SCRATCHPAD}/semantic_invariants.md:

### Cluster Coverage Gaps
| Function | Cluster | Written Members | Skipped Members | Skip Context (factual) | Flag |

### Recursive Consequence Traces
| Gap Source | Stale Variable | L0 Function | L1 Readers -> Impact | L2 Readers -> Impact | L3? | Max Window |

### Missed Write Sites (Cross-Verification)
| Variable | Missed Function | Write Type |

### Branch Path Asymmetries
| Function | Condition | Written on True | Written on False | Consumer Impact |

Write your output directly by appending to {SCRATCHPAD}/semantic_invariants.md using the Write tool.
Return ONLY a one-line summary: 'DONE: {G} cluster_gaps, {T} consequence traces ({D} deep_propagation), {W} missed_write_sites, {B} branch_asymmetries written to semantic_invariants.md'
Do NOT return your full output as text.
")
```

After the agent returns, verify `{SCRATCHPAD}/semantic_invariants.md` has grown (contains Pass 2 sections).

After all agents return, verify output files exist on disk and stop.
