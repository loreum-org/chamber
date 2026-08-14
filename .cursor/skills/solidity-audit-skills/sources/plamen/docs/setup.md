# Setup Guide

> **⚠️ Do NOT paste this file into Claude Code or Codex CLI.** These are manual setup instructions meant to be followed in your terminal. Pasting into an AI coding assistant causes it to autonomously execute the commands, including the optional RAG build which requires ~6GB free RAM and heavy CPU for ~10-20 min (including network download of indexers).
>
> Want your AI assistant to install for you instead? Paste [SETUP.md](../SETUP.md) (only), not this file.

> **Just installed?** See [getting-started.md](getting-started.md) for the short version — what's required, what's optional, first audit walkthrough.
>
> For per-platform troubleshooting (Developer Mode, OpenSSL, Trident), see [dependencies.md](dependencies.md).

## Prerequisites

### Required

| Tool | Purpose | Install |
|------|---------|---------|
| **Claude Code CLI** (or Codex CLI — BETA) | AI runtime | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) or [github.com/openai/codex](https://github.com/openai/codex) |
| **Python 3.11-3.12** | MCP servers, wrapper | [python.org](https://python.org) |
| **Node.js 18+** / **npx** | npm MCP servers | [nodejs.org](https://nodejs.org) |
| **Git** | Submodules, deps | [git-scm.com](https://git-scm.com) |

### Per-Language

<details>
<summary><strong>EVM/Solidity</strong></summary>

| Tool | Purpose | Install |
|------|---------|---------|
| Foundry (forge, anvil, cast) | Build, test, fork | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Slither | Static analysis | `pip install slither-analyzer` |
| Medusa | Stateful fuzzing (Thorough) | [github.com/crytic/medusa](https://github.com/crytic/medusa/releases) |

</details>

<details>
<summary><strong>Solana</strong></summary>

| Tool | Purpose | Install |
|------|---------|---------|
| Solana CLI | Toolchain | [docs.anza.xyz](https://docs.anza.xyz/cli/install) |
| Anchor | Build Anchor programs | `avm install latest && avm use latest` |
| Trident | Stateful fuzzing (v0.11+ — all platforms) | `cargo install trident-cli` |
| OpenSSL | Required by Trident on Windows | `winget install ShiningLight.OpenSSL.Dev` |

> **Windows users**: Two prerequisites before building Solana programs:
> 1. **Developer Mode** — required for `cargo-build-sbf` symlinks. Settings > System > For Developers > toggle ON. See [SETUP.md](../SETUP.md) Step 5b.
> 2. **OpenSSL** — required to compile Trident fuzz harness. Install via `winget install ShiningLight.OpenSSL.Dev`. The `plamen.py` wrapper auto-detects and sets `OPENSSL_DIR`/`OPENSSL_LIB_DIR`/`OPENSSL_INCLUDE_DIR`.

</details>

<details>
<summary><strong>Aptos Move</strong></summary>

| Tool | Install |
|------|---------|
| Aptos CLI | [aptos.dev/build/cli](https://aptos.dev/build/cli) |

</details>

<details>
<summary><strong>Sui Move</strong></summary>

| Tool | Install |
|------|---------|
| Sui CLI | [docs.sui.io](https://docs.sui.io/guides/developer/getting-started/sui-install) |

</details>

<details>
<summary><strong>Soroban/Stellar</strong></summary>

| Tool | Purpose | Install |
|------|---------|---------|
| Rust (stable) | Contract compilation | [rustup.rs](https://rustup.rs) |
| Stellar CLI | Build, test, deploy | [stellar.org/docs](https://stellar.org/docs/build/smart-contracts/getting-started) |

</details>

<details>
<summary><strong>L1 Infrastructure (Go/Rust)</strong></summary>

| Tool | Purpose | Install |
|------|---------|---------|
| Go 1.25+ | Build Go node clients | [go.dev/dl](https://go.dev/dl/) |
| Rust (stable) | Build Rust node clients | [rustup.rs](https://rustup.rs) |
| scip-go | SCIP batch indexing (Go) | `go install github.com/scip-code/scip-go/cmd/scip-go@latest` |
| rust-analyzer | SCIP batch indexing (Rust) | Via rustup component or IDE |
| Opengrep | Cross-ecosystem static analysis | [github.com/opengrep/opengrep](https://github.com/opengrep/opengrep) |

> L1 tools are only needed for `plamen l1` mode. Skip if you only audit smart contracts.

</details>

---

## Installation

### 0. Windows: Enable Developer Mode

> **Skip on macOS/Linux.** Symlinks work without elevated privileges on Unix systems.

The installer creates symlinks from `~/.plamen/` into `~/.claude/` (and `~/.codex/plamen/` with `--codex`). On Windows, file symlinks require Developer Mode:
- **Settings UI**: Settings > System > For Developers > toggle ON
- **Admin PowerShell**: `reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f`

### 1. Clone and initialize

```bash
git clone --recurse-submodules https://github.com/PlamenTSV/plamen.git ~/.plamen
cd ~/.plamen
```

> Use `--recurse-submodules` (not "Download ZIP"). The repo ships `custom-mcp/slither-mcp/` and `custom-mcp/farofino-mcp/` as submodules — without `--recurse-submodules`, they come up empty and step 2's `pip install -e` silently fails. If you already cloned without it: `git submodule update --init --recursive`.

> This clones into `~/.plamen`, keeping it separate from Claude Code's `~/.claude` (or Codex's `~/.codex/`). The installer creates symlinks so your AI runtime discovers Plamen's agents, rules, and commands. Your existing settings are preserved via additive config merging.

### 2. Install core Python dependencies

```bash
# Wrapper (lightweight — ~30s)
pip install -r requirements.txt

# MCP servers (~1GB download -- PyTorch + all-MiniLM-L6-v2 model)
pip install -r custom-mcp/unified-vuln-db/requirements.txt
pip install -r custom-mcp/farofino-mcp/requirements.txt
pip install -e custom-mcp/solana-fender

# EVM only (requires Python 3.11+, solc)
pip install -e custom-mcp/slither-mcp
```

> On macOS/Linux, use `pip3 --user` instead of bare `pip` to install to user site-packages. On Homebrew Python or Ubuntu 23.04+, also add `--break-system-packages`. The `plamen install` command handles all this automatically.

### 3. Configure for your backend

Plamen supports two AI backends. Install one or both:

> **Backend status**: Claude Code is the default, fully-supported backend. Codex CLI (`codex exec`) is a **cost-saving BETA** added in v2.1.0 — it runs one `codex exec` per depth job, auto-waits on natural-language usage-cap detection instead of halting, and runs real Devil's-Advocate iteration-2 depth. Some features remain Claude-only (see [docs/mcp-servers.md](mcp-servers.md)).

> **Default model**: On Claude Code, Thorough-mode depth/orchestration defaults to **Opus 4.8** (`claude-opus-4-8`). Override with the `PLAMEN_OPUS_MODEL` environment variable.

**Claude Code** (default):

```bash
python3 plamen.py install       # macOS / Linux
python plamen.py install        # Windows
```

This merges config files automatically (`settings.json`, `mcp.json`, `CLAUDE.md`) and creates symlinks for agents, rules, prompts, skills, and commands into `~/.claude/`. No manual configuration needed.

**Codex CLI:**

```bash
python3 plamen.py install --codex   # macOS / Linux
python plamen.py install --codex    # Windows
```

This generates Codex config files, creates `~/.codex/plamen/` (symlinked to your Plamen checkout), and copies `codex-adapter/config.toml` and `codex-adapter/AGENTS.md` into `~/.codex/`. MCP servers are configured in `~/.codex/config.toml` (TOML `[mcp_servers.*]` sections) instead of `mcp.json` — they run natively under Codex's own MCP host, generated by `scripts/codex_adapter.py:generate_config_toml` from `mcp.json.example` at install time. Tool permissions are interactive on first use (select "Always allow" per server); `evm-chain-data` is currently disabled on Codex (MCP protocol version mismatch) and four Python MCP servers are launched through a schema-sanitizer shim. See [docs/mcp-servers.md](mcp-servers.md) for the specifics. Permissions for shell/sandbox are controlled by `config.toml`'s `approval_mode` and `sandbox_mode` fields, not `settings.json`.

> **Both backends**: If you use both Claude Code and Codex CLI, run the installer twice — once without `--codex` (for `~/.claude/`) and once with `--codex` (for `~/.codex/plamen/`). The methodology files are shared via symlinks; only the runtime config differs.

**Manual setup** (if not using the installer):

```bash
# Claude Code
cp mcp.json.example ~/.claude/mcp.json          # if ~/.claude/mcp.json doesn't exist
cp settings.json.example ~/.claude/settings.json # if ~/.claude/settings.json doesn't exist

# Codex CLI
mkdir -p ~/.codex
ln -s ~/.plamen ~/.codex/plamen                  # shared methodology
cp codex-adapter/config.toml ~/.codex/config.toml        # runtime config (copy, not symlink)
cp codex-adapter/AGENTS.md ~/.codex/AGENTS.md            # orchestrator rules (copy, not symlink)
```

Edit `~/.claude/mcp.json` (Claude Code) or `~/.codex/config.toml` (Codex CLI) with your API keys. See [MCP Servers](mcp-servers.md) for details.

**macOS/Linux — fix the Python command (manual `cp mcp.json.example` path only):** If you used `plamen install`, **skip this** — the installer's `_merge_mcp_json()` already resolves `"command": "python"`/`"python3"` to your interpreter's absolute path (`sys.executable`) via `_resolve_command()`, so re-running this sed is unnecessary and could clobber the resolved path. This step is **only** for the manual setup above where you copied `mcp.json.example` directly. In that copied file the Python-based MCP servers use `"command": "python"` by default. If your system only has `python3` (check: `which python`), update mcp.json:

```bash
sed -i '' 's/"command": "python"/"command": "python3"/g' ~/.claude/mcp.json  # macOS
sed -i 's/"command": "python"/"command": "python3"/g' ~/.claude/mcp.json    # Linux
```

Windows users: keep `"command": "python"` as-is. Codex CLI users: `config.toml` MCP commands are already set correctly by the installer.

### 4. Build the RAG database (OPTIONAL — ~6GB RAM required)

First, add `SOLODIT_API_KEY` to your backend's config:

**Claude Code** — add to `~/.claude/settings.json` → `"env"` section:

```json
{
  "env": {
    "MCP_TIMEOUT": "30000",
    "MCP_TOOL_TIMEOUT": "300000",
    "SOLODIT_API_KEY": "your_key_here"
  }
}
```

**Codex CLI** — set as a shell environment variable before running `plamen rag`, or add to your shell profile:

```bash
export SOLODIT_API_KEY="your_key_here"    # macOS / Linux
$env:SOLODIT_API_KEY = "your_key_here"    # Windows PowerShell
```

> **Why settings.json for Claude Code and not `export`?** Claude Code runs subprocesses in non-interactive shells that don't source `.bashrc`/`.zshrc`. Only `settings.json` `"env"` vars are reliably propagated to both `plamen rag` and audit agent Bash subprocesses. Codex CLI inherits shell environment variables normally, so `export` or `$env:` works.

Then run (once Plamen is on your PATH, all platforms):

```bash
plamen rag
```

Or, before PATH is set, run from inside `~/.plamen`:

```bash
python3 plamen.py rag    # macOS / Linux
python plamen.py rag     # Windows
plamen.bat rag           # Windows (alternative to python plamen.py)
```

> **Note**: `plamen.bat` is the same wrapper as the `plamen` command on your PATH — it is just invoked by relative name from inside `~/.plamen` before PATH is set. The Windows examples elsewhere in these docs use `python plamen.py`, which is equivalent.

If deps aren't installed yet, `plamen rag` installs them automatically before indexing (downloads PyTorch ~2GB). If the build fails partway through (network error, timeout), re-run the same command — it wipes the partial database and rebuilds from scratch.

> **⚠️ Resource warning**: RAG build loads PyTorch + sentence-transformers + ChromaDB. Peak RAM usage: ~4-6GB. On machines with ≤8GB RAM, close other applications first. The pipeline works without RAG — findings use code analysis + WebSearch fallback instead of historical vulnerability matching. Skip this step if resources are limited.

### 5. Verify

```bash
python3 plamen.py         # macOS / Linux
python plamen.py          # Windows
```

The startup screen runs a dependency check showing which tools are available. As of v2.1.0 it also shows the auto-detected **ecosystem** (language) for your target — detection runs and auto-corrects at startup (no halt-to-rerun), resolved via manifest-priority rules. The detected ecosystem is printed on the startup banner so you can confirm it before launching an audit.

---

## Permissions

Plamen requires broad tool access for autonomous auditing. The permission model differs by backend:

**Claude Code** (`settings.json`):

The default `settings.json.example` auto-approves all tool calls:

| Permission | Why Required |
|-----------|-------------|
| `Agent(*)` | Spawns all subagents. **Without this, the pipeline silently fails.** |
| `Bash(*)` | Runs `forge build/test`, `cargo test`, etc. |
| `Read(*)`, `Write(*)`, `Edit(*)` | Reads source, writes PoCs, edits scratchpad |
| `mcp__*` | All MCP server tool calls |

The deny list blocks destructive operations (`rm -rf`, `sudo`, force push).

**Codex CLI** (`~/.codex/config.toml`):

Permissions are controlled by two fields in `config.toml`:

| Field | Value | Effect |
|-------|-------|--------|
| `approval_mode` | `"full-auto"` | All tool calls auto-approved (equivalent to Claude Code's `Agent(*)` + `Bash(*)`) |
| `sandbox_mode` | `"danger-full-access"` | Full filesystem and network access for build/test/fork operations |

MCP server access is granted per-server in the `[mcp_servers.*]` sections of `config.toml`. No separate permissions file needed.

---

## Cold Start

The first MCP tool call per session loads ChromaDB and the all-MiniLM-L6-v2 embedding model (~5s). Subsequent calls are instant. Both Claude Code and Codex CLI experience this cold start. The pipeline handles it automatically with probe-first patterns and WebSearch fallback. On Codex CLI, MCP server startup timeouts are configured per-server in `config.toml` (`startup_timeout_sec = 30` by default).

---

## Execution Model (v2.1.0)

You do not need to configure any of this — it runs automatically — but it helps to know how the driver supervises workers:

- **PTY-supervised execution**: As of v2.1.0 the driver drives each `claude`/Codex worker through a pseudo-terminal and infers turn completion from artifacts written to disk (disk-derived completion) rather than from a fragile stdout/JSON envelope. This eliminates the 0-byte-stdio ambiguity and silent-hang class from earlier releases. A dedicated PTY transport preflight runs before the pipeline; on macOS/Linux, POSIX PTY execution uses `Popen` ownership with SIGCHLD reset and strips `CLAUDE_CODE_*` env vars from nested child workers.
- **Haltless resilience**: A finished audit is never discarded at the finish line. The report-index, verify, inventory, and resume paths repair-then-degrade and surface any unfinished obligations as flagged Appendix-B items in `AUDIT_REPORT.md` instead of halting. Stale or corrupt checkpoints recover instead of stranding the run, so re-running the same `plamen` command resumes from the last good state.
- **Deterministic/mechanical plumbing**: Several formerly-LLM steps (report-index recovery, verify backfill/queue manifests, candidate dedup) now run as deterministic Python so a single bad LLM turn cannot lose findings or stall the run.

---

## Updating

After pulling new versions, always re-run the installer for each backend you use:

```bash
cd ~/.plamen && git pull && plamen install              # Claude Code
cd ~/.plamen && git pull && plamen install --codex      # Codex CLI (if used)
```

`git pull` updates symlinked files (agents, rules, skills, prompts) automatically, but several files are injected/merged copies — not symlinks — and require `plamen install` to refresh:

**Claude Code** (`plamen install`):
- **`CLAUDE.md`** — orchestrator rules (agent counts, critical rules, phase references)
- **`settings.json`** — new permissions or env vars added in a release
- **`mcp.json`** — new MCP server definitions added in a release

**Codex CLI** (`plamen install --codex`):
- **`~/.codex/AGENTS.md`** — Codex orchestrator rules (equivalent to `CLAUDE.md`); generated from `codex-adapter/AGENTS.md` in the repo
- **`~/.codex/config.toml`** — permissions, model config, and MCP server definitions; generated from `codex-adapter/config.toml` in the repo

Without re-install, the orchestrator follows stale rules while skills and prompts are already updated. `plamen` will warn you on next launch if it detects a version mismatch.

See [updating.md](updating.md) for the full breakdown of what auto-updates and what doesn't.
