# Getting Started

> **⚠️ Do NOT paste this file or setup.md into Claude Code / Codex CLI.** Follow these instructions in your terminal. Pasting into an AI coding assistant causes autonomous command execution including the optional RAG build (~6GB RAM).
>
> Want your AI assistant to install for you instead? Paste [SETUP.md](../SETUP.md) (only), not this file.

> Just installed Plamen? This page tells you exactly what to do next — what's required, what's optional, and how to run your first audit.

> **Note:** On Windows use `python`; on macOS/Linux use `python3`.

> **First thing to run:** `plamen doctor` — verifies install (Plamen home, CLIs, Python deps, symlinks, submodules, CLAUDE.md markers) in a few seconds, exits non-zero on hard failures. No audit run, no paid API calls. If `plamen` isn't found, add `~/.plamen` to your PATH (see [README.md](../README.md)) or run `python plamen.py doctor` from inside `~/.plamen`. See [glossary.md](glossary.md) for terminology.

## What did install do?

`plamen install` (or `plamen setup`) set up:

| Component | What it is | Status after install |
|-----------|-----------|---------------------|
| **Symlinks** | Links Plamen's agents, rules, commands, and prompts into `~/.claude/` (Claude Code) or `~/.codex/plamen/` (Codex CLI) | Done |
| **Config** | Merged permissions, env vars, and MCP servers into `~/.claude/settings.json` (Claude Code) or `~/.codex/config.toml` (Codex CLI) | Done |
| **Orchestrator rules** | Injected `~/.claude/CLAUDE.md` (Claude Code) or `~/.codex/AGENTS.md` (Codex CLI) — the orchestrator's top-level instructions | Done |
| **Core Python deps** | `rich`, `InquirerPy` (wrapper UI) | Done |
| **MCP server deps** | slither-mcp, solana-fender, farofino-mcp | Done |
| **Chain toolchains** | Foundry, Solana CLI, Anchor, Aptos, Sui, etc. | Only if you selected them |
| **RAG database** | Vulnerability knowledge base (PyTorch + embeddings) | **Not installed** — separate step |

## What do I actually need?

### Required for all audits

These are installed automatically. If any are missing, `plamen` will tell you.

- **Claude Code** (`claude` in PATH) or **Codex CLI** (`codex` in PATH — cost-saving BETA backend)
- **Python 3.11-3.12** (`python` / `python3`)
- **Node.js 18+** (`npx`, `npm`)
- **Git**

### Required per chain (install only what you audit)

You do **not** need all chain tools. Install only the ones for your target:

| I'm auditing... | I need | Install command |
|-----------------|--------|-----------------|
| **EVM / Solidity** | Foundry (forge) | `plamen setup` → select EVM |
| **Solana / Anchor** | Solana CLI + Anchor | `plamen setup` → select Solana |
| **Aptos Move** | Aptos CLI | `plamen setup` → select Move |
| **Sui Move** | Sui CLI | `plamen setup` → select Move |
| **Soroban / Stellar** | Stellar CLI + Rust | `plamen setup` → select Soroban |
| **DAML / Canton** | DAML SDK (`daml` CLI) | install the DAML SDK; auto-detected on `.daml` sources |
| **L1 / Node Client** | Go or Rust + scip-go/rust-analyzer | `plamen setup` → select L1 |

> **Slither** (EVM static analysis) and **Medusa** (EVM stateful fuzzing) are recommended but optional. The pipeline works without them — it just has less static analysis coverage.

### Optional: RAG vulnerability database (~6GB RAM required)

RAG gives the pipeline historical vulnerability pattern matching — it searches a local database of 4k+ past audit findings (from Solodit, DeFiHackLabs, Immunefi bug bounties, and Immunefi audit competitions). The pipeline works without it (falls back to web search), but RAG improves finding quality.

> **Resource warning**: RAG build loads PyTorch + sentence-transformers + ChromaDB. Peak RAM: ~4-6GB. On machines with ≤8GB total RAM, close other applications first or skip this step entirely.

```bash
# Build the RAG database (~10-20 min, CPU + RAM intensive)
export SOLODIT_API_KEY=your_key_here    # free at solodit.cyfrin.io (recommended)
plamen rag
```

You can always build it later. Run the same command to rebuild after updates.

### Optional: API keys

Set in `~/.claude/mcp.json` (Claude Code). MCP runs natively on both backends; on Codex the same servers are configured under `[mcp_servers.*]` in `~/.codex/config.toml`. On Codex, the non-`SOLODIT` keys below (ETHERSCAN/TAVILY/HELIUS/RPC) go in the per-server `[mcp_servers.<name>.env]` blocks of `config.toml`. Replace the `YOUR_*` placeholders:

