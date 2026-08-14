# MCP Tools Reference - Soroban

> **MCP tools are available directly** - call them without ToolSearch or loading.
> If a tool call fails with "No such tool available", the MCP server failed to start.

> **Mental model**: You are good at understanding INTENT and tracing LOGIC. Tools are good at EXHAUSTIVE ENUMERATION. You miss things when scanning large files manually. Tools never skip anything but can't understand intent. **Use both.**

> **MCP TIMEOUT POLICY (MANDATORY)**: When an MCP tool call returns a timeout error or fails, do NOT retry the same call. Record `[MCP: TIMEOUT]` and skip ALL remaining calls to that provider - switch immediately to fallback (code analysis, grep, WebSearch). Claude Code's default tool timeout is 300s (configurable via `MCP_TOOL_TIMEOUT` in settings.json). You cannot cancel a pending call, but you control what happens after the error returns.

---

## What Is NOT Available for Soroban

**CRITICAL**: Soroban is NOT EVM and NOT Solana. The following tools MUST NOT be called on Soroban code:

| Tool | Why NOT for Soroban |
|------|---------------------|
| `mcp__slither-analyzer__*` | Slither is EVM/Solidity only. Soroban contracts are Rust/WASM. Will fail or produce nonsense. |
| `mcp__farofino__slither_audit` | Same — Slither backend, EVM only. |
| `mcp__farofino__aderyn_audit` | Aderyn is Solidity only. |
| `mcp__solana-fender__*` | Fender is Anchor/Solana only. Soroban SDK is completely different. |
| `mcp__helius__*` | Helius is Solana RPC. Soroban runs on Stellar — different network, different account model. |
| `mcp__foundry-suite__*` | Foundry/Anvil is EVM only. No Soroban support. |
| `mcp__evm-chain-data__*` | EVM chain data tools. Stellar/Soroban not supported. |

Attempting to use any of the above on a Soroban project will produce errors or misleading results. Do NOT attempt workarounds.

---

## What IS Available for Soroban

### Scout - Static Analysis (CLI, not MCP)

> **No dedicated MCP server exists for Soroban static analysis.** Scout is run via Bash as a CLI tool.

Scout (`cargo-scout-audit`) is the primary static analyzer for Soroban contracts. It is maintained by CoinFabrik and produces JSON output.

**Detection**: Check `build_status.md` for `scout_available: true/false` (set by recon TASK 1).

**If Scout is available**:
```bash
# Run full audit on the project
cargo scout-audit --output-format json 2>&1

# Run on a specific directory
cargo scout-audit --manifest-path path/to/Cargo.toml --output-format json 2>&1

# View available detectors
cargo scout-audit --list-detectors
```

**Known Scout detectors** (as of 2024):
- `overflow-check` — arithmetic that may overflow
- `unprotected-update-current-contract-wasm` — upgrade without auth
- `avoid-core-mem-forget` — memory unsafety
- `avoid-panic-error` — panic instead of error return
- `avoid-unsafe-block` — unsafe Rust in contract
- `dos-unbounded-operation` — loops without iteration cap
- `insufficiently-random-values` — weak randomness
- `set-contract-storage` — unprotected storage writes
- `soroban-version` — outdated SDK version
- `unused-return-enum` — ignoring Result variants
- `unsafe-expect` / `unsafe-unwrap` — panics on None/Err
- `iterators-over-indexing` — bounds-unsafe indexing
- `integer-overflow-or-underflow` — explicit overflow paths

**Failure policy**: ONE probe attempt. If fails → `SCOUT_AVAILABLE = false`. Switch to grep fallback for all subsequent tasks.

**Output parsing**: Scout JSON output contains `findings` array. Each finding has `id`, `message`, `span` (file + line range), and `severity`.

**Fallback if Scout unavailable**:
```bash
# Lint via clippy (catches many issues)
cargo clippy --all-targets -- -D warnings 2>&1

# Check for common unsafe patterns via grep
grep -rn "unwrap()" src/
grep -rn "expect(" src/
grep -rn "unsafe " src/
grep -rn "panic!" src/
grep -rn "require_auth" src/  # inventory auth calls
```

---

### unified-vuln-db - Vulnerability Database

> **Package**: Local SQLite + Solodit live search. No API key required. Language-agnostic.

| Tool | What It Gives You | When to Use |
|------|-------------------|-------------|
| `mcp__unified-vuln-db__get_common_vulnerabilities(protocol_type)` | Common vulnerability patterns for a protocol category | TASK 0 - protocol classification |
| `mcp__unified-vuln-db__get_attack_vectors(bug_class)` | Specific attack vectors for a vulnerability class | Understanding exploit mechanics |
| `mcp__unified-vuln-db__search_solodit_live(keywords, tags, impact, language, quality_score, ...)` | Live search across Solodit finding database (50k+) | Cross-referencing with historical findings. Use `language="Rust"` for Soroban, `quality_score=3` for high-quality findings |
| `mcp__unified-vuln-db__validate_hypothesis(hypothesis)` | Confidence score for a hypothesis based on historical data | Before verification - calibrate confidence |
| `mcp__unified-vuln-db__get_similar_findings(description)` | Similar historical findings with severity info | Calibrate severity |
| `mcp__unified-vuln-db__assess_hypothesis_strength(hypothesis)` | Strength assessment based on evidence | Chain analysis RAG validation |
| `mcp__unified-vuln-db__analyze_code_pattern(pattern)` | Known vulnerability patterns matching a code structure | Depth agent pattern analysis |
| `mcp__unified-vuln-db__get_root_cause_analysis(pattern)` | Root cause classification for a vulnerability pattern | Understanding underlying causes |

