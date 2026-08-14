# Merge Protocol

How the orchestrator reconciles the five review passes (A–E) and the optional
regression pass (R) into one finding set.

## What makes this different from a specialist fan-out

A specialist sweep expects overlap to be *noise*: two agents flag the same line
because their remits intersect, so agreement carries little information and the
merge is mostly deduplication.

Independent generalist passes are the opposite. Each saw the whole scope and had
the opportunity to find everything, so the number that raised an item is real
evidence. It just does not calibrate the way intuition suggests.

## Calibration

Modelled over a realistic mix of routine, subtle and deep defects, with five
passes:

| raised by | share of real findings | P(real) |
|---|---|---|
| 5 of 5 | 8% | ~100% |
| 4 of 5 | 22% | ~100% |
| 3 of 5 | 26% | ~100% |
| 2 of 5 | 22% | ~83% |
| **1 of 5** | **23%** | **~47%** |

Two facts drive everything downstream:

1. **Singletons are half of all items raised once, and half of those are real.**
   False positives are idiosyncratic, so they are almost all singletons too. That
   is why the bottom row sits near a coin flip while every row above it is
   effectively certain.
2. **Singletons are where the value is.** They are 23% of all real findings and
   roughly **90% of the deep ones** — the defects only one reviewer sees are
   precisely the ones a client cannot find without you.

So the singleton row cannot be triaged by count in either direction. Discarding
it loses more real findings than every other merge error combined; accepting it
wholesale doubles the false-positive rate. **It is where the entire adjudication
budget goes.**

The corollary: an orchestrator that quietly prefers corroborated findings
converges on the intersection of five reviews, which is worse than any single
review plus honest adjudication. **You want the union, adjudicated.**

## Procedure

### 1. Normalize

Parse every FINDING and LEAD from all passes into the common format. Key each
on `(file, function, mechanism)`.

**Key on mechanism, not on title.** Different passes will describe the same
defect in different words, and different defects in similar words. The test
for "same finding" is whether the *same code change* fixes both.

### 2. Classify each item

| Class | Meaning | Action |
|---|---|---|
| **Strongly corroborated** | 3+ passes, same mechanism | Accept. Merge write-ups, keep every distinct PoC. Minimal adjudication — spend the time on the description and severity instead. |
| **Corroborated** | 2 passes, same mechanism | Accept unless the evidence actively contradicts. Light adjudication. |
| **Singleton** | 1 pass only | Full adjudication, every one, on evidence in the code. See §2a. |
| **Contested** | Two or more passes reached the same code and disagree | Resolve in the code (§3). Never average, never drop. |
| **Divergent mechanism** | Same function, genuinely different defects | Keep all as separate findings. Do not collapse. |
| **Lead** | No pass could close it | §4. |

Corroboration counts are internal calibration. They do not appear in the client
report — the client needs mechanism, consequence and severity.

### 2a. Adjudicating singletons

This is the expensive step and it is not optional. For each singleton, go to the
code and settle it yourself: does the mechanism described actually exist, is the
state reachable, does the consequence follow?

Three outcomes — **promote**, **demote to lead**, or **reject with a stated
reason**. Never "keep because it might be real" and never "drop because only one
pass saw it."

Two useful priors while working through them. A singleton from a pass whose
decomposition axis *naturally* reaches that defect is more likely real — an
asset-trapping finding from the asset-centric pass, a privilege finding from the
actor-centric pass. And a singleton nobody else raised **in an area every pass
covered** deserves more scrutiny than one in a corner only that pass's axis leads
to.

### 3. Resolve contested items

Go to the code and settle it yourself. Read the guard the passes discussed, the
paths that reach it, and the state it depends on.

Three outcomes:

- **One pass is right.** Take that finding, and record the mistaken reading in
  your notes — if a competent reviewer misread this code, that is worth a line in
  the report even when the code is correct.
- **A majority is not automatically right.** Three passes agreeing that a guard
  holds does not settle it against one that traced a path through it. Correlated
  passes fail together; read the path.
- **Both are partly right.** Usually means the behaviour is state-dependent and
  neither pass enumerated the states. That is itself the finding: write it as one.