> **`SOLODIT_API_KEY` is the exception — it does NOT go in mcp.json.** Add `SOLODIT_API_KEY` to `~/.claude/settings.json` → `"env"` section (or `~/.codex/config.toml` → `[env]` for Codex). This is the only place the key is reliably visible to both `plamen rag` and audit agent subprocesses. If you put it in mcp.json, `plamen rag` will silently fail to index Solodit (smaller/near-empty RAG DB) with no error. The remaining keys below go in mcp.json. Free key from [solodit.cyfrin.io](https://solodit.cyfrin.io).

| Key | What it does | Impact if missing | Get it |
|-----|-------------|-------------------|--------|
| `ETHERSCAN_API_KEY` | Fetches verified source code on-chain | No production source verification (EVM only) | [etherscan.io/apis](https://etherscan.io/apis) (free) |
| `TAVILY_API_KEY` | Web search fallback when RAG fails | Falls back to built-in web search | [tavily.com](https://tavily.com) (free tier) |
| `HELIUS_API_KEY` | Solana on-chain data | No Solana account inspection | [helius.dev](https://helius.dev) (free tier) |
| RPC URL | Ethereum fork testing | No fork-mode PoC verification (EVM only) | Alchemy, Infura, or `https://eth.llamarpc.com` |

**None of these are required.** The pipeline runs without any API keys — it just has less production verification and RAG coverage.

## Run your first audit

### Option A: Terminal wizard (recommended for first time)

```bash
plamen
```

The interactive wizard walks you through: mode selection → target project → docs → scope → cost estimate → launch. The V2 driver auto-detects your backend (Claude Code or Codex CLI) via `plamen_home()`, and auto-detects (and auto-corrects) the target ecosystem/language at startup — no halt-to-rerun if the detected language is off; the resolved ecosystem is shown on the startup banner.

### Option B: One-liner

```bash
plamen core /path/to/your/project
```

### Option C: From inside your AI coding assistant

**Claude Code:**
```
/plamen-wizard          # Smart contract audit
/plamen-l1-wizard       # L1 infrastructure audit
```

**Codex CLI:**

After `plamen install --codex`, the same slash commands are installed into
`~/.codex/commands/` (from `codex-adapter/commands/`), so they work the same way:
```
/plamen-wizard          # Smart contract audit
/plamen-l1-wizard       # L1 infrastructure audit
```
Or use the terminal wrapper directly (no slash command needed):
```
$plamen core /path/to/project
```

All paths invoke the same V2 deterministic driver. The backend difference is transparent — agent prompts, depth templates, and verification logic are identical. The default high-capability model is **Opus 4.8** (`claude-opus-4-8`); override with `PLAMEN_OPUS_MODEL` / `PLAMEN_THOROUGH_OPUS_MODEL`.

### How the driver runs workers (v2.1.0)

- **PTY-supervised execution.** The driver drives each worker through a pseudo-terminal and infers turn completion from artifacts written to disk (the `<!-- PLAMEN_STATUS: COMPLETE -->` marker), not from a stdout/JSON envelope. This eliminates the 0-byte-stdio "silent hang" ambiguity from earlier versions. During breadth/rescan/depth you will see several `claude` (or `codex`) processes in your process tree — one per worker artifact. That's the driver-owned worker pool, not runaway processes.
- **Haltless resilience.** A finished audit is never thrown away at the finish line. The report-index, verify, inventory, and resume paths repair-then-degrade: any unfinished obligation is surfaced as a flagged Appendix-B item in `AUDIT_REPORT.md` rather than halting the run. Stale or corrupt checkpoints recover instead of stranding the audit, and rate-limit / usage-cap conditions auto-wait then resume.
- **Deterministic plumbing.** Report-index recovery, verify backfill, and finding dedup are mechanical Python steps (LLM out of the loop) for reliability.

## Where's my report?

When the audit finishes, the deliverable is written to the **root of the
audited project**:

```
<project>/AUDIT_REPORT.md
```

It contains an Executive Summary, a severity summary table, and a dedicated
section per finding — **Severity**, **Location** (`file:Lnnn`), **Description**
with the offending code, **Impact**, **PoC Result** (`[POC-PASS]` /
`[POC-FAIL]` / `[CODE-TRACE]`), and a **Recommendation** (a minimal fix diff for
PoC-confirmed findings) — followed by a Priority Remediation Order. Appendix A
lists excluded/duplicate findings; **Appendix B** surfaces any unfinished
obligation the haltless pipeline flagged for human triage. See
[`../rules/report-template.md`](../rules/report-template.md) for the exact
structure.

All intermediate artifacts (recon context, findings inventory, depth traces,
verification PoCs, the resume checkpoint) live in a per-audit workspace at
`<project>/.scratchpad/`. It is preserved for resume and discarded only on a
`--fresh` restart — you normally never need to open it. See [glossary.md](glossary.md)
for the `.scratchpad/` layout.

## What mode should I pick?

| Mode | When to use | Plan needed | Time (small codebase) | Time (large codebase) |
|------|-------------|-------------|-----------------------|-----------------------|
| **Light** | Quick scan, small codebases (<3k lines), Pro plan | Pro | ~15-30 min | ~1-2 hours |
| **Core** | Standard audit, most projects | Max | ~30-90 min | ~3-5 hours |
| **Thorough** | High-value audit, complex DeFi, want fuzzing | Max | ~1-3 hours | ~6-12 hours |

Small codebase = under ~3k lines of in-scope source. Large/complex codebases (multi-contract DeFi, L1 node clients) sit in the right-hand column — see `pipeline-phases-presentation.md` for per-phase budgets.

Start with **Light** if you're on a Pro plan or just trying it out. Use **Core** for real audits.

These tiers apply to both smart contract and L1 infrastructure audits. For node client / infrastructure codebases (Go/Rust), use `plamen l1 [light|core|thorough]` — same three tiers, same depth loop and verification pipeline, with L1-specific depth agents (consensus-invariant, network-surface) replacing token-flow.

## Verify everything works

Run `plamen setup` at any time to see your toolchain status. The box below is
**illustrative** — your real output will differ depending on what you have
installed, and it also includes a separate `Backend` row and an `MCP`
server-health row:

```
  ╭─────────────────────────────────────────────────────────╮
  │  Toolchain                                                │
  │                                                           │
  │    python  npx  git                                    ok │
  │  Backend   ✓claude  ✓codex                                │
  ├───────────────────────────────────────────────────────────┤
  │  EVM        ✓forge ✓anvil ✓cast ✓slither ○medusa      4/5 │
  │  Solana     ○solana ○anchor ○cargo ○trident ○scout    0/5 │
  │  Move       ○aptos ○sui ○ast-grep                     0/3 │
  │  Soroban    ○stellar ○scout ○cargo-fuzz               0/3 │
  │  L1 (Go)    ○go ○scip-go ○opengrep                    0/3 │
  │  L1 (Rust)  ○cargo ○rust-analyzer ○ast-grep ○cargo-fuzz 0/4│
  ├───────────────────────────────────────────────────────────┤
  │  RAG DB     vulnerability knowledge base       not built  │
  ├───────────────────────────────────────────────────────────┤
  │  MCP        static-analysis servers                   ... │
  ╰───────────────────────────────────────────────────────────╯
```

- **✓** = installed
- **○** = not installed (optional — install only what you need)
- The `EVM` / `Solana` / `Move` / `Soroban` / `L1 (Go)` / `L1 (Rust)` rows each
  cover one audited ecosystem — install only the toolchains for the ecosystems
  you audit (L1 Go/Rust is for node-client / infrastructure audits)
- You need at least one backend (`claude` or `codex`) — both are shown on the
  `Backend` row but only one is required
- **RAG DB** = run `plamen rag` to build
- **MCP** = static-analysis server health probes (may show `...` while probing)

## Updating

After pulling new versions:

```bash
cd ~/.plamen && git pull && plamen install
```

For Codex backend, add the `--codex` flag:

```bash
cd ~/.plamen && git pull && plamen install --codex
```

`git pull` alone updates symlinked files (agents, rules, skills, prompts), but `~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md` (the orchestrator's rules) are injected copies — not symlinks. Without `plamen install`, the orchestrator follows stale rules while everything else is updated. `plamen` will warn you if it detects a version mismatch.

See [updating.md](updating.md) for details on what auto-updates and what doesn't.

## Troubleshooting

Plamen runs on Windows, macOS, and Linux. POSIX systems use native PTY execution (`Popen` ownership + SIGCHLD reset) with nested-session env isolation. See [dependencies.md](dependencies.md) for platform-specific fixes (Windows Developer Mode, macOS hnswlib, Python version issues, etc.).

**Windows: "Microsoft Store python stub" warning.** On a fresh Windows install,
`plamen doctor` may warn that a Microsoft Store App Execution Alias stub for
`python.exe` / `python3.exe` sits in
`%LOCALAPPDATA%\Microsoft\WindowsApps\`. These are 0-byte stubs that open the
Store instead of running Python, and they sit at the front of `PATH`, so an LLM
agent that types `python`/`python3` mid-audit can keep popping the Store. This
warning is **expected** and does not affect Plamen's own subprocess calls
(which use the real interpreter directly). To silence it, turn the aliases off
under **Settings > Apps > Advanced app settings > App execution aliases**
(disable the App Installer `python` / `python3` entries), or install a real
Python from python.org / the system package manager and ensure it precedes
`WindowsApps` on `PATH`.
