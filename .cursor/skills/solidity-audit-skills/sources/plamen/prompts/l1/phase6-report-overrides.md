---
description: "Phase 6: L1 Report Overrides — appended to every tier writer prompt for L1 audits"
---

# L1 Report Overrides

> **Purpose**: This file contains L1-specific rules that MUST be appended verbatim to every
> Phase 6 tier writer prompt (Critical+High, Medium, Low+Info) and to the Assembler prompt.
> It overrides smart-contract report conventions with L1-appropriate severity rationale,
> evidence tags, calibration rules, and executive summary framing.
>
> **How to use**: The driver appends this file's content via `--append-system-prompt-file`
> to each tier writer and assembler invocation. The standard report template
> (`~/.claude/rules/phase6-report-prompts.md`) still applies for structure and formatting;
> this file provides L1-specific overrides only.

---

## L1 MODE OVERRIDES (MANDATORY -- append to every finding section)

### Rule 1: Severity Matrix

Use the L1 severity matrix at `docs/l1-mode/severity-matrix.md`, NOT the smart-contract
matrix in `~/.claude/rules/report-template.md`.

The L1 matrix uses different impact categories:
- **Critical**: Network-wide consensus failure, chain halt, finality violation, >33% stake slashing
- **High**: Single-client consensus halt, targeted node crash, validator equivocation enabler
- **Medium**: Targeted DoS (recoverable), information leakage, non-determinism in non-consensus path
- **Low**: Performance degradation, logging issues, dead code in non-critical path
- **Informational**: Style, documentation, unused imports, test-only issues

### Rule 2: Mandatory Severity Rationale Field

Every finding MUST include a `**Severity rationale**:` field. No exceptions -- Critical
through Informational all require it. Format:

```
**Severity rationale**: Impact: {cell from L1 matrix -- e.g., "High -- single-client consensus halt"}
/ Likelihood: {cell -- e.g., "Medium -- specific conditions (requires post-auth peer)"}
/ Modifiers: {list -- e.g., "+1 for Byzantine stake >=33%", or "none"}
/ Resulting tier: {final tier}
```

### Rule 3: L1 Evidence Tags

Only the following evidence tags are valid in L1 reports:

| Tag | Meaning | Weight |
|-----|---------|--------|
| `[DIFF-PASS]` | Fork diff proves divergence from upstream introduces the bug | Mechanical proof |
| `[CONFORMANCE-PASS]` | Conformance test against spec proves violation | Mechanical proof |
| `[NON-DET-PASS]` | Non-determinism test proves divergent execution across runs/clients | Mechanical proof |
| `[FUZZ-PASS]` | Fuzzer found a counterexample (crash, panic, invariant violation) | Mechanical proof |
| `[LSP-TRACE]` | SCIP-backed code navigation trace with cross-reference evidence | Strong trace |
| `[POC-PASS]` | Compiled and executed PoC with passing assertions | Mechanical proof |
| `[CODE-TRACE]` | Manual trace with concrete values, no execution | Fallible trace |

**`[LSP-TRACE]` requirements**: The Evidence field MUST contain a citation to a specific
`{SCRATCHPAD}/scip/*.md` file (e.g., `call_graph_consensus.md`, `xref_map.md`).
An `[LSP-TRACE]` tag without a scip/ citation is invalid and will be caught by Gate 4.

**Tag hierarchy for severity caps**:
- Mechanical proof tags (`[DIFF-PASS]`, `[CONFORMANCE-PASS]`, `[NON-DET-PASS]`, `[FUZZ-PASS]`,
  `[POC-PASS]`) support any severity
- `[LSP-TRACE]` supports up to High (Critical requires mechanical proof)
- `[CODE-TRACE]` caps at Medium (or CONTESTED if the trace is incomplete)

### Rule 4: Source Citation Requirement

The Evidence field of every finding MUST contain a `file:line` reference that exists in the
source tree. Extract these from `findings_inventory.md`, `depth_*_findings.md`, or
`verify_*.md`.

If no source-line citation is available for a finding, the tier writer MUST:
1. Mark the finding `[EVIDENCE: UNVERIFIED EXTRAPOLATION]` in its header
2. Downgrade its severity by 1 tier (floor: Informational)
3. Log `[MEDIUM-TIER EXTRAPOLATION] {report_id}: {reason}` to `{SCRATCHPAD}/violations.md`

### Rule 5: Latent Dead-Code Calibration

Findings describing code that exists but is not currently reachable in production (dead
branches, disabled features, `#[cfg]`-gated paths not in the build, `//nolint`-suppressed
paths) are capped at **High** unless a PoC demonstrates a realistic activation path.
They cannot be Critical.

---

## L1 Executive Summary Framing

The Executive Summary section MUST use L1-appropriate framing:

- Frame the audit target as a **node client / infrastructure component**, not a "smart contract
  protocol" or "DeFi application"
- Describe the threat model in terms of **network actors** (anonymous peers, post-auth peers,
  validators, RPC clients), not "users" and "admins"
- Reference the **Sigma Prime 8-layer framework** for the architecture decomposition
- State which layers were audited and which were out of scope
- Mention the SCIP primitive layer status (available/degraded) and its impact on analysis quality
- Do NOT reference "chain analysis" or "compound exploits" -- L1 mode does not run Phase 4c

---

## Section Omissions

The following standard report sections are NOT applicable in L1 mode:

- **Chain Analysis section**: L1 mode removes Phase 4c. Do not create a "Chain Findings"
  or "Compound Exploits" section. Findings are point vulnerabilities.
- **Flash Loan / MEV section**: Not applicable to node-client audits
- **Token Flow section**: `depth-token-flow` does not load in L1 mode

---

## Report Header Additions

The report header MUST include:

```markdown
**Audit Mode**: L1 Infrastructure (experimental)
**Phase 0.5 Bake**: {status from primitive_status.md -- e.g., "SCIP Go index: OK, Opengrep: 12 hits"}
**Severity Matrix**: L1-specific (docs/l1-mode/severity-matrix.md)
**Layers Audited**: {list from recon_summary.md}
**Layers Out of Scope**: {list of layers with false flags}
```
