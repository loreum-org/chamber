---
name: audit-prep
description: >
  Prepare Solidity projects for a security audit — test coverage, test quality, NatSpec docs,
  code hygiene, dependency health, best-practice enforcement, deployment readiness, and project
  documentation checks. Generates a scored Audit Readiness Report and optionally runs static analysis.
  Trigger on: "prepare for audit", "audit readiness", "pre-audit check", "audit prep", "NatSpec check",
  or any request to review a Solidity codebase before a security review.
---

# Solidity Audit Preparation — Orchestrator

Orchestrate a parallelized audit-prep pipeline.
Do NOT perform analysis — discover files, dispatch agents, compile the scored report.

## Modes

- **Default:** full pipeline, all 8 phases + static analysis offer.
- **Single phase:** `coverage` | `quality` | `docs` | `hygiene` | `deps` | `practices` | `deploy` | `context`
- **`scan`:** static analysis only.
- **`--fix`:** auto-apply fixes (NatSpec stubs, console removal, pragma locking, SafeERC20 wrapping).
- **`--report <path>`:** write markdown report to file (no ANSI codes).
- **`--no-scan`:** skip static analysis offer.
- **`--scanner <tool>`:** run specific tool without prompting.
- **`--diff <ref>`:** scope to files changed since git ref.
- **`--ci`:** JSON output. Exit 0 if score >= threshold (default 75, `--min-score N`).

## Report Format

Clean markdown. Each phase = one table with Status, Finding, and Recommendation columns.
Score summary at the end. When rendered via `--report`, produces a polished `.md` file.

The report has these sections in order:
1. Header (project, framework, scope)
2. Phase 1–8, each as a titled section with a results table
3. Score summary table
4. Quick Wins table

### Banner

Print the banner from the end of this file before doing anything else — in every mode (full pipeline, single phase, scan, fix). Always use this exact banner. Never generate, invent, or substitute a different banner. Also include it at the top of `--report` markdown files.

### Phase section template

```markdown
## 1. Test Coverage

| Status | Finding | Recommendation |
|--------|---------|----------------|
| FAIL | Compiler warning — unused param in ConfigProvider:288 | Remove or rename the unused parameter |
| PASS | 4/4 contracts have test files | — |
| PASS | Branch coverage: 95.93% | — |
```

- **Status**: `PASS` or `FAIL`
- **Finding**: concise description of what was checked and the result
- **Recommendation**: specific action to fix (only for FAIL rows; use `—` for PASS)

### Score summary

```markdown
## Score Summary

| Phase | Score |
|-------|-------|
| 1. Test Coverage | 87/100 |
| 2. Test Quality | 85/100 |
| ... | ... |
| **Overall** | **82/100 — Almost Ready** |
```

### Quick Wins

```markdown
## Quick Wins

| # | Action | Location |
|---|--------|----------|
| 1 | Create deployment scripts | scripts/deploy.ts |
| 2 | Create SECURITY.md with trust assumptions | project root |
| 3 | Add more assertions to thin tests | test/ |
```

No deduction numbers, no weights, no `[-N]` annotations. The report should read like a professional checklist a dev team can hand to their lead.

## Execution

### Turn 0 — Banner & Project Selection

First, read the VERSION file and the skill's references path in parallel:
- **Read:** `VERSION` file from this skill's base directory
- **Glob:** `**/references/shared-rules.md` — extract `{ref_path}` (the references/ directory)

Then print the banner (from the end of this file), followed by asking the user where the project is:

```json
{
  "question": "Where is the project you want to prepare for audit?",
  "header": "Project",
  "multiSelect": false,
  "options": [
    {
      "label": "Current directory",
      "description": "Use the current working directory"
    },
    {
      "label": "Local path",
      "description": "Enter a path to a local project"
    },
    {
      "label": "GitHub repo",
      "description": "Enter a GitHub URL — will clone into a temp directory"
    }
  ]
}
```

