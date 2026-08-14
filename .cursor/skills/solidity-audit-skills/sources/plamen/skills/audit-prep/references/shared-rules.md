# Shared Rules

## Output Format

Every phase outputs this exact structure:

```
PHASE <N> | <Name> | SCORE: <X>/100

FAIL | <check> | <-N> | <file:line or n/a>
desc: <one factual sentence — what is wrong>
fix: <one sentence — specific action to fix it>

PASS | <check>
note: <brief evidence>

END PHASE <N>
```

Rules:
- Every assigned phase MUST appear between PHASE and END markers
- FAIL needs: check name, deduction, file location (or `n/a`)
- `desc:` = factual problem statement
- `fix:` = specific actionable instruction (command to run, file to create, code to change)
- PASS needs: check name, optional `note:` with evidence
- Score = 100 minus deductions (min 0, max 100). Apply deduction caps from your checklist.
- One blank line between each FAIL/PASS block

Example:
```
PHASE 4 | Code Hygiene | SCORE: 80/100

FAIL | floating_pragma | -10 | src/Vault.sol:1
desc: Floating pragma ^0.8.20 allows untested compiler versions
fix: Change to pragma solidity 0.8.20 in all source files

FAIL | console_import | -15 | src/Vault.sol:5
desc: console.sol imported in production code
fix: Remove import and all console.log calls

PASS | no_todos
note: No TODO/FIXME/HACK found

END PHASE 4
```

## DO NOT Report

Never flag: gas optimizations (constant/immutable, struct packing, SLOADs, unchecked math, memory vs calldata), functions >50 lines, magic numbers, naming conventions, code style.

## DO NOT Do

- Do NOT perform security vulnerability analysis or threat modeling
- Do NOT suggest architecture changes or redesigns
- Do NOT produce prose, tables, summaries, or markdown formatting
- Do NOT output anything except the structured PHASE/FAIL/PASS format above
- Do NOT analyze files outside the project directory
- Do NOT analyze files in lib/, node_modules/, interfaces/, mocks/

## Scope

Only the project's own contracts (src/ or contracts/, excluding lib/, node_modules/, interfaces/, mocks/, test/, script/).
- `@inheritdoc` = fully documented (not a finding)
- Inline assembly = INFO only (no deduction)
- Dev-only CVEs = INFO only (no deduction)
