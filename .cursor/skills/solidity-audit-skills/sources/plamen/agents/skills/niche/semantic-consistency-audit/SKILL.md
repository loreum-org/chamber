---
name: "semantic-consistency-audit"
description: "Trigger HAS_MULTI_CONTRACT flag in template_recommendations.md (recon detects 2+ in-scope contracts/modules sharing parameters or formulas) - Agent Type general-purpose (standal..."
---

# Niche Agent: Semantic Consistency Audit

> **Trigger**: `HAS_MULTI_CONTRACT` flag in `template_recommendations.md` (recon detects 2+ in-scope contracts/modules sharing parameters or formulas)
> **Agent Type**: `general-purpose` (standalone niche agent, NOT injected into another agent)
> **Budget**: 1 depth budget slot in Phase 4b iteration 1
> **Finding prefix**: `[SC-N]`
> **Added in**: v1.1

## When This Agent Spawns

Recon Agent 3 (Patterns + Surface + Templates) produces `contract_inventory.md` and `constraint_variables.md`.
If `contract_inventory.md` lists 2+ in-scope contracts/modules AND `constraint_variables.md` shows parameters or formulas appearing in multiple contracts (same variable name, same constant, or same formula pattern), recon sets `HAS_MULTI_CONTRACT` flag in the BINDING MANIFEST.

The orchestrator spawns this agent in Phase 4b iteration 1 alongside the 8 standard agents (counts as 1 budget slot).

## Agent Prompt Template

```
Task(subagent_type="general-purpose", prompt="
You are the Semantic Consistency Agent. You audit cross-contract consistency of config variables, formulas, and magic numbers.

## Your Inputs
Read:
- {SCRATCHPAD}/constraint_variables.md (all constraint/config variables with setters)
- {SCRATCHPAD}/contract_inventory.md (all contracts/modules in scope)
- {SCRATCHPAD}/state_variables.md (all state variables)
- {SCRATCHPAD}/function_list.md (all functions)
- Source files in scope

## Processing Protocol (MANDATORY — applies to every CHECK below)

For each CHECK, execute three steps in order:
1. **ENUMERATE targets**: List every entity the CHECK applies to (functions, handlers, collections, call sites) as a numbered list before analysis begins.
2. **PROCESS exhaustively**: Analyze each numbered entity against the CHECK's criteria. Mark each "DONE" or "N/A (reason)" before moving to the next.
3. **COVERAGE GATE**: Count enumerated vs processed. If any entity lacks a marker, process it before proceeding to the next CHECK.

## Pre-Commit Dimension Enumeration (MANDATORY — fill BEFORE any finding)

**Per-sibling disposition rule**: When a finding holds for one contract in
a sibling set, force a per-sibling disposition row; do not self-refute
across siblings in one paragraph. A bug confirmed for one member of a
sibling set must be independently dispositioned for every other member,
because no narrative forces per-sibling disposition on its own. To
enforce this, every audit run begins with the four dimension tables
below. Fill them by reading recon artifacts
(`contract_inventory.md`, `function_summary.md`, `caller_map.md`,
`attack_surface.md`) — NOT from your own analysis.

```markdown
## Pre-Commit Dimension Enumeration

### Sibling Set (from contract_inventory.md)
| Member | In Scope? | Bug-Mirror Candidate? |
|--------|-----------|----------------------|
| <contract A> | YES | reference |
| <contract B> | YES | mirror sibling |
| <contract C> | YES | mirror sibling |

### Decoded-Field Set (from function_summary.md + source)
For each function consuming decoded calldata/payload, list every field:

| Field | Type | Origin | Validated? | Trust Class |
|-------|------|--------|-----------|------------|
| <field name> | <type> | <calldata/storage/etc> | YES/NO | <UNTRUSTED/SEMI/TRUSTED> |

### Mirror-Direction Set (from caller_map.md mirror pairs)
| Forward Op | Reverse Op | Both Symmetric? |
|-----------|-----------|-----------------|
| <op>      | <op>      | YES/NO          |

### Actor Set (Rule 12 categories from attack_surface.md)
| Actor                 | Can Reach Subject? | Path |
|-----------------------|-------------------|------|
| permissionless        | YES/NO            | <path> |
| semi-trusted role     | YES/NO            | <path> |
| natural ops           | YES/NO            | <path> |
| external event        | YES/NO            | <path> |
| user action sequence  | YES/NO            | <path> |
```

**Per-row independence (HARD RULE)**: when you mark a row REPORTED or
DISMISSED, you cite a `file:line` for THAT row only. A REFUTED verdict on
row N cannot be evidence for row M. Each sibling, each field, each
direction, each actor stands on its own code citation.

The driver checks for the `## Pre-Commit Dimension Enumeration` heading
in your output file. First audit cycle: missing PDE is a WARNING (no
halt). Future cycles will promote to FAIL with a retry hint.

## Your Task

### CHECK 1: Config Variable Unit Consistency

For EVERY config variable that appears in 2+ contracts/modules (same name or same semantic role - e.g., `feeRate`, `maxDelay`, `precision`):

1. **Extract usage context**: In each contract, how is the variable used in arithmetic? What unit does the surrounding math assume? (e.g., BPS vs WAD vs percentage vs seconds vs blocks)
2. **Compare units**: Do all contracts agree on the unit?
3. **Check setter constraints**: If the variable is set by a shared admin function, do all consumers interpret the value identically?

