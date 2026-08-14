---
name: audit-codebase
description: Autonomous end-to-end security audit of a smart-contract codebase using every relevant skill in this library. Profiles the target, routes to the applicable skills across all four collections (pashov, plamen, quillshield, omega), runs four methodology orchestrators in parallel — each fanning out to its own subagents — then cross-verifies every finding across methodologies and writes the report. Runs start to finish with no human in the loop. Use when given a repository URL or path to audit, when asked to "audit this", "review this codebase", or "run a security review".
---

# Autonomous Codebase Audit

The entry point for this library. One instruction in, a verified audit report
out, no checkpoints in between.

**You are the top-level orchestrator.** Your job is to profile, dispatch,
cross-verify and report — not to audit. Do not read contract logic yourself
before the passes return; an orchestrator that has formed its own view anchors
every adjudication that follows.

```
Tier 0  profile the target, build bundles, route            ← you
Tier 1  four methodology orchestrators, in parallel
Tier 2  each fans out to its own leaf agents (~30–45 total)
Tier 3  cross-methodology verification, then the report     ← you
```

## Operating rules

1. **No human in the loop.** Never stop to ask which skills to use, how deep to
   go, or whether to proceed. Choose from the routing table, record the choice,
   continue. If something is ambiguous, take the broader interpretation and note
   it in the report's scope section.
2. **Breadth over economy.** Load every skill the routing table marks relevant.
   A skill that finds nothing costs one agent; a skill left unloaded costs a
   finding. When uncertain whether a trigger fires, treat it as firing.
3. **Never let one failure sink the run.** If an agent errors, times out, or
   returns nothing, record it and continue. A partial audit that says which parts
   are missing beats no audit.
4. **Everything is recorded.** Which skills ran, which did not and why, which
   agents failed. That record is part of the deliverable.

---

## Tier 0 — Profile, bundle, route

### Step 1: Acquire and profile

If given a URL, clone it. Then build the profile that drives every routing
decision — the procedure is in
[references/target-profile.md](references/target-profile.md). It produces:

- **platform** — EVM / Solana / Sui / Aptos / Soroban / DAML / L1 client / other
- **scope** — full codebase or a diff between two commits
- **size** — file list and normalized LOC
- **feature signals** — the grep-level evidence that fires routing triggers
- **build status** — compiles, tests pass/fail, coverage, static-analysis triage
- **off-chain surface** — backends, keepers, API clients in the repo

Run the build before anything else. Failing tests and compiler warnings are
findings, and a working test harness is what lets Tier 2 agents write proofs of
concept.

### Step 2: Route

Apply [references/routing-table.md](references/routing-table.md) to the profile.
It maps each signal to skills across all four collections and yields the
**skill manifest**: every skill that will be loaded, and by which tier-1
orchestrator.

Print the manifest before dispatching. It is the audit's coverage claim.

### Step 3: Build bundles

One shared bundle, so no agent re-derives scope:

```
{bundle}/profile.md    the Step 1 profile, including build results
{bundle}/source.md     every in-scope file under a `### path` header
{bundle}/context.md    client specs, plus integration docs for every
                       third-party protocol the code touches
{bundle}/manifest.md   the routing decision from Step 2
{bundle}/history.md    prior audit reports, if this is a repeat engagement
{bundle}/finding-format.md   copy of sources/omega/omega-audit-workflow/
                             references/finding-format.md — the common
                             output contract for every tier
