# Omega Skills

Twelve custom skills distilled from the audit methodology of **Team Omega**
([teamomega.eth.limo](https://teamomega.eth.limo/)), derived by studying their
public report archive. See [ATTRIBUTION.md](ATTRIBUTION.md).

Unlike its sibling directories under `sources/`, this one is **not** a mirror. These are originally
authored skill files, written at the level of **pattern recognition** —
recognizable code shapes, structural questions, detection heuristics and fix
patterns. They deliberately do not reference specific past engagements or
findings: a skill that teaches you to spot the shape transfers to new code, one
that catalogues someone's old bugs does not.

## Why a separate Omega set

The three mirrored collections (pashov, plamen, quillshield) are organized by
**bug class** — reentrancy, oracle, arithmetic, proxy. This set uses a different
decomposition, because the highest-yield findings often do not belong to a bug
class at all. They are answers to a small number of questions asked of every
contract:

- Can every asset that goes in come back out, in every reachable state?
- Does this check actually constrain the party it names?
- Is every counter updated on *every* path that changes what it counts?
- What exactly are we trusting this off-chain value for?

These cut across bug classes, and none of the three mirrored sources organizes
around them. That is the gap this set fills.

## The skills

| Skill | Question it asks |
|---|---|
| [omega-audit-workflow](omega-audit-workflow/SKILL.md) | How do I run and write up the whole engagement? *(orchestrator — spawns the review passes)* |
| [omega-asset-exit-paths](omega-asset-exit-paths/SKILL.md) | Can every asset get back out? |
| [omega-enforceability-check](omega-enforceability-check/SKILL.md) | Does this guard actually guard? |
| [omega-accounting-consistency](omega-accounting-consistency/SKILL.md) | Is this counter right on every path? |
| [omega-external-data-trust](omega-external-data-trust/SKILL.md) | What am I trusting, and for what? |
| [omega-upgrade-diff-review](omega-upgrade-diff-review/SKILL.md) | What changed, and what did the change break? |
| [omega-ordering-and-approval-races](omega-ordering-and-approval-races/SKILL.md) | Who profits from reordering this? |
| [omega-time-indexed-state](omega-time-indexed-state/SKILL.md) | Does a read for time T return what was true at T? |
| [omega-share-and-index-accounting](omega-share-and-index-accounting/SKILL.md) | Is the scalar current, and does the round trip close? |
| [omega-transfer-restriction-hooks](omega-transfer-restriction-hooks/SKILL.md) | Which parties does this restriction actually cover? |
| [omega-standard-conformance](omega-standard-conformance/SKILL.md) | Does it honour the standard it advertises? |
| [omega-repo-hygiene-sweep](omega-repo-hygiene-sweep/SKILL.md) | Is the repo itself sound? |

## How to use

Start with `omega-audit-workflow`. It orchestrates the engagement and, at
Phase 3, spawns **five independent review subagents** — bottom-up from state,
top-down from entry points, asset-centric, actor-centric and invariant-centric
— each applying all eleven lenses to the full scope, then reconciles them. A
regression pass runs additionally for repeat engagements.

Five, not two: modelled coverage runs ~62% at two passes and ~80% at five, and
correlation matters more than count — decorrelating the passes (different model
families, different decomposition axes) beats adding more of them.

Its `references/` carry the machinery: verbatim
[pass prompts](omega-audit-workflow/references/pass-prompts.md), the
[merge protocol](omega-audit-workflow/references/merge-protocol.md), and the
shared [finding format](omega-audit-workflow/references/finding-format.md) both
passes emit.

Or load an individual lens directly:

```
@solidity-audit-skills/sources/omega/omega-asset-exit-paths/SKILL.md
```

## Relationship to the mirrored sources

Complementary, not competing. These are *framing* questions; the mirrored
collections have deeper per-bug-class catalogues. Suggested pairings:

| Omega skill | Pair with |
|---|---|
| `omega-asset-exit-paths` | **[Q]** `dos-griefing-analysis` (push-vs-pull mechanics) |
| `omega-enforceability-check` | **[Q]** `semantic-guard-analysis` (finds *missing* guards; this finds *inert* ones) |
| `omega-accounting-consistency` | **[Q]** `state-invariant-detection` (invariant inference) |
| `omega-external-data-trust` | **[Q]** `oracle-flashloan-analysis` (manipulation mechanics) |
| `omega-upgrade-diff-review` | **[Q]** `proxy-upgrade-safety` (storage-collision mechanics) |
| `omega-ordering-and-approval-races` | **[P]** `hacking-agents/` attacker framing |
| `omega-time-indexed-state` | **[P]** `economic-security-agent` (incentive analysis of boundary timing) |
| `omega-share-and-index-accounting` | **[Q]** `input-arithmetic-safety` (rounding direction in the conversions) |
| `omega-transfer-restriction-hooks` | **[Q]** `external-call-safety` (token-integration mechanics) |
| `omega-standard-conformance` | **[Q]** `external-call-safety` (the consuming side) |
| `omega-audit-workflow` | **[P]** `solidity-auditor` (12-agent parallel sweep as the breadth phase) |

Source tags follow [../../library/README.md](../../library/README.md):
**[P]** pashov · **[L]** plamen · **[Q]** quillshield.