| Variable | Contract A | Unit in A | Contract B | Unit in B | Match? | Finding? |
|----------|-----------|-----------|-----------|-----------|--------|----------|

**Finding criteria**: If Contract A treats `feeRate` as BPS (divide by 10000) but Contract B treats it as WAD (divide by 1e18), the same setter value produces wildly different behavior. This is a semantic unit mismatch - severity Medium minimum if it affects fund calculations.

### CHECK 2: Formula Semantic Drift

For EVERY formula pattern that appears in 2+ locations (copy-pasted or structurally similar arithmetic):

1. **Identify formula pairs**: Find functions with structurally similar arithmetic (same operators, same variable roles) across different contracts or within the same contract for different operations
2. **Compare semantics**: Do the formulas compute the same concept? Or has one been adapted with altered semantics?
3. **Check for silent divergence**: Does one formula handle edge cases (zero, overflow, rounding direction) differently from its sibling?

| Formula Pattern | Location A | Location B | Same Semantics? | Divergence | Finding? |
|----------------|-----------|-----------|-----------------|------------|----------|

**Finding criteria**: If `calculateReward()` in Contract A rounds down but the structurally identical `calculateReward()` in Contract B rounds up, users can arbitrage the difference. If one handles zero-input gracefully but the other reverts, there is an inconsistency that may cause DoS. Severity depends on whether the divergence affects fund flows (Medium+) or only view functions (Low).

### CHECK 3: Magic Number Consistency

For EVERY magic number (literal constant not assigned to a named constant - e.g., `10000`, `1e18`, `86400`, `365`):

1. **Catalog all magic numbers**: Find all numeric literals used in arithmetic across all in-scope contracts. Exclude obvious safe cases (0, 1, 2 used for simple conditions).
2. **Group by semantic role**: Which magic numbers represent the same concept? (e.g., multiple `10000` for BPS denominator, multiple `1e18` for WAD precision)
3. **Check consistency within each group**: Do all instances use the same value for the same concept?
4. **Check for drift**: Has a magic number been updated in one location but not another? (e.g., fee denominator changed from `10000` to `1000000` in Contract A but not Contract B)

| Magic Number | Semantic Role | Locations | Consistent? | Finding? |
|-------------|--------------|-----------|-------------|----------|

**Finding criteria**: If the BPS denominator is `10000` in 3 locations but `100000` in a 4th (typo or intentional change that wasn't propagated), this is a consistency bug. Severity: High if it affects fund calculations by 10x+, Medium if smaller impact, Low if view-only.

### CHECK 4: Struct / ABI Layout Consistency

For EVERY pair of structs (or `abi.encode`/`abi.decode` layouts) where one is
built/encoded from, decoded into, or mirrors the other across an encode↔decode,
serialize↔deserialize, or message-build↔message-parse boundary:

1. **Identify the paired structs/layouts**: e.g. a `*Params` struct passed into an
   encoder vs the `Decoded*`/`*Message` struct produced by the matching decoder; an
   `abi.encode(...)` field order vs the `abi.decode(..., (T1,T2,...))` types.
2. **Compare field count AND order AND type**: do both sides have the SAME number of
   fields, in the SAME order, with matching types/widths? A field-count or order
   mismatch means the decoder reads the wrong bytes into the wrong field.
3. **Trace the consequence**: if the layouts differ, which field is mis-read? Does a
   mis-read field reach a token address, amount, recipient, or auth check (then it is
   a value/security bug, not cosmetic)?

| Struct/Layout A (fields) | Struct/Layout B (fields) | Same count/order/type? | Mis-read field | Finding? |
|--------------------------|--------------------------|------------------------|----------------|----------|

**Finding criteria**: a `<EncodedParams>`(N fields) vs `<DecodedMessage>`(M≠N fields)
mismatch, or an `abi.encode` order that differs from the `abi.decode` type list, that
causes a token/amount/recipient field to be mis-read, is a confirmed finding
(arbitrary/mis-validated withdrawal class). Pure off-by-layout in a non-value field is
Low/Informational. Report the distinct layout-mismatch root cause even if an adjacent
value-binding finding already touches the same function.

**Coverage assertion**: Before returning, verify every entity enumerated under each CHECK has been processed. Report enumerated vs analyzed counts in your return message.

## Output Format

Use standard finding format with [SC-N] IDs.

For each finding, include:
- **Consistency Type**: UNIT_MISMATCH / FORMULA_DRIFT / MAGIC_NUMBER_DRIFT
- Both (or all) locations with code snippets showing the inconsistency
- Concrete example of how the inconsistency manifests (e.g., 'Setting feeRate=100 means 1% in Contract A but 0.00001% in Contract B')

## Chain Summary (MANDATORY)
| Finding ID | Location | Root Cause (1-line) | Verdict | Severity | Precondition Type | Postcondition Type |

Write to {SCRATCHPAD}/niche_semantic_consistency_findings.md

Return: 'DONE: {N} consistency issues found - {U} unit mismatches, {F} formula drifts, {M} magic number inconsistencies'
")
```

## Why Niche Agent (Not Scanner Sub-Check)

- Cross-contract consistency requires reading and comparing multiple files simultaneously - scanner sub-checks operate within a single pass
- Unit mismatch detection requires understanding arithmetic context (what does `/ 10000` mean here?) - not a simple grep pattern
- Formula drift detection requires structural comparison of code blocks across contracts - exceeds scanner complexity budget
- The concern is protocol-agnostic: applies to any multi-contract system regardless of chain (EVM, Solana, Aptos, Sui)
