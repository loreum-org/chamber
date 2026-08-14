---
name: omega-audit-workflow
description: Orchestrate a full smart-contract audit engagement — scope as a commit diff, five independent review passes run as parallel subagents on different decomposition axes and reconciled into one report, compile/deploy/test the code rather than only reading it, triage static-analysis output instead of pasting it, organize findings per-file with ID prefixes and a General section, and close the loop with a preliminary report, a client fix commit, and a verified per-issue Resolution. Use when starting an audit, deciding how to structure a review, writing up findings, re-auditing a codebase you have reviewed before, or reviewing fixes.
---

# Audit Workflow

The process layer, and the orchestrator for this skill set. Use it to run the
engagement; the other eleven skills are the lenses each Phase 3 pass applies.

```
1. Fix scope        → exact repo, exact commit(s), exact file list
2. Build & run      → compile, deploy, test; run static analysis; triage
3. Review           → five independent passes as parallel subagents, then reconcile
4. Preliminary      → deliver findings before any fixes exist
5. Client fixes     → client returns a commit hash
6. Verify & close   → re-audit the fix commit, write per-issue Resolution
```

Steps 4–6 are not optional polish. Fix commits routinely contain new bugs: a
patch written against a narrow symptom description, in code the author has
re-entered after a gap, arriving when reviewer attention is lowest. Treat the
fix commit as a fresh, in-scope codebase.

---

## Phase 1 — Fix the scope, in writing

Never write "we audited the protocol." Write:

- **Repository URL**, and the branch if not the default
- **Commit hash** the review is based on — full 40 characters
- For a re-audit or upgrade: **both** hashes, and an explicit statement that
  scope is the diff
- **File list**, explicitly. Prefer **normalized lines of code** (excluding
  blanks and comments) over file count as the size signal — it is the honest
  measure of what was reviewed
- **Anything non-code the client supplied** — specifications, architecture
  notes, design docs. Cite them by URL

For a repeat engagement, also record the **audit history**: every prior review
and its date. You will need it in Phase 3.

> **Multi-repo scope is normal** for systems with off-chain components. Audit
> the contracts and the backend that drives them together, and cross-reference
> findings between repositories — the same defect often appears in both, and a
> finding that is low severity in one may be critical in the other.

## Phase 2 — Build it and run it

Do this before reading closely. It is a precondition, not a formality.

1. **Compile.** Warnings are findings. A repo that does not compile in its
   documented configuration is itself a finding.
2. **Run the test suite.** Failing tests are findings. So is a suite that passes
   while its coverage command is broken.
3. **Measure coverage.** Name the uncovered paths that matter; do not quote a
   percentage.
4. **Deploy to a local test environment.** This is what separates reading from
   auditing — it is how you check a claimed behaviour rather than inferring it,
   and how you write a proof of concept later.
5. **Run static analysis**, then **triage it**. Tool output belongs in the
   report only after a human has decided each item is real, is in scope, and is
   correctly rated. Fold survivors into the appropriate per-file sections. Never
   paste raw output — it is the fastest way to lose a client's trust in the
   whole document. The same discipline applies to AI-assisted analysis.
6. **Run the dependency advisory audit.**

**Write a proof of concept when the mechanism is non-obvious.** A working
attacker contract converts an argument into a demonstration, and it forecloses
the "that isn't exploitable in practice" response. It also lets you characterise
the finding accurately — a griefing vector that can be held for ransom is an
extortion finding, and you only learn that by building it.

**Verify external behaviour empirically.** Where the system trusts a third-party
API or protocol, call it directly with adversarial parameters and record the
response. Observed behaviour beats documented behaviour.

## Phase 3 — Independent passes (orchestrated fan-out)

> Reviewers who have not discussed the code find different things.

This phase is **run as subagents**, not inline. Independence is the whole point
and it cannot be faked inside one context: once you have written a finding, you
cannot un-see it, and a second "pass" degrades into confirming the first.
Separate contexts give you the real thing.

### How many passes

Model detection as capture-recapture: each pass independently surfaces a given
defect with probability *p*, so coverage is `1 − (1−p)^k`. With detectability
mixed across routine, subtle and deep defects, coverage runs roughly:

| passes | 1 | 2 | 3 | **5** | 8 | 16 |
|---|---|---|---|---|---|---|
| coverage | 43% | 62% | 71% | **80%** | 87% | 94% |

Marginal gain drops below ~3% per pass after the fifth, and false positives —
which are idiosyncratic and therefore accumulate linearly while true findings
saturate — put the precision/recall optimum at about five. **Five is the
default.** Note where the curve is steepest: going from two passes to five is
worth ~18 points of coverage, which is why a headcount-shaped number is the
wrong place to stop.

