---
description: "Phase 3: L1 Breadth Analysis — Layer Decomposition"
---

# Phase 3: L1 Breadth Analysis (Layer Decomposition)

> **Purpose**: Decompose the L1 codebase by architectural layer and assign breadth agents
> to cover each layer's attack surface. Unlike smart-contract mode (which clusters by file),
> L1 breadth decomposes by the Sigma Prime 8-layer framework.
>
> **Invoked by**: `claude -p` with this file as the prompt. The driver resolves placeholders.
> **Outputs**: `{SCRATCHPAD}/analysis_layer_{LAYER}.md` per agent.

---

## Placeholders

| Placeholder | Source |
|-------------|--------|
| `{SCRATCHPAD}` | Driver: `--scratchpad` arg |
| `{PROJECT_ROOT}` | Driver: `--project-root` arg |
| `{MODE}` | Driver: `core` or `thorough` |
| `{LANGUAGE}` | From `{SCRATCHPAD}/recon_summary.md` |
| `{SUBSYSTEM_SCOPE}` | Driver: scope restriction (empty = full codebase) |

---

## Layer Activation Table

Read `{SCRATCHPAD}/recon_summary.md`. For each subsystem flag that is `true`, activate the
corresponding layer. Layers with `false` flags are skipped entirely.

| Layer | Recon Flag | L1 Skills to Load | Difficulty |
|-------|------------|-------------------|------------|
| **network** | `P2P` | `p2p-dos-and-eclipse`, `go-concurrency-safety` / `rust-unsafe-audit` | HIGH — pre-auth attack surface, panic = node kill |
| **mempool** | `MEMPOOL` | `mempool-asymmetric-dos`, `go-concurrency-safety` / `rust-unsafe-audit` | MEDIUM — post-auth but amplification possible |
| **consensus** | `CONSENSUS` | `consensus-safety-invariants`, `fork-choice-audit` (if detected), `validator-lifecycle-and-slashing` (if detected), `hardfork-activation-and-protocol-upgrade` (if detected) | HIGH — safety/liveness critical |
| **execution** | `EXECUTION` | `execution-client-hardening`, `cross-environment-semantic-drift` (if `XENV`) | MEDIUM — determinism critical |
| **crypto** | `BLS` or `crypto/` in scope | `bls-aggregation-audit`, `dependency-audit-nodeclient` | MEDIUM — correctness critical |
| **storage** | `STATE_SYNC` | `state-sync-pruning`, `go-concurrency-safety` / `rust-unsafe-audit` | LOW-MEDIUM — data integrity |
| **rpc** | `RPC` | `rpc-surface-audit`. MUST include `grpc_query.go`, `autocli.go`, and query infrastructure in scope. | LOW — post-auth, info leak / DoS |
| **cross-chain** | `LIGHT_CLIENT` | `light-client-proof-verification` | HIGH — proof verification critical |
| **difficulty** | `DIFFICULTY` or `adjust_difficulty` / `difficulty_adjustment` detected | `consensus-safety-invariants` (fixed-point arithmetic + unused-parameter audit) | MEDIUM — consensus parameter |

### Difficulty Row

The difficulty column indicates expected bug density and exploit severity per layer.
HIGH-difficulty layers should be assigned to stronger models (opus) and given priority
in agent allocation when the total layer count exceeds the agent cap.

---

## Agent Count and Assignment

```
active_layers = [layer for layer in ALL_LAYERS if recon_flag(layer) == true]
breadth_agents = min(len(active_layers), 7)
```

**Soft cap by tier**:
- T1 (subsystem): max 3 breadth agents
- T2 (whole-client): max 5 breadth agents
- T3 (full client): max 7 breadth agents

If `len(active_layers) > breadth_agents`, merge layers into multi-layer agents.
Merge rules:
1. Prefer merging LOW-difficulty layers together
2. Never merge two HIGH-difficulty layers into one agent
3. Each agent covers at most 3 layers
4. Network + mempool is a natural merge pair
5. Storage + RPC is a natural merge pair

Log to `{SCRATCHPAD}/violations.md` if breadth_agents exceeds the soft cap.

---

## Breadth Agent Spawn Template

For each agent assignment, the driver spawns a `general-purpose` opus agent:

