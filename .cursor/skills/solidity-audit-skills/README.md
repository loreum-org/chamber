# solidity-audit-skills

> ## ▶ If you are an agent, start here
>
> **You have been given this library because someone wants a codebase audited.**
> Load and follow:
>
> ```
> sources/orchestrator/SKILL.md
> ```
>
> It runs the whole audit unattended: profiles the target, selects every
> relevant skill across all four collections, dispatches four methodology
> orchestrators in parallel — each fanning out to its own subagents, ~30–45 in
> total — then cross-verifies every finding across methodologies and writes the
> report.
>
> **Do not ask the user which skills to use, how deep to go, or whether to
> proceed.** Choose from the routing table, record the choice, keep going. Do
> not audit the code yourself first — that anchors the verification tier.
>
> Everything else in this README is reference material for humans.

---

A curated aggregation of MIT-licensed smart-contract audit skill collections,
organized so an agent (Claude Code, Cursor, Codex, Gemini) can run a full audit
unattended, or locate the right methodology for a narrower task without
re-deriving it from scratch.

Maintained by **Daoism Systems**. Aggregation copyright © 2026
Daoism Systems; upstream skill content retains the copyright of each
upstream repo (see [LICENSE](LICENSE) and [ATTRIBUTIONS.md](ATTRIBUTIONS.md)).

## Running an audit

Point any capable agent at this repository and name your target:

```
Audit https://github.com/org/contracts using
https://github.com/daoism-systems/solidity-audit-skills
```

That is the whole interface. The agent reads the block above, loads
[`sources/orchestrator/SKILL.md`](sources/orchestrator/SKILL.md), and runs:

| Tier | What happens |
|---|---|
| **0** | Clone, build, run tests, profile the platform and feature signals, apply the [routing table](sources/orchestrator/references/routing-table.md), print a coverage manifest |
| **1** | Four methodology orchestrators in parallel — pashov (adversarial), omega (structural), quillshield (cataloged), plamen (language-native) |
| **2** | Each fans out to its own leaf agents — ~30–45 across the four |
| **3** | Cross-methodology verification, then the report |

The design principle at tier 3: **agreement across methodologies is the
strongest evidence available**, because four independent teams wrote them with
different blind spots — while a finding from only one methodology is not weak,
it is precisely what that methodology exists for. See
[cross-verification.md](sources/orchestrator/references/cross-verification.md).

## Why this exists

Three independent open-source audit-skill collections were used during the
everstrat/hackerhouse audit:

| Source | Upstream | Strength |
|---|---|---|
| **pashov** | [pashov/skills](https://github.com/pashov/skills) | 12-agent **parallel attacker** methodology (`solidity-auditor`) + pre-audit `x-ray` + fuzz/invariant `fizz` |
| **plamen** | [PlamenTSV/plamen](https://github.com/PlamenTSV/plamen) | Multi-chain depth + breadth **orchestrator** (EVM/Solana/Sui/Aptos/Soroban/DAML + L1 node clients) |
| **quillshield** | [quillai-network/quillshield_skills](https://github.com/quillai-network/quillshield_skills) | 10 **topic-focused** plugin skills with rich reference packs and confidence scoring |

Two further sets sit alongside them, both **originally authored** by Daoism
Systems rather than mirrored.
[`sources/orchestrator/`](sources/orchestrator/) is the autonomous entry point
described above — it owns routing and cross-methodology verification, and holds
no audit knowledge of its own.

[`sources/omega/`](sources/omega/) is a full methodology: 12 skills distilled
from Team Omega's audit methodology, derived by studying their public archive of
55 audit reports (2021–2026). Where the three
mirrored collections organize by bug class, this set organizes by the questions
asked of every contract — can assets get back out, does this guard actually
bind, is this counter right on every path. See
[sources/omega/README.md](sources/omega/README.md) and
[sources/omega/ATTRIBUTION.md](sources/omega/ATTRIBUTION.md).

They overlap heavily in topic coverage but each contributes unique material
(see [CORRELATIONS.md](CORRELATIONS.md)). Mirroring them side-by-side, plus
a thin concept index that points across, gives a single place to:

- pick the best lens for a given bug class (pashov for attacker reasoning,
  plamen for multi-language depth, quillshield for cataloged reference)
- combine lenses (e.g. pashov `math-precision-agent` + quillshield
  `input-arithmetic-safety` + plamen `overflow-safety` skill)
- preserve upstream LICENSE/attribution without copy-paste drift

## Usage

**Drop this repo into your LLM-based code editor.** Clone or copy it into
your project workspace (or anywhere the editor indexes):

```bash
git clone https://github.com/daoism-systems/solidity-audit-skills.git
```

For a **full audit**, just point the agent at the repo — see *Running an audit*
above. To load a **single** skill by hand, reference it with `@` in chat (Cursor,
Claude Code) or via the agent's file-loading mechanism (Codex, Gemini):

```
@solidity-audit-skills/sources/pashov/solidity-auditor/SKILL.md
@solidity-audit-skills/sources/quillshield/plugins/reentrancy-pattern-analysis/skills/reentrancy-pattern-analysis/SKILL.md
@solidity-audit-skills/sources/plamen/agents/depth-edge-case.md
```

That's it. The agent now has the methodology in context. To pick the right
skill for your task:

1. Browse [library/by-bug-class.md](library/by-bug-class.md) if you know
   the vulnerability class you're hunting.
2. Browse [library/by-phase.md](library/by-phase.md) if you know where in
   the audit you are (recon / breadth / depth / verify / report).
3. Browse [library/by-language.md](library/by-language.md) if you're
   auditing a non-EVM target (Solana, Sui, Aptos, Soroban, DAML, L1).
4. Cross-reference with [CORRELATIONS.md](CORRELATIONS.md) to see which
   repos cover the same topic and how their approaches differ.

No install step. No symlinks. No runtime hook. The skills are plain
markdown — whatever the editor does with markdown, it does here.

## Layout

```
solidity-audit-skills/
├── LICENSE                 # Daoism Systems MIT + per-source attribution block
├── README.md               # This file
├── ATTRIBUTIONS.md         # File-level provenance, pinned SHAs, copyright notices
├── scripts/                # Stdlib verification checks, run in CI
├── CORRELATIONS.md         # Topic-by-topic overlap matrix (what correlates, what doesn't)
├── sources/                # All skill collections
│   ├── orchestrator/       # ORIGINAL — autonomous audit entry point (start here)
│   ├── pashov/             # MIRROR — pashov/skills (solidity-auditor + x-ray + fizz)
│   │   └── LICENSE
│   ├── plamen/             # MIRROR — PlamenTSV/plamen (agents, skills, rules, prompts)
│   │   └── LICENSE
│   ├── quillshield/        # MIRROR — quillai-network/quillshield_skills (10 plugins)
│   │   └── LICENSE
│   └── omega/              # ORIGINAL — 12-skill methodology by Daoism Systems
│       ├── README.md
│       └── ATTRIBUTION.md  # Corpus studied, derivation method, licensing
└── library/                # Concept-organized indexes pointing into sources/
    ├── README.md           # How the index is organized
    ├── by-bug-class.md     # Reentrancy, oracle, math, access-control, …
    ├── by-phase.md         # Recon, breadth, depth, verify, report
    ├── by-language.md      # EVM, Solana, Sui, Aptos, Soroban, DAML, L1
    └── by-role.md          # Orchestrator, attacker, verifier, synthesizer
```

`sources/` is the source of truth, and holds two kinds of directory. The three
**mirrors** — `pashov/`, `plamen/`, `quillshield/` — are untouched copies of
the upstream repos (with heavy script directories omitted, see
[ATTRIBUTIONS.md](ATTRIBUTIONS.md)), each keeping its upstream `LICENSE` in
place. `omega/` is **original writing** by Daoism Systems and carries no
upstream licence, because it mirrors nothing; its provenance is recorded in
[sources/omega/ATTRIBUTION.md](sources/omega/ATTRIBUTION.md).

Keeping the distinction visible matters for redistribution: a single
`rg -F "AI Skills Contributors" sources/pashov` still confirms file lineage for
the mirrors, and `ATTRIBUTIONS.md` states per directory which category it falls
into. `library/` only **points** into `sources/`; it does not duplicate skill
content.

Each mirror is pinned to an exact upstream commit, recorded both in
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) and machine-readably in
`sources/<name>/.provenance`. CI verifies on every PR that those records match
what is on disk and that every path named in the docs resolves; a weekly job
reports when an upstream has moved ahead. See [scripts/README.md](scripts/README.md).

```bash
python3 scripts/check_links.py        # doc references resolve
python3 scripts/check_frontmatter.py  # SKILL.md frontmatter + name collisions
python3 scripts/check_provenance.py   # pinned SHAs consistent with disk
```

## Licensing — short version

- **This repo (aggregation layer):** MIT, © 2026 Daoism Systems. See
  [LICENSE](LICENSE).
- **`sources/pashov/`:** MIT, © 2024 AI Skills Contributors. Notice
  preserved verbatim at [sources/pashov/LICENSE](sources/pashov/LICENSE).
- **`sources/plamen/`:** MIT, © 2025-2026 Plamen Contributors. Notice
  preserved verbatim at [sources/plamen/LICENSE](sources/plamen/LICENSE).
- **`sources/quillshield/`:** MIT, © 2025 QuillShield. Notice preserved
  verbatim at [sources/quillshield/LICENSE](sources/quillshield/LICENSE).

Key MIT obligations when redistributing or extending this library:

- Keep the copyright + permission notice on all copies or substantial
  portions of each upstream file. The `sources/<repo>/LICENSE` files satisfy
  this; do not delete them.
- If you fork or substantially modify an upstream file, MIT does not
  require you to publish your changes, but you must keep the original
  copyright notice and add your own. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
  for the per-file authorship record.

## What is NOT in scope of this library

- The Plamen Python driver (`plamen.py`, 300 KB), installers
  (`_avm_installer.py`, `_solana_installer.py`, `_sui_installer.py`),
  `scripts/` directory (8 MB of one-off helpers), and per-language test
  fixtures. Methodology files only — install the upstream repo if you need
  the runtime.
- The pashov `fizz/scripts/` JS helpers. The fuzz pipeline templates,
  agents, and references are mirrored; the JS executor is not.
- Per-audit output from the hackerhouse audit (agent bundles, PoCs,
  findings) lives in the audit repo, not here.