**Soroban-relevant Solodit tags**: `Soroban`, `Stellar`, `Rust`, `Authorization`, `Storage`, `Token`.

**Note on empty results**: The Solodit database has limited Soroban-specific findings as of 2024. If MCP calls succeed but return 0 results for the first 3 queries, treat as "sparse database" and supplement with `tavily-search` web research on Soroban audit reports.

---

### tavily-search - Web Research

> **Package**: `tavily-mcp` (Tavily). Requires `TAVILY_API_KEY`.

| Tool | What It Gives You | When to Use |
|------|-------------------|-------------|
| `mcp__tavily-search__tavily_search(query)` | Web search results | Soroban SDK docs, known Stellar exploits, audit reports |
| `mcp__tavily-search__tavily_extract(url)` | Content extraction from URL | Reading Stellar docs, whitepapers |
| `mcp__tavily-search__tavily_research(topic)` | Multi-query research on a topic | Fork ancestry research, deep-dive on Soroban patterns |
| `mcp__tavily-search__tavily_crawl(url)` | Recursive URL crawling | Exploring docs.stellar.org |
| `mcp__tavily-search__tavily_map(url)` | URL mapping/sitemap | Understanding Stellar documentation structure |

**Recommended searches for Soroban recon**:
- `"soroban security audit {protocol_type}"` — published audit reports
- `"soroban {vulnerability_class} vulnerability"` — known bug patterns
- `"stellar soroban require_auth bypass"` — auth-related findings
- `site:docs.stellar.org {feature}` — official SDK documentation

---

## Static Analysis Escalation Ladder - Soroban

| Priority | Tool | When to Use |
|----------|------|-------------|
| 1 (Primary) | `cargo scout-audit --output-format json` via Bash | Always attempt first |
| 2 (Fallback A) | `cargo clippy` via Bash | When Scout fails or not installed |
| 3 (Fallback B) | Grep + Read tools | When all automated tools fail |

---

## Verification Tools - Soroban

| Purpose | Tool | Notes |
|---------|------|-------|
| PoC testing | `cargo test --features testutils` | MUST use testutils feature. `Env::default()` provides in-process VM. |
| Fuzz testing | `cargo +nightly fuzz run <target>` | Requires nightly toolchain. Use proptest as fallback. |
| On-chain state | `stellar contract read --id <contract_id>` (CLI) | Read production contract storage. No MCP equivalent. |
| Network info | `stellar network ls` / Stellar Horizon API | Chain state reference. No Soroban-specific MCP. |
| Evidence level | `[POC-PASS]` for passing `cargo test` | Standard evidence tag |

**Fork testing note**: No Anvil-equivalent for Soroban. The `Env::default()` test environment is purely in-process. To test against production state, use the Stellar CLI (`stellar contract read`) to dump contract storage entries, then reconstruct state manually in your test's `Env`. Document as a coverage gap when production state verification is needed.

---

## Cascaded Model Selection Reference

| Task Type | Default Model | Budget Degradation (>15 agents) |
|-----------|--------------|--------------------------------|
| Scoring agent | haiku | haiku (no change) |
| Index agent (6a) | haiku | haiku (no change) |
| Breadth agents | sonnet | sonnet (no change) |
| Depth agents | specialized (depth-*) | specialized (no change) |
| Blind spot scanners | sonnet (general-purpose) | sonnet (no change) |
| Validation sweep | sonnet (general-purpose) | sonnet (no change) |
| Critical+High tier writer (6b) | opus | opus (no change - quality critical) |
| Medium tier writer (6b) | sonnet | haiku (if >15 agents used) |
| Low+Info tier writer (6b) | sonnet | haiku (if >15 agents used) |
| Assembler (6c) | haiku (≤25 findings), sonnet (>25) | sonnet if >25 (no change) |

**Optional skill skip**: If total agent count > 15, skip optional skills (CENTRALIZATION_RISK) to conserve budget.

---

## Tool Availability Notes

- **Scout**: Requires `cargo-scout-audit` installed (`cargo install cargo-scout-audit`). Check with `cargo scout-audit --version`. If unavailable, set `SCOUT_AVAILABLE = false` in `build_status.md`.
- **unified-vuln-db**: Available without API key. Soroban coverage is sparse — supplement with tavily web search.
- **tavily-search**: Requires `TAVILY_API_KEY`. Primary source for Soroban audit precedents and SDK documentation.
- **No on-chain MCP for Stellar**: Unlike Solana (Helius) or EVM (evm-chain-data), there is no MCP server for Stellar/Soroban on-chain data. Use the Stellar CLI or Horizon REST API directly via Bash when production verification is needed.
- Document all tool availability findings in `build_status.md` during recon TASK 1.
