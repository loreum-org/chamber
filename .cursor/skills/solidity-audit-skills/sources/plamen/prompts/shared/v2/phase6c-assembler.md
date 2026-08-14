# Phase 6c: Report Assembler

Execute the instructions below directly and stop. Do not spawn subagents.

> **Loaded by**: The V2 driver's Phase 6c subprocess (report assembly).
> **Model**: haiku for <=25 findings, sonnet for >25 findings (haiku truncated on
> large reports in prior audits).
> **Purpose**: Merges the three tier sections into the final AUDIT_REPORT.md with
> header, executive summary, summary table, priority remediation order, and
> optional appendix. Performs quality checks before writing. Self-contained
> methodology for the assembler phase.

---

## Your Inputs

Read:
- `{SCRATCHPAD}/report_index.md` (header info, summary counts, cross-reference map, excluded findings)
- `{SCRATCHPAD}/report_critical_high.md` (Critical + High sections)
- `{SCRATCHPAD}/report_medium.md` (Medium section)
- `{SCRATCHPAD}/report_low_info.md` (Low + Informational sections)
- `~/.claude/rules/report-template.md` (report structure template)

---

## STEP 1: Assemble Report

Combine sections in this order:

1. **Report Header** - from report_index.md header info
2. **Executive Summary** - 2-3 paragraphs summarizing the audit (write this yourself based on the findings). Written for a non-technical stakeholder.
3. **Summary Table** - from report_index.md counts
4. **Components Audited Table** - from report_index.md
5. **Critical Findings** - paste from report_critical_high.md (Critical section)
6. **High Findings** - paste from report_critical_high.md (High section)
7. **Medium Findings** - paste from report_medium.md
8. **Low Findings** - paste from report_low_info.md (Low section)
9. **Informational Findings** - paste from report_low_info.md (Informational section)
10. **Quality Observations** - paste from report_low_info.md (if megasection exists)
11. **Priority Remediation Order** - generate from report_index.md, ordered: Critical -> High -> Medium
12. **Appendix A: Excluded Findings** - client-facing exclusion summary only; do not include internal traceability columns

---

## STEP 1.5: Output Sanitization

Before writing the final report, sanitize all copied content:
- Strip control characters (form-feed, null bytes, BEL, etc.)
- Strip ANSI escape sequences (`\x1b[...m` and similar)
- Strip other non-printable bytes
- Exception: do NOT strip characters that are required source code in code fences

This prevents shell/tool output artifacts from leaking into the markdown report.

---

## STEP 2: Quality Checks

Before writing, verify ALL of the following:

### 2.1: Finding Count Matches Summary

Count `###` sections per severity tier. Must equal the summary table counts.

| Severity | Summary Table | Actual ### Sections | Match? |
|----------|--------------|--------------------:|--------|

If mismatch: fix by adding missing sections or correcting the summary count.

### 2.2: No Internal IDs in AUDIT_REPORT.md

Scan the full delivered report for these patterns:
- `[CS-`, `[AC-`, `[TF-`, `[BLIND-`, `[EN-`, `[SE-`, `[VS-`
- `[DEPTH-`, `[SLITHER-`, `[RS-`, `[PC-`, `[SP-`, `[DST-`
- `[DE-`, `[DX-`, `[DS-`, `[DT-`
- `CH-` (chain hypothesis IDs)
- Bracketed `H-` followed by numbers (hypothesis IDs like `[H-1]`, `H-23`)

NONE of these should appear in `AUDIT_REPORT.md`. If found, remove or replace with the corresponding report ID. Keep internal traceability in `report_index.md` and `report_coverage.md`.

### 2.2b: No Control Character Leakage

Check for and remove:
- Form-feed characters (`\f`)
- ANSI escape codes
- Null bytes
- Other non-printable characters copied from shell/tool output

### 2.3: Cross-References Valid

Check the cross-reference map from report_index.md. Every `see X-NN` reference in the report body must point to a finding that exists in the report.

### 2.4: No Duplicate Findings

No two sections should describe the same bug. If found, keep the more detailed one and remove the duplicate.

### 2.5: All Tier Files Present

If any tier file with assigned findings is missing or empty, STOP and report
the failure. Do not write "Section pending" placeholders. An empty tier is
valid only when the driver/index produced a zero-assignment manifest for that
tier; otherwise missing tier content is a fatal report-blocking failure.

---

## STEP 3: Write Final Report

Write the assembled report to: `{PROJECT_ROOT}/AUDIT_REPORT.md`

---

## Quality Check Results

Do NOT write `{SCRATCHPAD}/report_quality.md`. The V2 Python driver generates
that mechanical quality artifact after assembly. You may perform local checks
before writing `AUDIT_REPORT.md`, but the only file this phase owns is the final
report.

---

## Report Structure Template

The final report follows this structure:

```markdown
# Security Audit Report - [Project Name]

**Date**: [YYYY-MM-DD]
**Auditor**: Plamen Automated Security Analysis
**Scope**: [description]
**Language/Version**: [language and version]
**Build Status**: [Compiled successfully / Failed - reason]
**Static Analysis Status**: [Available / Unavailable - reason]

---

## Executive Summary

[2-3 paragraph overview: what the protocol does, what was found at a high level,
and the most critical risks.]

## Summary

| Severity | Count |
|----------|-------|
| Critical | [count] |
| High | [count] |
| Medium | [count] |
| Low | [count] |
| Informational | [count] |

### Components Audited

| Component | Path | Lines | Description |
|----------|------|-------|-------------|

---

## Critical Findings
[paste from tier file]

## High Findings
[paste from tier file]

## Medium Findings
[paste from tier file]

## Low Findings
[paste from tier file]

## Informational Findings
[paste from tier file]

## Quality Observations (optional)
[paste from tier file if exists]

---

## Priority Remediation Order

1. **C-01**: [one-line reason] - Immediate
2. **C-02**: [one-line reason] - Immediate
3. **H-01**: [one-line reason] - Before launch
...

---

## Appendix A: Excluded Findings (Optional)

| Severity | Title | Exclusion Reason |
|----------|-------|------------------|
```

---

## Model Selection Rule

- If total finding count from report_index.md <= 25: use `model="haiku"`
- If total finding count from report_index.md > 25: use `model="sonnet"`

Haiku truncates on large reports (learned from prior audits: 2,669-line report was truncated). Sonnet handles arbitrarily large assembly tasks.

---

## Executive Summary Writing Guidelines

The executive summary is the ONE section the assembler writes from scratch (all other sections are pasted from tier files). Guidelines:

1. First paragraph: What the protocol does (from report_index.md header info)
2. Second paragraph: High-level findings summary — how many critical/high, what the dominant vulnerability classes are
3. Third paragraph (optional): The most critical risk and recommended immediate action

Write for a non-technical stakeholder. No code references. No finding IDs in the executive summary.

---

## Priority Remediation Order Guidelines

Generate from the Master Finding Index in report_index.md:
- All Critical findings first (tagged "Immediate")
- All High findings next (tagged "Before launch")
- All Medium findings last (tagged "Before launch" or "Short-term")
- Low/Info are NOT included in remediation order

Each entry: `**{Report-ID}**: {one-line reason why this is urgent} - {timeline}`

---

SCOPE: Write ONLY to `{PROJECT_ROOT}/AUDIT_REPORT.md`. Do NOT write `{SCRATCHPAD}/report_quality.md` or any other scratchpad artifact. Do NOT re-run index or tier writers. Only return `DONE` after `AUDIT_REPORT.md` exists and you have checked that no "Section pending" placeholder remains. Return and stop.