```
You are L1 Breadth Agent #{N}: {LAYER_LIST}.

PROJECT_ROOT: {PROJECT_ROOT}
SCRATCHPAD: {SCRATCHPAD}
LANGUAGE: {LANGUAGE}

## Your Layers
{LAYER_ASSIGNMENTS — for each layer: name, key files/modules from subsystem_map.md, skills to apply}

## Artifacts Available
- {SCRATCHPAD}/threat_model.md (threat model with actor enumeration and trust boundaries)
- {SCRATCHPAD}/subsystem_map.md (SCIP-backed symbol map per layer)
- {SCRATCHPAD}/attack_surface.md (OZ 10-point checklist per layer)
- {SCRATCHPAD}/trust_boundaries.md (actor-to-layer trust boundaries)
- {SCRATCHPAD}/opengrep_hits_ranked.md (ranked static analysis hits)
- {SCRATCHPAD}/scip/repo_map.md (capped at 2000 lines — use repo_map_full.md for targeted reads)
- {SCRATCHPAD}/fork_ancestry.md (fork status and diff baseline)
- Source files in your assigned layers

## Analysis Methodology

For EACH layer assigned to you:

1. **Trust boundary audit**: For each actor that can reach this layer (from trust_boundaries.md),
   trace the path from untrusted input to state mutation. What validation exists? What is missing?

2. **Opengrep cross-reference**: Check opengrep_hits_ranked.md for hits in your layer's files.
   For each hit: is it a true positive? Does it combine with other issues?

3. **Skill-directed analysis**: Apply each assigned skill's methodology to your layer's code.
   Read the skill file for the full checklist — do not summarize or skip steps.

4. **Concurrency audit** (Go layers): Check for goroutine leaks, mutex ordering, channel closes,
   map access without locks. Reference {SCRATCHPAD}/scip/concurrency_inventory.md.

5. **Panic audit** (all layers): Check for panic paths reachable from untrusted input.
   Reference {SCRATCHPAD}/scip/panic_sites.md. A panic in pre-auth code = Critical.

## Output Requirements

**FIRST ACTION**: Write a one-line header to `{SCRATCHPAD}/analysis_layer_{LAYER_PRIMARY}.md`
to reserve the file.

Write all findings to `{SCRATCHPAD}/analysis_layer_{LAYER_PRIMARY}.md`.
Use finding IDs: [L{N}-1], [L{N}-2], ...
Use standard finding format from ~/.claude/rules/finding-output-format.md.

Every finding MUST include:
- Specific code location (file:line)
- Which trust boundary is crossed
- Which layer the bug affects
- Evidence tag: [CODE], [LSP-TRACE] (requires scip/ citation), or [PROD-SOURCE]

## Chain Summary (MANDATORY at end of file)

After all findings, write a Chain Summary table for use by downstream agents:

| Finding ID | Postconditions Created | Preconditions Required | Cross-Layer Dependencies |
|------------|----------------------|----------------------|------------------------|

SCOPE: Write ONLY to your assigned output file. Do NOT read or write other agents'
output files. Do NOT proceed to subsequent pipeline phases (inventory, depth, verification,
report). Return your findings and stop.

Write your output directly to {SCRATCHPAD}/analysis_layer_{LAYER_PRIMARY}.md using the Write tool.
Return ONLY a one-line summary: "DONE: {N} findings written to analysis_layer_{LAYER_PRIMARY}.md"
Do NOT return your full output as text — the orchestrator's context budget is limited.
```

---

## Post-Spawn Verification (Driver Inline)

After each agent returns, the driver runs the WRITE-THEN-VERIFY check:

```bash
FILE="{SCRATCHPAD}/analysis_layer_{LAYER}.md"
if [ -f "$FILE" ] && [ "$(wc -c < "$FILE")" -gt 100 ]; then
  echo "[VERIFY OK] $FILE ($(wc -l < "$FILE") lines)"
else
  echo "[VERIFY FAIL] $FILE missing or empty"
  # Driver re-prompts for text fallback
fi
```

---

## Mode-Specific Behavior

| Aspect | Core | Thorough |
|--------|------|----------|
| Agent model | opus | opus |
| Max layers per agent | 3 | 2 (higher focus) |
| Breadth re-scan (Phase 3b) | Skip | After Phase 4a inventory |
| Per-cluster analysis (Phase 3c) | Skip | After Phase 3b |

In Thorough mode, Phase 3b and 3c run after Phase 4a produces the exclusion list.
See `~/.claude/rules/phase3b-rescan-prompt.md` for the re-scan protocol.
The driver spawns those phases separately — this file covers Phase 3a only.
