# Attributions — File-Level Provenance

This file records, per directory under `sources/`, exactly what was copied
from which upstream repo. It exists so that any redistribution of this
repository can satisfy the MIT license obligation ("The above copyright
notice and this permission notice shall be included in all copies or
substantial portions of the Software") with a single auditable record.

`sources/` holds two kinds of directory, and the distinction is load-bearing
for licensing:

| Directory | Kind | Copyright |
|---|---|---|
| `sources/pashov/` | **Mirror** of `pashov/skills` | © 2024 AI Skills Contributors |
| `sources/plamen/` | **Mirror** of `PlamenTSV/plamen` | © 2025-2026 Plamen Contributors |
| `sources/quillshield/` | **Mirror** of `quillai-network/quillshield_skills` | © 2025 QuillShield |
| `sources/omega/` | **Original** — authored by Daoism Systems | © 2026 Daoism Systems |

Each mirror carries its upstream `LICENSE` verbatim. `sources/omega/` carries
none, because it copies nothing; see
[`sources/omega/ATTRIBUTION.md`](sources/omega/ATTRIBUTION.md) for what it was
derived from and how.

## Pinned upstream commits

Upstream content was fetched on **2026-07-20**. The mirrors carry no `.git`, so
each commit below was recovered by content match — hashing every mirrored file
and walking upstream history for the commit whose tree matches — and is
re-verified by `scripts/check_provenance.py`.

| Source | Commit | Dated | Files | Byte-identical |
|---|---|---|---|---|
| `sources/pashov/` | [`c577eb7799c349de0acb187ba00ca98e14e436fd`](https://github.com/pashov/skills/commit/c577eb7799c349de0acb187ba00ca98e14e436fd) | 2026-07-09 | 75 | 75 / 75 |
| `sources/plamen/` | [`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`](https://github.com/PlamenTSV/plamen/commit/795962b96e254f2e423a2635fe7f8cb8ea1e6d69) | 2026-07-15 | 414 | 413 / 414 ¹ |
| `sources/quillshield/` | [`8bdd3c058704cd855ce29b8e2385708b59152606`](https://github.com/quillai-network/quillshield_skills/commit/8bdd3c058704cd855ce29b8e2385708b59152606) | 2026-03-30 | 85 | 85 / 85 |
| `sources/omega/` | — | — | 12 skills | original content, no upstream |

¹ `mcp-packages/run-node-mcp.cmd` differs only in line endings: CRLF normalised
to LF on checkout. Content is otherwise identical. Recorded in that source's
`known_differences`.

Each figure is also held machine-readably in `sources/<name>/.provenance`, which
CI validates against what is actually on disk. As of the last verification all
three mirrors were level with their upstream default branch; a weekly job
reports drift.

---

## `sources/pashov/` — from `pashov/skills`

| Path under `sources/pashov/` | Upstream URL |
|---|---|
| `LICENSE` | https://github.com/pashov/skills/blob/main/LICENSE |
| `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.gitignore` | https://github.com/pashov/skills/tree/main |
| `solidity-auditor/` (full) | https://github.com/pashov/skills/tree/main/solidity-auditor |
| `x-ray/` (full) | https://github.com/pashov/skills/tree/main/x-ray |
| `fizz/LICENSE`, `fizz/SKILL.md`, `fizz/README.md`, `fizz/VERSION`, `fizz/agents/`, `fizz/references/`, `fizz/skills/`, `fizz/templates/`, `fizz/evals/` | https://github.com/pashov/skills/tree/main/fizz |

**Copyright notice** (preserved verbatim at `sources/pashov/LICENSE`):

> Copyright (c) 2024 AI Skills Contributors

**Omitted from the mirror** (kept upstream; install pashov/skills directly
if you need them):

- `fizz/scripts/` — JS executors for forge/medusa/echidna (~156 KB)
- `x-ray/scripts/` — Python + bash enumerators (~100 KB)
- `static/`, `.github/`, `.git/`

---

## `sources/plamen/` — from `PlamenTSV/plamen`

| Path under `sources/plamen/` | Upstream URL |
|---|---|
| `LICENSE` | https://github.com/PlamenTSV/plamen/blob/main/LICENSE |
| `README.md`, `SETUP.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `VERSION`, `.plamen-manifest.json`, `pyproject.toml`, `requirements*.txt`, `mcp.json.example`, `settings.json.example` | https://github.com/PlamenTSV/plamen/tree/main |
| `agents/` (full) — 6 depth + 2 analyzer/verifier agent definitions | https://github.com/PlamenTSV/plamen/tree/main/agents |
| `skills/` — `audit-prep/` orchestrator | https://github.com/PlamenTSV/plamen/tree/main/skills |
| `agents/skills/soroban/` (19 skills) | https://github.com/PlamenTSV/plamen/tree/main/agents/skills/soroban |
| `agents/skills/sui/` (22 skills) | https://github.com/PlamenTSV/plamen/tree/main/agents/skills/sui |
| `agents/skills/niche/` (9 cross-language niche agents) | https://github.com/PlamenTSV/plamen/tree/main/agents/skills/niche |
| `agents/skills/injectable/` (10 + 25 L1 skills) | https://github.com/PlamenTSV/plamen/tree/main/agents/skills/injectable |
| `rules/` (full — orchestrator rules, finding format, phase prompts, skill index) | https://github.com/PlamenTSV/plamen/tree/main/rules |
| `prompts/` (full — per-language phase prompts) | https://github.com/PlamenTSV/plamen/tree/main/prompts |
| `commands/` (slash commands) | https://github.com/PlamenTSV/plamen/tree/main/commands |
| `docs/` (full) | https://github.com/PlamenTSV/plamen/tree/main/docs |
| `custom-mcp/`, `mcp-packages/`, `opengrep-rules/` | https://github.com/PlamenTSV/plamen/tree/main |

**Copyright notice** (preserved verbatim at `sources/plamen/LICENSE`):

> Copyright (c) 2025-2026 Plamen Contributors

**Omitted from the mirror** (kept upstream; install PlamenTSV/plamen
directly if you need them):

- `plamen.py` (300 KB Python driver) and `plamen`, `plamen.sh`, `plamen.bat`,
  `_avm_installer.py`, `_solana_installer.py`, `_sui_installer.py`,
  `write_dedup.py`
- `scripts/` (~8 MB of one-off helpers, validators, installers)
- `codex-adapter/`, `plamen_l1/`, `CHANGELOG.md`, `agent-transcripts/`,
  `.git/`, `.github/`

---

## `sources/quillshield/` — from `quillai-network/quillshield_skills`

| Path under `sources/quillshield/` | Upstream URL |
|---|---|
| `LICENSE` | https://github.com/quillai-network/quillshield_skills/blob/main/LICENSE |
| `README.md`, `INSTALL.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.gitignore`, `.markdownlint.yaml`, `install.sh` | https://github.com/quillai-network/quillshield_skills/tree/main |
| `.claude-plugin/` (marketplace manifest) | https://github.com/quillai-network/quillshield_skills/tree/main/.claude-plugin |
| `plugins/behavioral-state-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/behavioral-state-analysis |
| `plugins/semantic-guard-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/semantic-guard-analysis |
| `plugins/state-invariant-detection/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/state-invariant-detection |
| `plugins/reentrancy-pattern-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/reentrancy-pattern-analysis |
| `plugins/oracle-flashloan-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/oracle-flashloan-analysis |
| `plugins/proxy-upgrade-safety/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/proxy-upgrade-safety |
| `plugins/input-arithmetic-safety/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/input-arithmetic-safety |
| `plugins/external-call-safety/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/external-call-safety |
| `plugins/signature-replay-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/signature-replay-analysis |
| `plugins/dos-griefing-analysis/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/dos-griefing-analysis |
| `plugins/defender/` | https://github.com/quillai-network/quillshield_skills/tree/main/plugins/defender |

**Copyright notice** (preserved verbatim at `sources/quillshield/LICENSE`):

> Copyright (c) 2025 QuillShield (https://github.com/quillai-network)

**Omitted from the mirror:** `.git/`, `.github/`. Everything else in the
upstream repo is included; the repo is small (~848 KB total).

---

## Originally-authored files (root, `library/`, and `sources/omega/`)

These are original work by Daoism Systems, released under the same MIT terms
as the upstream sources for convenience. No upstream skill content is
duplicated in any of them.

| File | Original authorship |
|---|---|
| `LICENSE` (root) | MIT notice — Daoism Systems aggregator + 3 upstreams attributed. |
| `README.md` (root) | © 2026 Daoism Systems. |
| `ATTRIBUTIONS.md` (this file) | © 2026 Daoism Systems. |
| `CORRELATIONS.md` | © 2026 Daoism Systems. The correlation analysis is original editorial work; skill descriptions paraphrase upstream SKILL.md frontmatter. |
| `library/*.md` | © 2026 Daoism Systems. Indexes point to upstream files; no skill content is duplicated. |
| `sources/omega/**` | © 2026 Daoism Systems. Original skill prose derived from the methodology in [OmegaAudits/audits](https://github.com/OmegaAudits/audits); no Team Omega report text is reproduced. Full derivation record in [`sources/omega/ATTRIBUTION.md`](sources/omega/ATTRIBUTION.md). |

---

## Reproducing this mirror

To rebuild the mirrored parts of `sources/` **at the exact commits this repo
carries**, clone and check out the pinned SHAs above:

```bash
mkdir -p sources && cd sources

git clone https://github.com/pashov/skills.git pashov
git -C pashov checkout c577eb7799c349de0acb187ba00ca98e14e436fd

git clone https://github.com/PlamenTSV/plamen.git plamen
git -C plamen checkout 795962b96e254f2e423a2635fe7f8cb8ea1e6d69

git clone https://github.com/quillai-network/quillshield_skills.git quillshield
git -C quillshield checkout 8bdd3c058704cd855ce29b8e2385708b59152606

# Then remove the omitted directories listed above for each repo,
# and the .git directories.
```

Cloning without the checkout step reproduces *whatever upstream HEAD is today*,
which is a different artifact. Verify a rebuild with:

```bash
python3 scripts/check_provenance.py
```

`sources/omega/` is not reproducible this way — it is original writing, not a
clone, and has no upstream to fetch.

Pin to a specific tag (`--branch vX.Y.Z`) for reproducible provenance.