### Correlation, not count, is the binding constraint

More important than *k*. If some fraction *b* of defects sits in a blind spot
the model shares with itself, the ceiling is `1 − b` no matter how many passes
run:

| | 4 passes | 16 passes |
|---|---|---|
| decorrelated | **77%** | 94% |
| shared blind spot (b≈0.3) | 54% | **66%** |

Sixteen correlated passes lose to four decorrelated ones. Human reviewers are
naturally decorrelated — different training, careers, habits. Instances of one
model on near-identical prompts are closer to one reviewer sampled repeatedly,
so agent fan-out only pays if the passes are made to differ deliberately.

Spend effort on decorrelation before spending it on count. Levers, by
effect size:

1. **Different model family** — the largest lever by a wide margin, because the
   blind spots are genuinely different. Use it if more than one is available.
2. **Different decomposition axis** — the five passes below each carve the
   system differently, which is what makes them disagree usefully.
3. **Different framing** — attacker, maintainer, integrator.
4. **Different reading order** — weak but free.
5. **Temperature** — near worthless. Do not rely on it.

Note what is *not* on that list: giving each pass a different **specialty**.
Specialising decorrelates too, but it costs the property this phase is built on
— passes with different remits produce agreement that is expected overlap rather
than evidence. Keep every pass a generalist over the full scope.

You are the **orchestrator** for this phase. Spawn the passes, wait, then
reconcile. Do not review the code yourself while they run — an orchestrator who
has formed its own view will anchor the reconciliation.

**Runtime requirement.** This phase needs the `Agent` tool. If it is unavailable
(some runtimes), skip the orchestration and fall back to sequential simulation:
sequential passes on different decomposition axes, each written to a file and
*not re-read* before the next begins. Say in the report which mode was used and
how many passes ran — sequential simulation is weaker and the reader should
know.

### Turn 1 — Prepare the bundle

Assemble the review context once, into files, so each pass reads a bundle rather
than re-deriving scope. In one Bash command:

1. `{bundle}/scope.md` — the Phase 1 scope record: repo, commit(s), file list,
   normalized LOC, plus the Phase 2 build results (test pass/fail counts,
   compiler warnings, coverage gaps, triaged static-analysis survivors).
2. `{bundle}/source.md` — every in-scope file, each under a `### path` header in
   a fenced block. Exclude `test/`, `mocks/`, `interfaces/`, `lib/` unless they
   are in scope; note the exclusion in `scope.md`.
3. `{bundle}/context.md` — client-supplied specs, design docs, and the
   integration documentation for every third-party protocol the code touches.
   This is the material that produces findings pure code review cannot.
4. `{bundle}/history.md` — **repeat engagements only.** Prior reports, with every
   open finding and every previously-resolved finding listed by ID.
5. `{bundle}/finding-format.md` — copy
   [references/finding-format.md](references/finding-format.md) in verbatim. Both
   passes must emit the same shape or the merge cannot be mechanical.

Print the line count of each bundle file. Do not inline source into agent
prompts.

### Turn 2 — Spawn the passes

In **one message**, spawn these as parallel background agents
(`run_in_background: true`, `subagent_type: "general-purpose"`). Prompts are in
[references/pass-prompts.md](references/pass-prompts.md) — use them verbatim,
substituting real paths.

| Agent | Decomposition axis | Gets |
|---|---|---|
| **Pass A** | Bottom-up — state variables and data structures first, then who writes them | scope, source, context |
| **Pass B** | Top-down — external entry points and callbacks first, then what they reach | scope, source, context |
| **Pass C** | Asset-centric — follow each asset in, through, and out | scope, source, context |
| **Pass D** | Actor-centric — enumerate every principal, then what each can do | scope, source, context |
| **Pass E** | Invariant-centric — state the properties that must hold, then break each | scope, source, context |
| **Pass R** | Regression — prior findings only. *Repeat engagements only; not one of the five* | scope, source, history |

**Assign different model families across A–E where more than one is available.**
This is the single highest-value configuration choice in the phase; a note of
which pass ran on which model belongs in the engagement record.

All five apply **all eleven lenses** to the **full scope**. Do not split the
lenses between them and do not split the files between them — that produces five
partial reviews whose disagreement means nothing. The divergence is the product,
and it only has meaning if each had the opportunity to find everything. The axes
differ in *where each starts*, never in what it is responsible for.

Pass R is different: a checklist task, not a discovery task. It needs no
independence, can be told exactly what to look for, and does not count toward
the five.

**No pass may see another's output, then or later.**