If **Current directory**: use the cwd as `{project_dir}`.
If **Local path**: user provides a path, use it as `{project_dir}`.
If **GitHub repo**: clone with `git clone <url> /tmp/audit-prep-<repo-name>` and use that as `{project_dir}`.

### Turn 1 — Discover & Prepare

Make these **parallel tool calls** in ONE message:
a. **Bash:** detect framework — check for `foundry.toml`, `hardhat.config.js`, `hardhat.config.ts`
b. **Bash:** find in-scope `.sol` files. Exclude `test/`, `script/`, `lib/`, `node_modules/`, `interfaces/`, `mocks/`. Check both `src/` and `contracts/`. If `--diff <ref>`, use `git diff --name-only <ref> -- '*.sol'`.
c. **Bash:** find test files — `find test/ -name '*.sol' -o -name '*.ts' -o -name '*.js'`
d. **Bash:** count total lines in scope — `wc -l` on discovered source files
g. **Bash:** `mkdir -p .audit-prep` -> `{bundle_dir}` = `.audit-prep` (project-relative, so agents can read it)
h. **ToolSearch:** `mcp__sc-auditor` (for scan menu in Turn 4)

Then create agent bundles in a **single Bash call**:

```bash
# File list (one per line)
printf '%s\n' <in-scope-files> > {bundle_dir}/files.txt

# Agent A — Testing (Phases 1+2)
# Gets: framework, project dir, test metadata, source file list, instructions
{
  printf 'framework: %s\nproject_dir: %s\n\n' "<fw>" "<dir>"
  echo "# Test files:"
  for f in <test-files>; do
    printf '%s (%s lines)\n' "$f" "$(wc -l < "$f")"
  done
  echo ""
  echo "# In-scope source files:"
  cat {bundle_dir}/files.txt
  echo ""
  cat {ref_path}/agents/testing-agent.md
  echo ""
  cat {ref_path}/shared-rules.md
} > {bundle_dir}/agent-a.md

# Agent B — Source Analysis (Phases 3+4+6)
# NO SOURCE CODE — agent uses Grep/Read directly on project files
{
  printf 'project_dir: %s\n\n' "<dir>"
  echo "# In-scope source files:"
  cat {bundle_dir}/files.txt
  echo ""
  cat {ref_path}/agents/source-analysis-agent.md
  echo ""
  cat {ref_path}/shared-rules.md
} > {bundle_dir}/agent-b.md

# Agent C — Infrastructure (Phases 5+7+8)
{
  printf 'framework: %s\nproject_dir: %s\n\n' "<fw>" "<dir>"
  cat {ref_path}/agents/infrastructure-agent.md
  echo ""
  cat {ref_path}/shared-rules.md
} > {bundle_dir}/agent-c.md

echo "=== Bundles ==="
wc -l {bundle_dir}/agent-*.md
```

Print: `<project> | <framework> | <N> files, <M> lines`

### Turn 2 — Spawn

**First**, create 3 tasks so the user sees progress spinners:

| Task | Subject | Active Form |
|------|---------|-------------|
| A | Test coverage & quality (Phases 1-2) | Analyzing test coverage & quality |
| B | Source code analysis (Phases 3, 4, 6) | Analyzing source code |
| C | Infrastructure checks (Phases 5, 7, 8) | Checking infrastructure |

Use TaskCreate for each, then immediately set all 3 to `in_progress` via TaskUpdate.

**Then**, in the SAME message, spawn **3 parallel Agent calls:**

**Agent A — Testing (Phases 1 + 2):**
```
Read your full bundle at {bundle_dir}/agent-a.md.
Execute Phases 1 and 2 exactly as specified.
Output ONLY the PHASE/FAIL/PASS structured format from the shared rules.
Do NOT skip any phase. Do NOT add commentary or tables.
```

