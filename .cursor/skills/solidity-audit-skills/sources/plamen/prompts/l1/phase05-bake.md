---
description: "Phase 0.5: Bake — SCIP indexing, flat-file pre-bake, and Opengrep baseline reference"
---

# Phase 0.5: Bake Reference

> **Purpose**: Documents what the Bake phase produces, where artifacts live, and how
> downstream agents should consume them. This is a REFERENCE file read by recon and
> depth phase prompts -- it is NOT executed by `claude -p` directly. The actual CLI
> commands live in `plamen_driver.py`.
>
> **When**: Runs BEFORE any recon agent spawns. Must complete before Phase 1.

---

## What Bake Produces

### 1. SCIP Index Files

| Language | Tool | Output | Reuse Threshold |
|----------|------|--------|----------------|
| Go | `scip-go` | `{SCRATCHPAD}/scip_go.index` | >1 MB and <24h old |
| Rust | `rust-analyzer scip` | `{SCRATCHPAD}/scip_rust.index` | >5 MB and <24h old |

If the index file already exists, is large enough, and is recent enough, it is reused.
The reuse status is recorded in `{SCRATCHPAD}/primitive_status.md` as `SCIP_GO_REUSED`
or `SCIP_RUST_REUSED`.

If indexing fails (e.g., build errors, OOM), the failure is recorded in
`{SCRATCHPAD}/primitive_status.md` and agents degrade to Grep-based analysis.

### 2. SCIP Flat Files (Pre-Bake)

The driver runs `plamen_l1.scip_reader` to produce flat Markdown files that depth agents
can Read directly (agents cannot call MCP tools in subagent contexts).

| File | Contents | Cap | Fallback |
|------|----------|-----|----------|
| `{SCRATCHPAD}/scip/repo_map.md` | Per-file symbol listing | 2000 lines (~50 KB) | Grep for function signatures |
| `{SCRATCHPAD}/scip/repo_map_full.md` | Uncapped version | None | Same as above |
| `{SCRATCHPAD}/scip/xref_map.md` | Cross-file references for top 50 exported symbols, 30 refs each | ~1500 entries | Grep for symbol name |
| `{SCRATCHPAD}/scip/call_graph_consensus.md` | 2-hop call graph from consensus entry points (BeginBlocker, EndBlocker, Slash, etc.) | 50 refs/entry | Manual trace |
| `{SCRATCHPAD}/scip/call_graph_p2p.md` | 2-hop call graph from network entry points (HandleMsg, ServeHTTP, etc.) | 50 refs/entry | Manual trace |
| `{SCRATCHPAD}/scip/call_graph_execution.md` | 2-hop call graph from execution entry points (SetValidator, GetValidator, etc.) | 50 refs/entry | Manual trace |
| `{SCRATCHPAD}/scip/concurrency_inventory.md` | Go goroutine spawns (`go func(...)`) + `sync.Mutex` usage via ast-grep | None | Grep for `go ` and `sync.` |
| `{SCRATCHPAD}/scip/panic_sites.md` | All `panic()` call sites via ast-grep | None | Grep for `panic(` |
| `{SCRATCHPAD}/scip/type_hierarchy.md` | Interface implementations from SCIP | 200 entries | Grep for interface names |
| `{SCRATCHPAD}/scip/all_symbols.txt` | Full symbol list (raw, for targeted reads) | 2000 entries | Grep |

**Total expected**: 6-10 flat files, ~80-200 KB total.

**Repo map cap rationale**: Run 8 produced a 17 MB / 835K-line `repo_map.md` that agents
couldn't read. The capped version at 2000 lines (~50 KB) is the agent-readable artifact;
`repo_map_full.md` stays available for targeted reads by line range.

If any `scip_reader` command fails, the file is created empty. Agents detect empty files
and fall back to Grep. This is expected and acceptable.

### 3. Opengrep Baseline

| File | Contents | Fallback |
|------|----------|----------|
| `{SCRATCHPAD}/opengrep_hits.json` | Raw JSON output from Opengrep scan using L1 rules | Empty `{"results":[],"errors":"opengrep unavailable"}` |

The Opengrep rules live at `~/.claude/agents/skills/injectable/l1/_opengrep-rules/`.
Agent L1-3 (recon) ranks and deduplicates these hits into `opengrep_hits_ranked.md`.

### 4. Primitive Status File

`{SCRATCHPAD}/primitive_status.md` records the outcome of every Bake step:

```markdown
# Primitive Status (Phase 0.5 Bake)
- Language: {go|rust|mixed}
- SCIP Go index: {path} ({size})
- SCIP Rust index: {path} ({size})
- SCIP_GO_REUSED: {true|false}
- SCIP_RUST_REUSED: {true|false}
- Opengrep hits: {count} findings
- ast-grep: available
- SCIP_PREBAKE_COMPLETE: {true|false}
- SCIP_PREBAKE_FILES: {count}
```

---

## How Downstream Agents Use Bake Artifacts

### Recon Agents (Phase 1)

- **Agent L1-2** (Subsystem Map): Uses SCIP `workspace_symbol()` queries to build the
  subsystem map. If SCIP is unavailable, falls back to Grep.
- **Agent L1-3** (Bake Validation): Reads `primitive_status.md` and validates that SCIP
  indexes are non-empty, ast-grep works, and Opengrep produced output.

### Depth Agents (Phase 4b)

Every depth agent receives the SCIP Pre-Bake Directive (see `phase4b-depth-driver.md`),
which instructs it to:
1. Read the pre-baked flat files relevant to its domain
2. NOT call MCP tools (unavailable in subagent context)
3. Cite `scip/*.md` files for `[LSP-TRACE]` evidence tags
4. Use `python -m plamen_l1.scip_reader` via Bash for targeted queries not in flat files
5. Log `fallback_to_grep: true` in YAML header if flat files are empty/missing

### Verifiers (Phase 5)

Verifiers may cite SCIP flat files for `[LSP-TRACE]` evidence, which is stronger than
`[CODE-TRACE]` but weaker than mechanical proof tags (`[DIFF-PASS]`, `[FUZZ-PASS]`, etc.).