Scale down only under real cost pressure, and in this order: drop E, then D,
then C. Three passes reach ~71% modelled coverage against ~80% for five. Below
three, prefer spending the budget on decorrelating the passes you do run.

### Turn 3 — Wait

Proceed only when every spawned agent has notified completion. Do **not** poll,
sleep, or start reconciling partial results.

While waiting, do nothing that forms an opinion on the findings. Finishing the
Phase 1 scope write-up or the report skeleton is fine.

### Turn 4 — Reconcile

Merge per [references/merge-protocol.md](references/merge-protocol.md). Because
every pass is a generalist over the full scope, the number of passes that raised
an item is real evidence — but it calibrates very differently from intuition:

| raised by | P(real) | what to do |
|---|---|---|
| 3–5 of 5 | ~100% | Accept. Minimal adjudication; spend the time on the write-up. |
| 2 of 5 | ~83% | Strong prior. Light adjudication. |
| **1 of 5** | **~47%** | **Where the entire adjudication budget goes.** |

The singleton row is the one that matters. It is a coin flip *and* it is where
the value is: about **23% of all real findings arrive as singletons, and ~90% of
the deep ones do** — the subtle defects only one reviewer sees are precisely the
ones that make the engagement worth paying for. False positives are idiosyncratic
and so are almost all singletons too, which is why the row sits at 50/50.

The consequence is a rule that must be followed literally: **you cannot triage
singletons by count.** Discarding them loses more real findings than every other
merge error combined; accepting them wholesale doubles the false-positive rate.
Each one gets resolved on its evidence, in the code.

**Disagreements between passes** — one says a guard holds, another says it does
not — are the highest-value artifact in the merge. Resolve in the code and record
the reasoning; a disagreement between competent reviews marks either a real bug
or genuinely unclear code, and both are reportable.

### Review order within a pass

**By file, not by bug class.** Each pass walks the files and applies the lenses
to each:

| Lens | Load |
|---|---|
| Can assets get back out? | `omega-asset-exit-paths` |
| Does this check actually bind? | `omega-enforceability-check` |
| Is this counter right on every path? | `omega-accounting-consistency` |
| What are we trusting, for what? | `omega-external-data-trust` |
| Who profits from reordering? | `omega-ordering-and-approval-races` |
| What did the diff break? | `omega-upgrade-diff-review` |
| Does a read for time T return what was true at T? | `omega-time-indexed-state` |
| Is the scalar current, and does the round trip close? | `omega-share-and-index-accounting` |
| Which parties does this restriction cover? | `omega-transfer-restriction-hooks` |
| Does it honour the standard it advertises? | `omega-standard-conformance` |
| Is the repo itself sound? | `omega-repo-hygiene-sweep` |

**Read the context, not just the code.** For every integrated protocol —
lending market, AMM, bridge, yield wrapper — read its integration documentation
and check the code against the caveats it states. Rate functions correct for one
class of underlying and wrong for another, TWAP windows shorter than
recommended, and market configurations assumed rather than verified are all
invisible from the Solidity alone. This is the highest-yield activity that pure
code review cannot produce.

**For repeat engagements, re-check the prior reports.** Two checks: findings
still open, and findings previously resolved that have since **regressed**. Both
belong in the report, and the second is the one only a carried-forward review
can catch. This is Pass R's entire job.

## Phase 4 — Severity

Four levels:

| | |
|---|---|
| **High** | Vulnerabilities that can lead to loss of assets or data manipulations |
| **Medium** | Vulnerabilities that are essential to fix, but that do not lead to asset loss or data manipulation |
| **Low** | Issues that do not represent a direct exploit — poor implementations, deviations from best practice, high gas costs |
| **Info** | Matters of opinion |

Three habits matter more than the ladder:

1. **Justify the rating in one clause, inline.** Not "Severity: Medium" but
   "Medium — loss of funds is possible, but the precondition is improbable," or
   "High — the counter gates the boost threshold, conceivably halting governance
   entirely." Likelihood and impact, stated, every time. Where the two pull in
   opposite directions, say which dominates.
2. **Off-chain consequences count.** An attack that costs no on-chain funds but
   breaks a contractual obligation the operator has to a counterparty is a real
   finding. Rate it on consequence, not on whether value moved.
3. **Report privileged-actor risk even when intended.** "The owner can withdraw
   user deposits," "the blacklister can disable transfers," "the oracle updater
   can set any price" — file them at whatever severity fits. Do not suppress a
   finding in anticipation of "that is by design." Let the client say so, in the
   Resolution, on the record.

## Phase 5 — Report structure