```

Every agent at every tier writes findings in that one format. Without it the
Tier 3 merge degrades into re-reading four incompatible reports.

---

## Tier 1 — Dispatch the four methodologies

Spawn all four **in one message**, as parallel background agents. Prompts are in
[references/tier1-prompts.md](references/tier1-prompts.md).

| Orchestrator | Fans out to | Character |
|---|---|---|
| **pashov** | 12 attacker agents | Adversarial. "How do I extract value from this?" |
| **omega** | 5 independent generalist passes | Structural. "Can assets leave? Does this guard bind?" |
| **quillshield** | one agent per relevant topic plugin (~6–10) | Cataloged. Per-bug-class depth with reference packs. |
| **plamen** | language pack + feature-triggered injectables (~6–12) | Language-native + protocol-type specific. |

Each tier-1 orchestrator spawns its own tier-2 agents. That nesting is the
point: it lets each methodology run as its authors designed it rather than being
flattened into a single undifferentiated swarm.

**If nested spawning is unavailable in your runtime**, fall back: you spawn the
tier-2 agents directly, grouping them by methodology, and perform each tier-1
orchestrator's merge yourself before Tier 3. Same coverage, more work at Tier 0.
Record which mode ran.

### Scale

Default is **everything the routing table marks relevant** — typically 30–45
leaf agents. Only reduce under an explicit budget constraint, in this order:

1. Drop quillshield plugins whose trigger fired weakly
2. Drop omega passes E, then D, then C (see that skill's own guidance)
3. Drop pashov's three gap-hunter agents (10–12)
4. Never drop below one orchestrator per methodology — cross-methodology
   agreement is the strongest signal Tier 3 has, and it needs at least two
   methodologies to exist at all

Record any reduction in the report.

## Tier 2 — Leaf agents

Defined by each collection; you do not manage them. Two constraints propagate
down through the tier-1 prompts:

- **Every agent emits the common finding format**, including `LEAD` and
  `CLEARED` items. Cleared lists are how Tier 3 knows what was actually looked
  at rather than what happened to trip.
- **Every agent writes a proof of concept where the mechanism is non-obvious.**
  The build from Step 1 gives them a working harness. A passing test is worth
  more than any argument and it establishes true severity.

## Tier 3 — Cross-methodology verification

Wait for all four to report. Do not poll; act on completion notifications. Then
merge per [references/cross-verification.md](references/cross-verification.md).

The essential point, and the reason this tier exists:

> **Agreement *across* methodologies is the strongest evidence in the system.**

Within a methodology, agents share an author, a framework, a vocabulary and a
set of blind spots. Across methodologies they share almost nothing — four
independent teams wrote them for different purposes. So when pashov's economic
agent and omega's asset-exit lens land on the same defect from opposite
directions, that is near-conclusive.

The corollary is the trap: **a finding raised by only one methodology is not
weak.** It is what that methodology exists for. Most deep findings are found by
exactly one lens, and an orchestrator that quietly prefers corroborated items
converges on the intersection of four reviews — worse than any one of them.

Cross-verification is also where **contradictions** get resolved. Different
methodologies will disagree about whether a guard holds or a severity is right.
Resolve in the code, and record the disagreement — it usually marks either a real
bug or genuinely unclear code.

## Report

Write it per `sources/omega/omega-audit-workflow/SKILL.md` Phase 5: per-file
sections with filename-derived IDs, a General section, and every finding as
mechanism → consequence → recommendation → severity with a one-clause
justification.

Three additions specific to an autonomous run:

- **Coverage manifest.** Every skill loaded, every skill deliberately skipped and
  why. A reader cannot otherwise tell what this audit looked at.
- **Agent census.** How many agents ran per tier, and which failed.
- **Confidence signal per finding, internal only.** How many methodologies
  independently raised it. Do not put counts in the client-facing text; use them
  to order the report and to allocate your own verification effort.

Publish as an artifact if the runtime supports it, and always leave the report
on disk.

---

## Checklist

- [ ] Target acquired; profile built including feature signals
- [ ] Built and tested; failures and warnings captured as findings
- [ ] Routing table applied; skill manifest printed
- [ ] Bundle built once, shared, includes the common finding format
- [ ] Four tier-1 orchestrators spawned in one message, in parallel
- [ ] No orchestrator reduction below one per methodology
- [ ] Waited for all completions; no polling, no partial merge
- [ ] Cross-methodology merge run; single-methodology findings not discounted
- [ ] Contradictions resolved in the code and recorded
- [ ] Report includes coverage manifest, agent census, and failures
- [ ] Ran start to finish without asking a question
