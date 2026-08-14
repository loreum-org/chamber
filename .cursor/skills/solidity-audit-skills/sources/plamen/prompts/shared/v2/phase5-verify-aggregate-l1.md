# Phase 5.6: L1 Verification Aggregate

> **Audience**: V2 driver subprocess running the L1 verify aggregate phase.
> **Architecture**: aggregate existing verifier files only; no per-finding verification.

## Objective

Read existing `verify_*.md` files in the scratchpad and write ONLY
`verify_core.md`.

## Rules

1. Do not spawn subagents.
2. Do not create or rewrite per-finding `verify_<ID>.md` files.
3. Do not read shard manifests unless needed only to confirm expected IDs.
4. Do not write artifacts outside the aggregate output contract.
5. Preserve each verifier status, evidence tag, and location exactly enough
   for downstream consumers to parse.

## Output

Write `{SCRATCHPAD}/verify_core.md` with one row per verifier file:

```markdown
| Finding ID | Verdict | Evidence Tag | Location |
|------------|---------|--------------|----------|
```

Return only: `DONE: verify_core.md aggregated`.