**Agent B — Source Analysis (Phases 3 + 4 + 6):**
```
Read your full bundle at {bundle_dir}/agent-b.md.
Execute Phases 3, 4, and 6 exactly as specified.
Use Grep and Read to analyze the source files listed in the bundle.
Do NOT read all source files at once — use targeted queries per check.
Output ONLY the PHASE/FAIL/PASS structured format from the shared rules.
Do NOT skip any phase. Do NOT perform vulnerability analysis.
```

**Agent C — Infrastructure (Phases 5 + 7 + 8):**
```
Read your full bundle at {bundle_dir}/agent-c.md.
Execute Phases 5, 7, and 8 exactly as specified.
Output ONLY the PHASE/FAIL/PASS structured format from the shared rules.
Do NOT skip any phase. Do NOT add commentary or tables.
```

As each agent completes, mark its task as `completed` via TaskUpdate.

### Turn 3 — Score & Report

**Parse** each agent's output. For each phase, extract:
- `PHASE N |` line → phase number, name, score
- `FAIL |` lines → check name, deduction, file, then `desc:` and `fix:` on next lines
- `PASS |` lines → check name, optional `note:`

**Validate:** For each expected phase (1–8):
- Missing `PHASE N` marker → score = 0, add note "(not reported by agent)"
- Missing `SCORE:` → compute as 100 minus sum of extracted deductions
- No FAIL/PASS lines → flag "(no details reported)"

**Compute weighted score:**

| Phase | Weight |
|-------|--------|
| 1. Coverage | 15% |
| 2. Quality | 15% |
| 3. Documentation | 10% |
| 4. Hygiene | 10% |
| 5. Dependencies | 10% |
| 6. Best Practices | 15% |
| 7. Deployment | 10% |
| 8. Project Docs | 15% |

**Verdict:** 90–100 Audit Ready | 75–89 Almost Ready | 50–74 Needs Work | <50 Not Ready
**Override:** If Phase 1 (Coverage) score < 90, verdict CANNOT be "Audit Ready" — cap at "Almost Ready" and append "(coverage below 90%)".

**Render the report as clean markdown** using the format from the Report Format section.
The banner is already visible from Turn 1 — do NOT re-print it here. In `--report` files, include the banner as an uncolored code block at the top.

For each phase, build a table with Status | Finding | Recommendation columns.
FAIL rows get a specific recommendation. PASS rows get `—` in the recommendation column.
Group related PASS items into single rows where natural (e.g., "No TODOs, console imports, or commented-out code").

End with the Score Summary table and Quick Wins table.
**Quick Wins** = top 5 most impactful FAIL findings. Each shows the fix action and where to apply it.

If `--report <path>`: write the markdown to the specified file path.
If `--ci`: JSON `{"score": N, "verdict": "...", "phases": [...], "findings": [...]}`.

### Turn 4 — Scan Menu

Skip if `--no-scan`. If `--scanner <tool>`, run directly.

**Detection:**

1. **Local CLI tools (single Bash):**
```bash
echo "=== SCAN DETECTION ==="
which slither 2>/dev/null && echo "SLITHER=yes" || echo "SLITHER=no"
which aderyn 2>/dev/null && echo "ADERYN=yes" || echo "ADERYN=no"
which myth 2>/dev/null && echo "MYTHRIL=yes" || echo "MYTHRIL=no"
```

2. **MCP tools:** check ToolSearch results from Turn 1 for `mcp__sc-auditor__run-slither`, `mcp__sc-auditor__run-aderyn`.

3. **Skills:** check the available skills list for `solidity-auditor` (Pashov).

A tool is "installed" if ANY source is available (local CLI, MCP, or skill).

**Present the scan menu using AskUserQuestion with multiSelect: true.**

**Always include all four options** (Slither, Aderyn, Pashov Solidity Auditor, Import custom scanner). Set each tool's description dynamically to show its availability status and source. Never omit an option just because it was not detected — show it with "(not installed)" instead.