- **You cannot settle it.** Then the code is genuinely unclear, and that is
  reportable at `info` at minimum: independent competent reviews reached
  opposite conclusions from the same source.

Do not resolve a contest by re-engaging a pass. They are finished; asking one
anchors the answer to whichever you asked first.

### 4. Promote or retire leads

A lead becomes a finding when you can close it: name the mechanism, name the
consequence, and produce a path or a PoC. Spend real effort here — leads are
where the highest-severity findings usually hide, precisely because they were
hard enough that one pass could not finish them.

A lead that survives your attempt and describes real uncertainty about the code
belongs in the report as `info`. A lead that is simply wrong gets dropped, and
you should be able to say why in one sentence.

**A lead raised by two or more passes independently is not a lead — it is a
finding you have not closed yet.** Prioritize those first, in order of how many
passes raised them.

### 5. Fold in Pass R

Add Pass R's rows to the report as their own section. Two rules:

- `REGRESSED` items are **findings**, not history. File each with the current
  severity, cross-referenced to the original report and ID.
- `CONTINGENT` items need the contingency re-verified against the current
  deployment plan. A mitigation that was true at the last audit may not be true
  now. If it no longer holds, it is a live finding again.

If a regression collides with a finding from any review pass, merge them and keep
the history — "this was reported as X in the prior report, fixed, and has since
returned" is a materially stronger finding than either half.

### 6. Merge the cleared lists

An area belongs in the report's "checked and found sound" section when a
**majority of passes** examined it and none raised anything. Below that, it was
reviewed once or twice, not five times — either review it yourself before
claiming it, or leave it out.

Do not let the cleared section inherit a confidence the review did not earn. It
is the part of the report a reader is least able to check, and the only part
where an unearned claim makes the document *wrong* rather than merely
incomplete.

### 7. Cross-reference and rank

Root causes get one finding; consequences point at it. Where one defect produces
several downstream symptoms — and independent passes often report the symptoms
separately — collapse them into one finding with the others cross-referenced.

Then rank by severity per the Phase 4 ladder, and number by file per Phase 5.

## Completeness check

Before writing the report, print this and confirm it:

```
Pass A (bottom-up):    N findings, N leads, N cleared   [model: ...]
Pass B (top-down):     N findings, N leads, N cleared   [model: ...]
Pass C (asset):        N findings, N leads, N cleared   [model: ...]
Pass D (actor):        N findings, N leads, N cleared   [model: ...]
Pass E (invariant):    N findings, N leads, N cleared   [model: ...]
Pass R (regression):   N rows  (N regressed, N open, N contingent)

Strongly corroborated (3+):  N
Corroborated (2):            N
Singletons:                  N  → all adjudicated? yes/no
   promoted:                 N
   demoted to lead:          N
   rejected:                 N  → each with a stated reason?
Contested:                   N  → all resolved in the code? yes/no
Leads promoted:              N
Leads retired:               N

Final findings:              N
```

If singletons are under ~15% or over ~40% of items raised, something is off:
too few suggests the passes were correlated (check whether they really ran
different axes, or the same model with the same framing); too many suggests one
pass is generating noise. Say which in the engagement record.

Every raw item from every pass must appear in exactly one bucket. A raw finding
that is in no bucket has been silently dropped — go back and find it.

## What not to do

- **Do not review the code yourself before the passes return.** An orchestrator
  with its own view anchors every adjudication that follows.
- **Do not let either pass see the other's output**, during the review or during
  reconciliation. There is no legitimate reason to, and it retroactively destroys
  the independence you paid for.
- **Do not weight by pass.** No decomposition axis is more authoritative. If you
  find yourself trusting one systematically, that is a signal about prompt
  symmetry or model assignment, not about the code.
- **Do not treat the count as a score.** It selects how much adjudication an item
  gets, not whether it is true. A 5-of-5 item can still be wrong if the passes
  were correlated; a 1-of-5 item is where most deep findings live.
- **Do not report corroboration counts to the client.** They are internal
  calibration. The client needs the mechanism, the consequence and the severity.