```
Summary                  ← who the client is, what the system does
Scope of the audit       ← repos, commits, files, normalized LOC
Methodology              ← independent reviewers; what you actually ran
Liability / Disclaimer
Severity definitions
Summary of findings      ← prose + severity × (found / resolved) table
Resolution               ← the fix commit; how you verified
Findings
  General                ← G1…Gn: repo-wide and cross-cutting
  path/to/File.sol       ← per-file section
    XX1. Title [severity] [status]
    XX2. …
```

**Derive finding IDs from the file name.** `VaultCore.sol` → `VC1, VC2…`;
`db/sql_reader.py` → `SQLR1, SQLR2…`. An ID is then self-locating in a client
conversation, and stays stable when findings are added or renumbered.

**Every finding has three parts, in order:**

- **Description** — the mechanism, then the consequence. Name the function,
  quote the line. For arithmetic findings, walk a concrete numeric scenario the
  reader can check with a calculator; a worked example survives disagreement
  about the model in a way that a proof sketch does not.
- **Recommendation** — what to do. When the obvious fix has a serious drawback,
  say so and propose the structural alternative. When there is no clean fix, say
  *that*, and give the least-bad option rather than dressing a partial
  mitigation as a resolution.
- **Severity** — with its one-clause justification.

**Cross-reference relentlessly.** Root causes get one finding; consequences
point at it. Where findings in one contract apply verbatim to a near-identical
sibling, say so by reference instead of duplicating the writeup.

**The Summary of findings is prose plus a table.** The prose states what you
looked for and what you deliberately excluded. Scope decisions — "this review
focused on loss-of-funds, so informational issues are only sampled" — belong in
the report, not in your head.

## Phase 6 — Resolution

Deliver preliminary → client returns a commit → **re-audit that commit** →
append a `Resolution:` line to every finding.

| Status | Meaning |
|---|---|
| `[resolved]` | Fixed in code; you verified it |
| `[partially resolved]` | Fixed for the reported case, not the general one |
| `[not resolved]` | Unchanged |
| `[acknowledged]` | Client accepts the risk; record their reasoning |
| `[will be resolved]` | Committed to, not yet done |
| `[resolved*]` | Not fixed in code, but unreachable given a scope or deployment decision — always footnote what that decision was |

The last one is worth adopting deliberately. When a finding is neutralised by a
plan rather than by code — "only one chain at launch," "this will be a fresh
deployment, not an upgrade" — mark it as contingent and record the contingency.
Plans change; a flat "resolved" hides that the safety depends on one.

**Quote the client verbatim when they disagree.** Their reasoning belongs in the
record next to yours, unparaphrased. A reader in two years needs to see both.

**Audit the rest of the fix commit**, not only the fixes — clients bundle
unrelated work into them.

---

## Checklist

Scope
- [ ] Repo, branch, full commit hash(es), explicit file list, normalized LOC
- [ ] Prior reviews enumerated; their open findings re-checked
- [ ] Spec and design docs obtained and cited

Build
- [ ] Compiles; warnings captured as findings
- [ ] Test suite runs; failures captured as findings
- [ ] Coverage measured; uncovered critical paths named
- [ ] Deployed to a local test environment
- [ ] Static analysis run and **triaged**, not pasted
- [ ] Dependency advisories checked
- [ ] PoC written for every non-obvious mechanism

Review (Phase 3 orchestration)
- [ ] Bundle built: scope, source, context, finding-format (+ history if repeat)
- [ ] Pass A and Pass B spawned in one message, parallel, background
- [ ] Both passes given the FULL scope and ALL eleven lenses — not split between them
- [ ] Pass R spawned if this is a repeat engagement
- [ ] Orchestrator formed no independent view while passes ran
- [ ] Waited for every completion notification; no polling, no partial merge
- [ ] Neither pass saw the other's output, at any point
- [ ] Contested items resolved in the code, not by averaging or dropping
- [ ] No finding discounted for being raised by only one pass
- [ ] Leads promoted or retired, each with a stated reason
- [ ] Cleared lists intersected, not unioned
- [ ] Completeness table printed and every raw item accounted for
- [ ] Fallback mode (sequential simulation) disclosed in the report if used

Write-up
- [ ] Every finding: mechanism → consequence → Recommendation → Severity + why
- [ ] Numeric scenarios worked through for arithmetic findings
- [ ] Root causes cross-referenced; consequences not duplicated
- [ ] Severity table with found/resolved counts
- [ ] Deliberate exclusions stated in the summary

Close
- [ ] Preliminary delivered before fixes existed
- [ ] Fix commit re-audited in full, including unrelated changes
- [ ] Per-issue Resolution written; contingent mitigations marked and footnoted
- [ ] Client disagreements quoted, not paraphrased
