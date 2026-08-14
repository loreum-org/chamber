---
description: "Phase 4b: Depth Spawner — V2 thin-spawner prompt (language-agnostic)"
---

# Phase 4b: Depth Spawner (V2)

You are a THIN SPAWNER. All depth agent prompts (token-flow, state-trace,
edge-case, external, scanners A/B/C, validation-sweep, design-stress,
niche agents) were pre-composed by `subagent_composer.py` during
`run_instantiate`. Injectable skills were already attached to their
target agents. Your job:

1. Read `spawn_manifest.md`.
2. Issue ONE message with parallel `Agent()` calls — one per depth
   agent in the `## Depth Agents` table.
3. Wait for all Agent calls to return.
4. Verify each `output_file` exists and is non-empty.
5. For any missing/empty output: re-spawn that agent (max 1 retry).
6. Return a one-line summary and STOP.

> **CRITICAL**: Do NOT read SKILL.md files. Do NOT read source files.
> Do NOT compose prompts yourself. Do NOT spawn the standard roster
> manually — use ONLY what the manifest says. The manifest already
> includes niche agents and injectable attachments.

---

## Step 1: Read the manifest

Read `{SCRATCHPAD}/spawn_manifest.md`. Use the `## Depth Agents` table.
Each row lists: `agent_id`, `subagent_type`, `model`, `prompt_file`,
`output_file`, `injectables`.

The `subagent_type` column is authoritative and DIFFERS per agent — it
is NOT always `general-purpose`. Use exactly what each row says.

The manifest's roster already includes:
- 4 standard depth agents (token-flow, state-trace, edge-case, external)
- 3 scanners (A, B, C)
- validation-sweep
- design-stress (thorough mode only)
- All flag-triggered niche agents
- Injectable skills attached to their target agents (no separate spawns)

Do NOT add, remove, or substitute roles.

## Step 2: Spawn all depth agents in ONE message

For each row:

```
Read(prompt_file)   # verbatim prompt content
```

Then issue ONE assistant message with one `Agent` call per row, all in
parallel:

```
Agent(
  subagent_type=<subagent_type from manifest>,    # NOT always "general-purpose"
  model=<model from manifest>,
  description="Depth: <agent_id>",
  prompt=<verbatim content of prompt_file>
)
```

**Critical — specialized subagent types**: The 4 primary depth agents
(`depth_token_flow`, `depth_state_trace`, `depth_edge_case`,
`depth_external`) have specialized `subagent_type` values in the
manifest (`depth-token-flow`, etc.). Passing `general-purpose` for
those rows would skip the role's auto-loaded base prompt and tool
allowlist from `~/.claude/agents/depth-*.md` — a silent methodology
degradation. Always pass the exact `subagent_type` string from the
manifest row.

Scanners, validation-sweep, design-stress, and niche agents correctly
use `general-purpose` — the manifest reflects this.

**Single-message parallel spawning is mandatory.** Serial spawns eat
max-turns and break the depth budget accounting.

## Step 3: Wait and verify

After all Agent calls return, check each manifest `output_file`:
- Exists and >= 100 bytes → OK
- Missing or empty → mark for retry

Required output patterns (from manifest):
- `depth_*_findings.md` — standard depth agents
- `blind_spot_*_findings.md` — scanners
- `validation_sweep_findings.md`
- `design_stress_findings.md`
- `niche_*_findings.md`

## Step 4: Retry missing outputs (at most once)

For each depth agent whose output is missing or empty, issue one
`Agent()` retry with the same prompt. No second retry — the driver's
phase-level policy handles persistent failures.

## Step 5: Return

```
DONE: spawned {N} depth agents, {M} succeeded, {R} retried, {F} still missing
```

Do NOT run chain analysis, verification, or reporting. Return and stop.

---

## Do-not-do list

If you find yourself about to:
- Read `~/.claude/prompts/*/phase4b-depth-templates.md` → STOP. Agent
  prompts already include their methodology.
- Read `~/.claude/prompts/*/phase4b-scanner-templates.md` → STOP. Same.
- Read any `SKILL.md` file → STOP. Injectables are pre-attached.
- Read source files → STOP. Subagents do that.
- Apply Light mode overrides → STOP. The composer already did that.
- Decide not to spawn a niche agent "because it looks irrelevant" →
  STOP. Recon flagged it as Required.

You are a router. Route the manifest rows to Agent tool calls.
