# Library Indexes

The files in this directory are editorial indexes. They **point** into
`sources/`; they do not duplicate skill content. Every entry has a relative
link back to the upstream mirror file so attribution is one click away.

> **Running a full audit?** You do not need these indexes — load
> [`../sources/orchestrator/SKILL.md`](../sources/orchestrator/SKILL.md), which
> routes automatically across all four collections. These cross-cuts are for
> picking a *specific* lens by hand.

Four cross-cuts are provided:

| File | Organizes by | Use when |
|---|---|---|
| [by-bug-class.md](by-bug-class.md) | vulnerability class (reentrancy, oracle, math, …) | you know what bug class you're hunting |
| [by-phase.md](by-phase.md) | audit phase (recon, breadth, depth, verify, report) | you know where in the audit you are |
| [by-language.md](by-language.md) | target language (EVM, Solana, Sui, Aptos, Soroban, DAML, L1) | you know what you're auditing |
| [by-role.md](by-role.md) | agent role (orchestrator, attacker, verifier, synthesizer) | you're building an agent pipeline |

## Conventions

- **Source tags:** **[P]** pashov, **[L]** plamen, **[Q]** quillshield,
  **[O]** omega. The first three point into `sources/` (verbatim upstream
  mirrors); **[O]** points into `sources/omega/` (originally authored by Daoism
  Systems, distilled from the [Team Omega](https://github.com/OmegaAudits/audits)
  report archive — see [../sources/omega/README.md](../sources/omega/README.md)).
- **Coverage symbols:** ●  primary · ◐  partial · ○  none.
- **Paths** are relative to the repo root (so `sources/pashov/...` not
  `../sources/...`).
- **"Combines with"** suggestions point to complementary skills in the
  other sources — see [../CORRELATIONS.md](../CORRELATIONS.md) for the
  full matrix.
