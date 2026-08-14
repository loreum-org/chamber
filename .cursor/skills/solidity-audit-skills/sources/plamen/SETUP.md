# Automated Setup — Paste This Into Claude Code or Codex CLI

> **For users who prefer their AI assistant to run the install.**
> Copy everything below the `---` line into a Claude Code or Codex CLI session.
> The assistant will follow the steps, check for errors, and stop with a clear
> message if anything goes wrong. RAG database build is **off** by default
> (it requires ~6GB RAM and ~10-20 min, including network download of indexers).
Run `plamen rag` from a terminal
> yourself if you want it.

> **Do not paste `docs/setup.md` or `docs/getting-started.md` instead** — those
> are long-form manual instructions for humans, and contain the optional RAG
> build inline. Pasting them causes the assistant to autonomously execute
> heavy commands.

---

Please install Plamen (Web3 Security Auditor) on my machine. Follow these
steps **in order**. After each step, report any error and stop unless I tell
you to continue.

## Step 0: Detect platform and prerequisites

Run these checks in sequence and report what's missing:

```bash
# What OS are we on?
uname -s 2>/dev/null || ver

# Required tools
python3 --version 2>/dev/null || python --version    # need 3.11 or 3.12 (NOT 3.13+)
pip3 --version 2>/dev/null || pip --version
node --version                                        # need 18+
npx --version
git --version

# At least ONE backend CLI:
claude --version 2>/dev/null && echo "claude OK"
codex --version 2>/dev/null && echo "codex OK"
```

**If anything is missing**, stop and tell me which one. Do not try to install
system-level prerequisites yourself (Python, Node, Git) — that requires sudo
on some platforms and changes the user's machine state. Quick hints if asked:

- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Codex CLI** (avoid `sudo npm`; on Homebrew Node it fails with EACCES):
  ```bash
  mkdir -p ~/.npm-global && npm config set prefix ~/.npm-global
  echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc   # or ~/.bashrc
  npm install -g @openai/codex
  ```
- **Python 3.11/3.12**: `brew install python@3.12` (macOS) or `sudo apt install python3.12 python3-pip` (Ubuntu)
- **Node 18+**: https://nodejs.org or `brew install node`
- **macOS only**: `xcode-select --install` (needed for C++ compilation of MCP server deps)

## Step 0b: Windows — enable Developer Mode

> **Skip this on macOS and Linux.**

Plamen creates symlinks. On Windows, file symlinks require Developer Mode.
Direct the user to: **Settings > System > For Developers > Developer Mode = ON**.
Or, in admin PowerShell:

```powershell
reg add HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f
```

Without Developer Mode, directory junctions still work but file symlinks fail.

## Step 1: Clone the repository

Pick the platform-appropriate command. **Use `--recurse-submodules`** —
without it, MCP-server submodules (`custom-mcp/slither-mcp/`,
`custom-mcp/farofino-mcp/`) come up empty and step 3 will fail silently.

**Linux / macOS:**
```bash
git clone --recurse-submodules https://github.com/PlamenTSV/plamen.git ~/.plamen
cd ~/.plamen
```

**Windows (PowerShell):**
```powershell
git clone --recurse-submodules https://github.com/PlamenTSV/plamen.git $HOME\.plamen
cd $HOME\.plamen
```

**Expected output**: `Cloning into '...'` followed by `Submodule path 'custom-mcp/...': checked out '...'` lines.

**If the user already cloned without `--recurse-submodules`**, run inside
`~/.plamen/`:

```bash
git submodule update --init --recursive
```

**If they downloaded a ZIP from GitHub** instead of cloning, the submodule
dirs will be empty and there's no `.git/` to rehydrate from. Tell them to
re-do step 1 with `git clone`, not "Download ZIP".

## Step 2: Run the non-interactive install

```bash
python3 plamen.py install        # macOS/Linux
python plamen.py install         # Windows
```

This is **safe to run inside an AI assistant** — it never opens an interactive
prompt. It does:

1. Creates symlinks from `~/.plamen/{agents,rules,prompts,skills,commands}`
   into `~/.claude/` (and copies of `CLAUDE.md` between `<!-- PLAMEN:START -->`
   markers; user content outside markers is preserved).
2. Merges Plamen's permissions and MCP servers into `settings.json` and
   `mcp.json` additively. Never overwrites existing user keys.
3. Heals any dangling Plamen hook entries left over from a previous install
   whose `~/.plamen/` source moved away. Without this, the user's
   PreToolUse Bash hook blocks every shell command.
4. Installs Python dependencies. On PEP-668 systems (Homebrew Python,
   Ubuntu 23.04+), the installer auto-adds `--break-system-packages`. The
   user can override by setting `PIP_BREAK_SYSTEM_PACKAGES=0` before running
   if they prefer a virtualenv.

**If you have a Codex CLI install, also run**:

```bash
python3 plamen.py install --codex    # or `python` on Windows
```

This generates Codex-side configs into `~/.codex/` and symlinks
`~/.codex/plamen/` to the same `~/.plamen/`. Both backends share methodology
files.

**Expected output**: a green "Linked N items into ~/.claude" line and a
"Codex adapter installed successfully" line if `--codex` was used.

**If install reports any line containing "non-critical (failed)"**, do not
treat it as benign. Stop and tell me which dependency failed. The most
common cause is empty submodules from a ZIP download.

## Step 3: Add `plamen` to PATH

After install, the wrapper is at `~/.plamen/plamen` (Linux/macOS) or
`$HOME\.plamen\plamen.bat` (Windows). Add it to PATH so the user can run
`plamen` from anywhere:

**Linux (bash):**
```bash
echo 'export PATH="$HOME/.plamen:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

**macOS (zsh):**
```zsh
echo 'export PATH="$HOME/.plamen:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

**Windows (PowerShell, one-time, no admin):**
```powershell
[System.Environment]::SetEnvironmentVariable("Path", "$env:USERPROFILE\.plamen;" + [System.Environment]::GetEnvironmentVariable("Path", "User"), "User")
```

## Step 4: Verify the install (do not run the toolchain wizard from here)

```bash
plamen help     # banner + subcommand list — should print without error
```

> **Do not run `plamen setup` or `plamen` (no args) from this session.** Both
> open an InquirerPy wizard that needs a real terminal. From a non-TTY context
> (which is what Claude Code Bash and Codex shells are), the wizard either
> exits with a "non-TTY" message (new behavior) or crashes with
> `OSError: [Errno 22]` (older versions).
>
> Tell the user to open a real terminal and run `plamen setup` themselves
> when they want to install missing chain toolchains (Foundry, Solana CLI,
> Anchor, etc.).

## Step 5: (Optional) Build RAG vulnerability database

This step requires **~6GB RAM** and **3–5 minutes of CPU**. **Do not run it
from this AI session.** Tell the user to run from their terminal:

```bash
# Add the free API key first (settings.json env, not bashrc — see docs/setup.md)
plamen rag
```

## Done

Report: "Plamen installed at `~/.plamen`, symlinked into `~/.claude/` (and
`~/.codex/` if `--codex` was used). Run `plamen setup` from a real terminal
to install chain toolchains and `plamen rag` to build the vulnerability DB.
Run `plamen` (no args) to launch the interactive audit wizard."