Example AskUserQuestion call:
```json
{
  "question": "Which scanners do you want to run?",
  "header": "Bug Scan",
  "multiSelect": true,
  "options": [
    {
      "label": "Slither",
      "description": "Static analysis for Solidity (available via MCP)"
    },
    {
      "label": "Aderyn",
      "description": "Rust-based static analyzer (installed locally)"
    },
    {
      "label": "Pashov Solidity Auditor",
      "description": "AI-powered audit skill (available as skill)"
    },
    {
      "label": "Import custom scanner",
      "description": "Provide a CLI command to run your own scanner"
    }
  ]
}
```

For the description field of Slither, Aderyn, and Pashov — set dynamically based on detection:
- Installed: `"... (available via MCP)"`, `"... (installed locally)"`, or `"... (available as skill)"`
- Not installed: `"... (not installed)"`

If the user selects **"Import custom scanner"**, follow up by asking for the CLI command to run. Execute it with the same timeout (300s) and append output to the scan results.

Findings from scanners do NOT affect the audit-prep score.

**Tool execution reference:**

| Tool | Local CLI | MCP | Skill |
|------|-----------|-----|-------|
| Slither | `slither . --filter-paths "test\|script\|lib\|node_modules"` | `mcp__sc-auditor__run-slither` | — |
| Aderyn | `aderyn .` | `mcp__sc-auditor__run-aderyn` | — |
| Pashov Solidity Auditor | — | — | `solidity-auditor` skill |

Priority when multiple sources available: MCP > local CLI > skill.

## Auto-Fix (`--fix`)

### Code fixes (applied to source files)
| Fix | Action |
|-----|--------|
| NatSpec stubs | Insert @notice, @param, @return above undocumented functions |
| Console removal | Remove console.sol imports and console.log calls |
| Pragma locking | Replace `^0.8.x` with `0.8.x` |
| SafeERC20 wrapping | Add `using SafeERC20 for IERC20;`, replace direct calls |
| SPDX headers | Add `// SPDX-License-Identifier: MIT` to files missing it (prompt for license) |

### Template generation (creates new files if missing)
| File | Content |
|------|---------|
| `SECURITY.md` | Skeleton: Roles & Permissions, Trust Assumptions, Centralization Risks, Known Risks sections. Pre-fill role names from AccessControl/Ownable usage in source. |
| `scope.md` | Generate from discovered in-scope files: contract name, file path, line count, brief description from @title NatSpec |
| `KNOWN_ISSUES.md` | Skeleton: header + "Document any known limitations, accepted risks, or intentional design trade-offs here." |

Templates are only created if the file does not already exist. The orchestrator generates these after the report, using data already collected during the pipeline (in-scope files, role names, config vars). No extra agent calls needed.

## Banner

Before doing anything else, print the banner below as plain text (not inside a code block). Apply ANSI color `\033[38;5;117m` (light sky blue) to the entire banner (both CD and SECURITY block letters), `\033[38;5;153m` (pale blue) for the subtitle, and `\033[0m` to reset at the end.

### Terminal

```
██████╗██████╗
██╔════╝██╔══██╗
██║     ██║  ██║
██║     ██║  ██║
╚██████╗██████╔╝
╚═════╝╚═════╝

███████╗███████╗ ██████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗
██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
███████╗█████╗  ██║     ██║   ██║██████╔╝██║   ██║    ╚████╔╝
╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██║   ██║     ╚██╔╝
███████║███████╗╚██████╗╚██████╔╝██║  ██║██║   ██║      ██║
╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝

Audit Preparation v1.0
```

### For `--report` markdown files

Use the same layout inside a code block (no ANSI codes):

```
██████╗██████╗
██╔════╝██╔══██╗
██║     ██║  ██║
██║     ██║  ██║
╚██████╗██████╔╝
╚═════╝╚═════╝

███████╗███████╗ ██████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗
██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
███████╗█████╗  ██║     ██║   ██║██████╔╝██║   ██║    ╚████╔╝
╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██║   ██║     ╚██╔╝
███████║███████╗╚██████╗╚██████╔╝██║  ██║██║   ██║      ██║
╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝

Audit Preparation v1.0
```
